/**
 * EO Sync Engine
 *
 * Provides two-way synchronization between EO Activibase and Airtable:
 * - Change detection and tracking
 * - Conflict resolution using EO Superposition (SUP)
 * - Activity logging to Xano
 * - Real-time and scheduled sync
 */

class SyncEngine {
    constructor(config = {}) {
        this.airtable = config.airtable; // AirtableIntegration instance
        this.xano = config.xano; // XanoIntegration instance
        this.softr = config.softr; // SoftrContext instance

        // Sync configuration
        this.syncConfig = {
            direction: config.direction || 'bidirectional', // 'airtable_to_eo', 'eo_to_airtable', 'bidirectional'
            conflictResolution: config.conflictResolution || 'superposition', // 'superposition', 'airtable_wins', 'eo_wins', 'newest_wins'
            autoSync: config.autoSync !== false,
            syncInterval: config.syncInterval || 30000, // 30 seconds
            batchSize: config.batchSize || 50
        };

        // Sync state
        this.syncState = {
            sessionId: this.generateSyncSessionId(),
            isRunning: false,
            lastSync: null,
            nextSync: null,
            conflicts: new Map(), // recordId -> conflicts
            pendingChanges: new Map(), // recordId -> changes
            stats: {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                conflictsResolved: 0,
                recordsCreated: 0,
                recordsUpdated: 0,
                recordsDeleted: 0
            }
        };

        // Change tracking
        this.changeTracker = {
            eoChanges: new Map(), // recordId -> { before, after, timestamp }
            airtableChanges: new Map(), // recordId -> { before, after, timestamp }
            lastKnownState: new Map() // recordId -> checksum
        };

        // Sync interval handle
        this.syncInterval = null;

        // Event listeners
        this.listeners = {
            syncStart: [],
            syncComplete: [],
            syncError: [],
            conflictDetected: [],
            conflictResolved: []
        };
    }

    /**
     * Initialize sync engine
     */
    async initialize() {
        console.log('🔄 Initializing Sync Engine...');

        if (!this.airtable || !this.xano || !this.softr) {
            throw new Error('Airtable, Xano, and Softr integrations are required');
        }

        // Initial sync
        await this.performFullSync();

        // Start auto-sync if enabled
        if (this.syncConfig.autoSync) {
            this.startAutoSync();
        }

        console.log('✓ Sync Engine initialized');

        return {
            sessionId: this.syncState.sessionId,
            config: this.syncConfig,
            stats: this.syncState.stats
        };
    }

    /**
     * Perform full synchronization
     */
    async performFullSync() {
        if (this.syncState.isRunning) {
            console.warn('Sync already in progress, skipping');
            return;
        }

        this.syncState.isRunning = true;
        this.emit('syncStart', { sessionId: this.syncState.sessionId });

        const syncStartTime = Date.now();
        console.log('🔄 Starting full sync...');

        try {
            // Get all tables from Airtable
            const tables = this.airtable.getTables();

            for (const table of tables) {
                await this.syncTable(table);
            }

            // Update sync state
            this.syncState.lastSync = new Date().toISOString();
            this.syncState.stats.totalSyncs++;
            this.syncState.stats.successfulSyncs++;

            const duration = Date.now() - syncStartTime;
            console.log(`✓ Full sync completed in ${duration}ms`);

            // Log sync completion to Xano
            await this.logSyncActivity({
                action: 'sync_complete',
                duration,
                stats: { ...this.syncState.stats }
            });

            this.emit('syncComplete', {
                duration,
                stats: this.syncState.stats
            });

        } catch (error) {
            console.error('Sync failed:', error);
            this.syncState.stats.failedSyncs++;

            await this.logSyncActivity({
                action: 'sync_error',
                error: error.message
            });

            this.emit('syncError', { error });

            throw error;
        } finally {
            this.syncState.isRunning = false;
        }
    }

    /**
     * Sync a single table
     */
    async syncTable(table) {
        console.log(`📋 Syncing table: ${table.name}`);

        // Fetch current Airtable data
        const airtableRecords = await this.airtable.fetchTableRecords(table.id);

        // Get EO records for this table
        const eoRecords = this.getEORecords(table.id);

        // Detect changes
        const changes = this.detectChanges(eoRecords, airtableRecords, table);

        console.log(`  Detected changes: ${changes.toCreate.length} create, ${changes.toUpdate.length} update, ${changes.toDelete.length} delete`);

        // Apply changes based on sync direction
        await this.applyChanges(changes, table);

        console.log(`  ✓ Table synced: ${table.name}`);
    }

    /**
     * Detect changes between EO and Airtable
     */
    detectChanges(eoRecords, airtableRecords, table) {
        const changes = {
            toCreate: [],
            toUpdate: [],
            toDelete: [],
            conflicts: []
        };

        // Create maps for easy lookup
        const eoMap = new Map(eoRecords.map(r => [r.id, r]));
        const airtableMap = new Map(airtableRecords.map(r => [r.id, r]));

        // Check for records to create/update from Airtable to EO
        if (this.syncConfig.direction === 'airtable_to_eo' || this.syncConfig.direction === 'bidirectional') {
            for (const airtableRecord of airtableRecords) {
                const eoRecord = eoMap.get(airtableRecord.id);

                if (!eoRecord) {
                    // New record from Airtable
                    changes.toCreate.push({
                        direction: 'airtable_to_eo',
                        record: airtableRecord,
                        table
                    });
                } else {
                    // Check for conflicts
                    const conflict = this.detectConflict(eoRecord, airtableRecord);

                    if (conflict) {
                        changes.conflicts.push({
                            eoRecord,
                            airtableRecord,
                            table,
                            conflict
                        });
                    } else if (this.hasChanged(eoRecord, airtableRecord)) {
                        changes.toUpdate.push({
                            direction: 'airtable_to_eo',
                            record: airtableRecord,
                            existing: eoRecord,
                            table
                        });
                    }
                }
            }
        }

        // Check for records to create/update from EO to Airtable
        if (this.syncConfig.direction === 'eo_to_airtable' || this.syncConfig.direction === 'bidirectional') {
            for (const eoRecord of eoRecords) {
                const airtableRecord = airtableMap.get(eoRecord.id);

                if (!airtableRecord && this.isPendingCreate(eoRecord)) {
                    // New record from EO
                    changes.toCreate.push({
                        direction: 'eo_to_airtable',
                        record: eoRecord,
                        table
                    });
                } else if (airtableRecord && this.hasEOChanges(eoRecord)) {
                    // EO has changes to push
                    changes.toUpdate.push({
                        direction: 'eo_to_airtable',
                        record: eoRecord,
                        existing: airtableRecord,
                        table
                    });
                }
            }
        }

        // Check for deletions
        if (this.syncConfig.direction === 'airtable_to_eo') {
            for (const eoRecord of eoRecords) {
                if (!airtableMap.has(eoRecord.id)) {
                    changes.toDelete.push({
                        direction: 'airtable_to_eo',
                        recordId: eoRecord.id,
                        table
                    });
                }
            }
        }

        return changes;
    }

    /**
     * Detect conflict between EO and Airtable records
     */
    detectConflict(eoRecord, airtableRecord) {
        // Both have been modified since last sync
        const lastKnown = this.changeTracker.lastKnownState.get(eoRecord.id);

        if (!lastKnown) {
            return null; // No baseline to detect conflict
        }

        const eoChecksum = this.calculateChecksum(eoRecord.fields);
        const airtableChecksum = this.calculateChecksum(airtableRecord.fields);

        if (eoChecksum !== lastKnown && airtableChecksum !== lastKnown) {
            // Both changed since last sync - conflict!
            return {
                type: 'concurrent_modification',
                eoChecksum,
                airtableChecksum,
                lastKnown,
                fieldConflicts: this.findFieldConflicts(eoRecord.fields, airtableRecord.fields)
            };
        }

        return null;
    }

    /**
     * Find specific fields with conflicts
     */
    findFieldConflicts(eoFields, airtableFields) {
        const conflicts = [];

        const allFields = new Set([
            ...Object.keys(eoFields),
            ...Object.keys(airtableFields)
        ]);

        for (const fieldName of allFields) {
            const eoValue = eoFields[fieldName]?.value ?? eoFields[fieldName];
            const airtableValue = airtableFields[fieldName]?.value ?? airtableFields[fieldName];

            if (JSON.stringify(eoValue) !== JSON.stringify(airtableValue)) {
                conflicts.push({
                    field: fieldName,
                    eoValue,
                    airtableValue
                });
            }
        }

        return conflicts;
    }

    /**
     * Apply changes (create/update/delete)
     */
    async applyChanges(changes, table) {
        // Resolve conflicts first
        for (const conflict of changes.conflicts) {
            await this.resolveConflict(conflict);
        }

        // Process creates
        for (const change of changes.toCreate) {
            await this.applyCreate(change);
        }

        // Process updates
        for (const change of changes.toUpdate) {
            await this.applyUpdate(change);
        }

        // Process deletes
        for (const change of changes.toDelete) {
            await this.applyDelete(change);
        }
    }

    /**
     * Resolve conflict using configured strategy
     */
    async resolveConflict(conflict) {
        console.log(`⚠️  Conflict detected for record ${conflict.eoRecord.id}`);

        this.emit('conflictDetected', conflict);

        let resolution;

        switch (this.syncConfig.conflictResolution) {
            case 'superposition':
                resolution = await this.resolveBySuperposition(conflict);
                break;

            case 'airtable_wins':
                resolution = { winner: 'airtable', record: conflict.airtableRecord };
                break;

            case 'eo_wins':
                resolution = { winner: 'eo', record: conflict.eoRecord };
                break;

            case 'newest_wins':
                resolution = this.resolveByNewest(conflict);
                break;

            default:
                resolution = await this.resolveBySuperposition(conflict);
        }

        // Apply resolution
        await this.applyConflictResolution(conflict, resolution);

        // Log to Xano
        await this.logConflictResolution(conflict, resolution);

        this.syncState.stats.conflictsResolved++;
        this.emit('conflictResolved', { conflict, resolution });

        console.log(`  ✓ Conflict resolved using: ${resolution.winner}`);
    }

    /**
     * Resolve conflict using EO Superposition (SUP)
     */
    async resolveBySuperposition(conflict) {
        // Create SUP value: both values coexist with different contexts
        const supValue = {
            value_1: {
                value: conflict.eoRecord.fields,
                method: 'declared',
                scale: 'individual',
                source: { system: 'eo-activibase' },
                agent: this.softr.getUserContext(),
                timestamp: conflict.eoRecord.lastModified
            },
            value_2: {
                value: conflict.airtableRecord.fields,
                method: 'measured',
                scale: 'organization',
                source: { system: 'airtable' },
                agent: { type: 'system', id: 'airtable' },
                timestamp: conflict.airtableRecord.lastModified
            },
            eoOperator: 'SUP',
            dominantValue: this.selectDominantValue(conflict)
        };

        return {
            winner: 'superposition',
            record: {
                ...conflict.eoRecord,
                fields: supValue,
                hasSuperposition: true
            }
        };
    }

    /**
     * Select dominant value for SUP display
     */
    selectDominantValue(conflict) {
        // Default: show Airtable value as dominant (source of truth)
        return 'value_2';
    }

    /**
     * Resolve by newest timestamp
     */
    resolveByNewest(conflict) {
        const eoTime = new Date(conflict.eoRecord.lastModified).getTime();
        const airtableTime = new Date(conflict.airtableRecord.lastModified).getTime();

        return airtableTime > eoTime
            ? { winner: 'airtable', record: conflict.airtableRecord }
            : { winner: 'eo', record: conflict.eoRecord };
    }

    /**
     * Apply conflict resolution
     */
    async applyConflictResolution(conflict, resolution) {
        if (resolution.winner === 'superposition') {
            // Update EO record with SUP
            await this.updateEORecord(resolution.record);

            // Keep Airtable as-is (it shows value_2)
        } else if (resolution.winner === 'airtable') {
            // Update EO to match Airtable
            await this.updateEORecord(conflict.airtableRecord);
        } else {
            // Update Airtable to match EO
            await this.airtable.upsertRecord(conflict.table.id, conflict.eoRecord);
        }
    }

    /**
     * Apply create change
     */
    async applyCreate(change) {
        if (change.direction === 'airtable_to_eo') {
            // Create in EO
            await this.createEORecord(change.record, change.table);
            this.syncState.stats.recordsCreated++;

            await this.logActivity({
                action: 'create',
                entityType: 'record',
                entityId: change.record.id,
                syncDirection: 'airtable_to_eo',
                after: change.record.fields
            });
        } else {
            // Create in Airtable
            const created = await this.airtable.upsertRecord(change.table.id, change.record);
            this.syncState.stats.recordsCreated++;

            await this.logActivity({
                action: 'create',
                entityType: 'record',
                entityId: created.id,
                syncDirection: 'eo_to_airtable',
                after: created.fields
            });
        }
    }

    /**
     * Apply update change
     */
    async applyUpdate(change) {
        if (change.direction === 'airtable_to_eo') {
            // Update EO
            await this.updateEORecord(change.record);
            this.syncState.stats.recordsUpdated++;

            await this.logActivity({
                action: 'update',
                entityType: 'record',
                entityId: change.record.id,
                syncDirection: 'airtable_to_eo',
                before: change.existing?.fields,
                after: change.record.fields
            });
        } else {
            // Update Airtable
            const updated = await this.airtable.upsertRecord(change.table.id, change.record);
            this.syncState.stats.recordsUpdated++;

            await this.logActivity({
                action: 'update',
                entityType: 'record',
                entityId: updated.id,
                syncDirection: 'eo_to_airtable',
                before: change.existing?.fields,
                after: updated.fields
            });
        }
    }

    /**
     * Apply delete change
     */
    async applyDelete(change) {
        if (change.direction === 'airtable_to_eo') {
            // Delete from EO
            await this.deleteEORecord(change.recordId);
            this.syncState.stats.recordsDeleted++;

            await this.logActivity({
                action: 'delete',
                entityType: 'record',
                entityId: change.recordId,
                syncDirection: 'airtable_to_eo'
            });
        }
    }

    /**
     * Get EO records for a table (stub - implement based on your EO data structure)
     */
    getEORecords(tableId) {
        // TODO: Implement based on your EO data structure
        // This should return records from the EO system that correspond to this Airtable table
        return [];
    }

    /**
     * Create EO record (stub)
     */
    async createEORecord(record, table) {
        // TODO: Implement EO record creation
        console.log(`Creating EO record: ${record.id} in table ${table.name}`);
    }

    /**
     * Update EO record (stub)
     */
    async updateEORecord(record) {
        // TODO: Implement EO record update
        console.log(`Updating EO record: ${record.id}`);
    }

    /**
     * Delete EO record (stub)
     */
    async deleteEORecord(recordId) {
        // TODO: Implement EO record deletion
        console.log(`Deleting EO record: ${recordId}`);
    }

    /**
     * Check if record has changed
     */
    hasChanged(record1, record2) {
        const checksum1 = this.calculateChecksum(record1.fields);
        const checksum2 = this.calculateChecksum(record2.fields);
        return checksum1 !== checksum2;
    }

    /**
     * Check if record is pending creation
     */
    isPendingCreate(record) {
        return this.changeTracker.eoChanges.has(record.id);
    }

    /**
     * Check if EO record has pending changes
     */
    hasEOChanges(record) {
        return this.changeTracker.eoChanges.has(record.id);
    }

    /**
     * Calculate checksum
     */
    calculateChecksum(data) {
        const normalized = JSON.stringify(data, Object.keys(data).sort());
        return this.simpleHash(normalized);
    }

    /**
     * Simple hash function
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Log activity to Xano
     */
    async logActivity(activity) {
        const fullActivity = {
            ...activity,
            ...this.softr.getUserContext(),
            tableId: activity.tableId,
            tableName: activity.tableName,
            baseId: this.airtable.baseId,
            syncSessionId: this.syncState.sessionId
        };

        await this.xano.queueActivity(fullActivity);
    }

    /**
     * Log sync activity
     */
    async logSyncActivity(activity) {
        await this.logActivity({
            entityType: 'sync',
            entityId: this.syncState.sessionId,
            ...activity
        });
    }

    /**
     * Log conflict resolution
     */
    async logConflictResolution(conflict, resolution) {
        await this.logActivity({
            action: 'conflict_resolved',
            entityType: 'record',
            entityId: conflict.eoRecord.id,
            conflictResolution: resolution.winner,
            before: conflict.eoRecord.fields,
            after: resolution.record.fields,
            metadata: {
                fieldConflicts: conflict.conflict.fieldConflicts
            }
        });
    }

    /**
     * Start auto-sync
     */
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            this.performFullSync().catch(error => {
                console.error('Auto-sync error:', error);
            });
        }, this.syncConfig.syncInterval);

        console.log(`✓ Auto-sync started (interval: ${this.syncConfig.syncInterval}ms)`);
    }

    /**
     * Stop auto-sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('✓ Auto-sync stopped');
        }
    }

    /**
     * Generate sync session ID
     */
    generateSyncSessionId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Event emitter
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Get sync statistics
     */
    getStats() {
        return {
            ...this.syncState.stats,
            isRunning: this.syncState.isRunning,
            lastSync: this.syncState.lastSync,
            pendingChanges: this.changeTracker.eoChanges.size,
            conflicts: this.syncState.conflicts.size
        };
    }

    /**
     * Get current sync status
     */
    getStatus() {
        return {
            sessionId: this.syncState.sessionId,
            isRunning: this.syncState.isRunning,
            lastSync: this.syncState.lastSync,
            config: this.syncConfig,
            stats: this.getStats()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncEngine;
}
