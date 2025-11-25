/**
 * EO Change Tracker
 *
 * Monitors and tracks changes in the EO system:
 * - Real-time change detection
 * - Activity logging integration
 * - Dirty state tracking
 * - Undo/redo support
 */

class ChangeTracker {
    constructor(config = {}) {
        this.xano = config.xano; // XanoIntegration instance
        this.softr = config.softr; // SoftrContext instance

        // Change tracking
        this.changes = new Map(); // entityId -> changes[]
        this.snapshots = new Map(); // entityId -> snapshot
        this.dirtyEntities = new Set(); // Set of entityIds with unsaved changes

        // Undo/redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;

        // Activity batching
        this.pendingActivities = [];
        this.batchInterval = null;
        this.batchDelay = config.batchDelay || 2000; // 2 seconds

        // Listeners
        this.listeners = {
            change: [],
            dirty: [],
            clean: [],
            undo: [],
            redo: []
        };

        // Auto-save configuration
        this.autoSave = {
            enabled: config.autoSave !== false,
            interval: config.autoSaveInterval || 30000, // 30 seconds
            handle: null
        };
    }

    /**
     * Initialize change tracker
     */
    initialize() {
        console.log('📊 Initializing Change Tracker...');

        // Start batch processing
        this.startBatchProcessing();

        // Start auto-save if enabled
        if (this.autoSave.enabled) {
            this.startAutoSave();
        }

        // Listen for window unload to flush pending changes
        window.addEventListener('beforeunload', (e) => {
            if (this.dirtyEntities.size > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                this.flush();
            }
        });

        console.log('✓ Change Tracker initialized');
    }

    /**
     * Track a change
     */
    trackChange(change) {
        const {
            entityType,
            entityId,
            entityName,
            action,
            before,
            after,
            field,
            tableId,
            tableName
        } = change;

        // Create change record
        const changeRecord = {
            id: this.generateChangeId(),
            timestamp: new Date().toISOString(),
            entityType,
            entityId,
            entityName,
            action,
            field,
            before,
            after,
            tableId,
            tableName,
            user: this.softr?.getUserContext() || null,
            checksumBefore: this.calculateChecksum(before),
            checksumAfter: this.calculateChecksum(after)
        };

        // Add to changes map
        if (!this.changes.has(entityId)) {
            this.changes.set(entityId, []);
        }
        this.changes.get(entityId).push(changeRecord);

        // Mark entity as dirty
        this.markDirty(entityId);

        // Add to undo stack
        this.addToUndoStack(changeRecord);

        // Clear redo stack on new change
        this.redoStack = [];

        // Queue for activity logging
        this.queueActivity(changeRecord);

        // Emit change event
        this.emit('change', changeRecord);

        console.log(`📝 Tracked change: ${action} on ${entityType} ${entityId}${field ? `.${field}` : ''}`);

        return changeRecord;
    }

    /**
     * Mark entity as dirty
     */
    markDirty(entityId) {
        const wasDirty = this.dirtyEntities.has(entityId);
        this.dirtyEntities.add(entityId);

        if (!wasDirty) {
            this.emit('dirty', { entityId, count: this.dirtyEntities.size });
        }
    }

    /**
     * Mark entity as clean
     */
    markClean(entityId) {
        const wasDirty = this.dirtyEntities.has(entityId);
        this.dirtyEntities.delete(entityId);

        if (wasDirty) {
            this.emit('clean', { entityId, count: this.dirtyEntities.size });
        }
    }

    /**
     * Check if entity is dirty
     */
    isDirty(entityId) {
        return this.dirtyEntities.has(entityId);
    }

    /**
     * Get all dirty entities
     */
    getDirtyEntities() {
        return Array.from(this.dirtyEntities);
    }

    /**
     * Create snapshot of current state
     */
    createSnapshot(entityId, data) {
        this.snapshots.set(entityId, {
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            checksum: this.calculateChecksum(data)
        });

        console.log(`📸 Created snapshot for ${entityId}`);
    }

    /**
     * Get snapshot
     */
    getSnapshot(entityId) {
        return this.snapshots.get(entityId);
    }

    /**
     * Compare with snapshot to detect changes
     */
    compareWithSnapshot(entityId, currentData) {
        const snapshot = this.snapshots.get(entityId);

        if (!snapshot) {
            return { hasChanged: false, changes: [] };
        }

        const currentChecksum = this.calculateChecksum(currentData);

        if (currentChecksum === snapshot.checksum) {
            return { hasChanged: false, changes: [] };
        }

        // Find specific field changes
        const changes = this.detectFieldChanges(snapshot.data, currentData);

        return {
            hasChanged: true,
            changes,
            snapshot
        };
    }

    /**
     * Detect field-level changes
     */
    detectFieldChanges(before, after) {
        const changes = [];
        const allFields = new Set([
            ...Object.keys(before || {}),
            ...Object.keys(after || {})
        ]);

        for (const field of allFields) {
            const beforeValue = before?.[field];
            const afterValue = after?.[field];

            if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
                changes.push({
                    field,
                    before: beforeValue,
                    after: afterValue,
                    type: this.getChangeType(beforeValue, afterValue)
                });
            }
        }

        return changes;
    }

    /**
     * Get change type
     */
    getChangeType(before, after) {
        if (before === undefined || before === null) return 'added';
        if (after === undefined || after === null) return 'removed';
        return 'modified';
    }

    /**
     * Get changes for entity
     */
    getChanges(entityId, options = {}) {
        const changes = this.changes.get(entityId) || [];

        let filtered = [...changes];

        if (options.since) {
            filtered = filtered.filter(c => c.timestamp >= options.since);
        }

        if (options.action) {
            filtered = filtered.filter(c => c.action === options.action);
        }

        if (options.field) {
            filtered = filtered.filter(c => c.field === options.field);
        }

        if (options.limit) {
            filtered = filtered.slice(-options.limit);
        }

        return filtered;
    }

    /**
     * Get all changes
     */
    getAllChanges(options = {}) {
        const allChanges = [];

        for (const changes of this.changes.values()) {
            allChanges.push(...changes);
        }

        // Sort by timestamp
        allChanges.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (options.limit) {
            return allChanges.slice(-options.limit);
        }

        return allChanges;
    }

    /**
     * Queue activity for batch logging
     */
    queueActivity(change) {
        if (!this.xano) {
            return;
        }

        const activity = {
            action: change.action,
            entityType: change.entityType,
            entityId: change.entityId,
            entityName: change.entityName,
            field: change.field,
            before: change.before,
            after: change.after,
            tableId: change.tableId,
            tableName: change.tableName,
            timestamp: change.timestamp,
            user: change.user,
            checksumBefore: change.checksumBefore,
            checksumAfter: change.checksumAfter
        };

        this.pendingActivities.push(activity);
    }

    /**
     * Process batch of activities
     */
    async processBatch() {
        if (this.pendingActivities.length === 0 || !this.xano) {
            return;
        }

        const batch = [...this.pendingActivities];
        this.pendingActivities = [];

        try {
            for (const activity of batch) {
                await this.xano.queueActivity(activity);
            }

            console.log(`✓ Queued ${batch.length} activities for logging`);
        } catch (error) {
            console.error('Failed to queue activities:', error);
            // Re-queue failed activities
            this.pendingActivities.unshift(...batch);
        }
    }

    /**
     * Start batch processing
     */
    startBatchProcessing() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }

        this.batchInterval = setInterval(() => {
            this.processBatch();
        }, this.batchDelay);

        console.log(`✓ Batch processing started (delay: ${this.batchDelay}ms)`);
    }

    /**
     * Stop batch processing
     */
    stopBatchProcessing() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
    }

    /**
     * Flush all pending changes immediately
     */
    async flush() {
        console.log('🔄 Flushing pending changes...');

        await this.processBatch();

        if (this.xano) {
            await this.xano.flush();
        }

        console.log('✓ All changes flushed');
    }

    /**
     * Add to undo stack
     */
    addToUndoStack(change) {
        this.undoStack.push(change);

        // Limit stack size
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
    }

    /**
     * Undo last change
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.warn('Nothing to undo');
            return null;
        }

        const change = this.undoStack.pop();

        // Apply undo (restore 'before' state)
        // This is a stub - actual implementation depends on your data structure
        console.log(`⏪ Undoing: ${change.action} on ${change.entityType} ${change.entityId}`);

        // Add to redo stack
        this.redoStack.push(change);

        // Emit undo event
        this.emit('undo', change);

        return change;
    }

    /**
     * Redo last undone change
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.warn('Nothing to redo');
            return null;
        }

        const change = this.redoStack.pop();

        // Apply redo (restore 'after' state)
        console.log(`⏩ Redoing: ${change.action} on ${change.entityType} ${change.entityId}`);

        // Add back to undo stack
        this.undoStack.push(change);

        // Emit redo event
        this.emit('redo', change);

        return change;
    }

    /**
     * Can undo?
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Can redo?
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Clear undo/redo stacks
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        console.log('✓ Undo/redo history cleared');
    }

    /**
     * Start auto-save
     */
    startAutoSave() {
        if (this.autoSave.handle) {
            clearInterval(this.autoSave.handle);
        }

        this.autoSave.handle = setInterval(() => {
            if (this.dirtyEntities.size > 0) {
                console.log('💾 Auto-saving dirty entities...');
                this.flush();
            }
        }, this.autoSave.interval);

        console.log(`✓ Auto-save started (interval: ${this.autoSave.interval}ms)`);
    }

    /**
     * Stop auto-save
     */
    stopAutoSave() {
        if (this.autoSave.handle) {
            clearInterval(this.autoSave.handle);
            this.autoSave.handle = null;
            console.log('✓ Auto-save stopped');
        }
    }

    /**
     * Calculate checksum
     */
    calculateChecksum(data) {
        if (!data) return null;
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
     * Generate change ID
     */
    generateChangeId() {
        return `chg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalChanges: this.getAllChanges().length,
            dirtyEntities: this.dirtyEntities.size,
            pendingActivities: this.pendingActivities.length,
            undoStack: this.undoStack.length,
            redoStack: this.redoStack.length,
            snapshots: this.snapshots.size
        };
    }

    /**
     * Clear all tracked changes
     */
    clear() {
        this.changes.clear();
        this.snapshots.clear();
        this.dirtyEntities.clear();
        this.undoStack = [];
        this.redoStack = [];
        this.pendingActivities = [];
        console.log('✓ Change tracker cleared');
    }

    /**
     * Event management
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangeTracker;
}
