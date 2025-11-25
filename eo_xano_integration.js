/**
 * EO Xano Integration Module
 *
 * Provides Xano API integration for:
 * - Activity logging (PUT operations)
 * - History retrieval (GET operations)
 * - Change tracking and audit trail
 * - Rewind/rollback functionality
 */

class XanoIntegration {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || null; // e.g., 'https://x8ki-letl-twmt.n7.xano.io/api:xxxxx'
        this.authToken = config.authToken || null;

        // Activity endpoints
        this.endpoints = {
            logActivity: config.activityEndpoint || '/activity',
            getHistory: config.historyEndpoint || '/activity',
            getSnapshot: config.snapshotEndpoint || '/activity/snapshot'
        };

        // Local activity cache for offline support
        this.activityCache = [];
        this.maxCacheSize = 1000;

        // Pending activities queue (for batch operations)
        this.pendingQueue = [];
        this.batchInterval = null;
        this.batchSize = 10;
        this.batchIntervalMs = 5000; // 5 seconds
    }

    /**
     * Initialize Xano connection and verify endpoints
     */
    async initialize() {
        if (!this.baseUrl) {
            throw new Error('Xano base URL is required');
        }

        try {
            // Test connection
            const testResponse = await this.apiRequest(this.endpoints.getHistory, {
                method: 'GET'
            });

            console.log('✓ Connected to Xano activity API');

            // Start batch processing
            this.startBatchProcessing();

            return {
                success: true,
                endpoint: this.baseUrl
            };
        } catch (error) {
            console.error('Failed to initialize Xano connection:', error);
            throw error;
        }
    }

    /**
     * Log activity to Xano (PUT operation)
     */
    async logActivity(activity) {
        const activityRecord = this.normalizeActivity(activity);

        try {
            const response = await this.apiRequest(this.endpoints.logActivity, {
                method: 'PUT',
                body: JSON.stringify(activityRecord)
            });

            // Add to local cache
            this.addToCache(activityRecord);

            console.log(`✓ Logged activity: ${activity.action} by ${activity.user?.name || 'system'}`);

            return response;
        } catch (error) {
            console.error('Failed to log activity to Xano:', error);

            // Add to pending queue for retry
            this.pendingQueue.push(activityRecord);

            throw error;
        }
    }

    /**
     * Queue activity for batch logging (more efficient for multiple changes)
     */
    queueActivity(activity) {
        const activityRecord = this.normalizeActivity(activity);
        this.pendingQueue.push(activityRecord);

        console.log(`Queued activity: ${activity.action} (queue size: ${this.pendingQueue.length})`);
    }

    /**
     * Normalize activity into consistent format
     */
    normalizeActivity(activity) {
        return {
            // Core identification
            activity_id: activity.id || this.generateActivityId(),
            timestamp: activity.timestamp || new Date().toISOString(),

            // User context (from Softr)
            user_id: activity.user?.id || null,
            user_email: activity.user?.email || null,
            user_name: activity.user?.name || null,

            // Action details
            action: activity.action, // 'create', 'update', 'delete', 'sync'
            entity_type: activity.entityType, // 'record', 'field', 'view', 'table'
            entity_id: activity.entityId,
            entity_name: activity.entityName || null,

            // Data context
            table_id: activity.tableId || null,
            table_name: activity.tableName || null,
            base_id: activity.baseId || null,

            // Change tracking
            before: activity.before || null, // State before change
            after: activity.after || null, // State after change
            changes: activity.changes || null, // Detailed field-level changes
            checksum_before: activity.checksumBefore || null,
            checksum_after: activity.checksumAfter || null,

            // Sync metadata
            sync_direction: activity.syncDirection || null, // 'airtable_to_eo', 'eo_to_airtable', 'bidirectional'
            sync_session_id: activity.syncSessionId || null,
            conflict_resolution: activity.conflictResolution || null,

            // EO-specific context
            eo_operator: activity.eoOperator || null,
            eo_position: activity.eoPosition || null,
            context: activity.context || null,

            // Source tracking
            source_system: activity.sourceSystem || 'eo-activibase',
            source_url: activity.sourceUrl || null,

            // Additional metadata
            metadata: activity.metadata || {},
            tags: activity.tags || []
        };
    }

    /**
     * Generate unique activity ID
     */
    generateActivityId() {
        return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get activity history from Xano (GET operation)
     */
    async getHistory(options = {}) {
        const params = new URLSearchParams({
            ...(options.entityType && { entity_type: options.entityType }),
            ...(options.entityId && { entity_id: options.entityId }),
            ...(options.userId && { user_id: options.userId }),
            ...(options.startDate && { start_date: options.startDate }),
            ...(options.endDate && { end_date: options.endDate }),
            ...(options.action && { action: options.action }),
            ...(options.limit && { limit: options.limit.toString() }),
            ...(options.offset && { offset: options.offset.toString() })
        });

        const url = `${this.endpoints.getHistory}${params.toString() ? '?' + params.toString() : ''}`;

        try {
            const response = await this.apiRequest(url, { method: 'GET' });

            console.log(`✓ Retrieved ${response.items?.length || 0} activity records`);

            return {
                items: response.items || response,
                total: response.total || response.length,
                offset: response.offset || 0,
                limit: response.limit || options.limit
            };
        } catch (error) {
            console.error('Failed to retrieve history from Xano:', error);
            throw error;
        }
    }

    /**
     * Get snapshot at a specific point in time
     */
    async getSnapshot(entityId, timestamp) {
        try {
            const response = await this.apiRequest(
                `${this.endpoints.getSnapshot}?entity_id=${entityId}&timestamp=${timestamp}`,
                { method: 'GET' }
            );

            console.log(`✓ Retrieved snapshot for ${entityId} at ${timestamp}`);

            return response;
        } catch (error) {
            console.error('Failed to retrieve snapshot from Xano:', error);
            throw error;
        }
    }

    /**
     * Rewind entity to previous state
     */
    async rewind(entityId, targetTimestamp) {
        console.log(`⏪ Rewinding ${entityId} to ${targetTimestamp}`);

        // Get snapshot at target time
        const snapshot = await this.getSnapshot(entityId, targetTimestamp);

        if (!snapshot || !snapshot.data) {
            throw new Error(`No snapshot found for ${entityId} at ${targetTimestamp}`);
        }

        // Get activity that led to this state
        const activity = await this.getHistory({
            entityId,
            endDate: targetTimestamp,
            limit: 1
        });

        return {
            snapshot: snapshot.data,
            activity: activity.items?.[0] || null,
            timestamp: targetTimestamp,
            entityId
        };
    }

    /**
     * Get change timeline for an entity
     */
    async getTimeline(entityId, options = {}) {
        const history = await this.getHistory({
            entityId,
            ...options
        });

        // Build timeline with before/after states
        const timeline = history.items.map((activity, index) => {
            const previous = history.items[index + 1] || null;

            return {
                timestamp: activity.timestamp,
                action: activity.action,
                user: {
                    id: activity.user_id,
                    name: activity.user_name,
                    email: activity.user_email
                },
                changes: this.calculateChanges(previous?.after, activity.after),
                before: activity.before,
                after: activity.after,
                canRewind: index < history.items.length - 1
            };
        });

        return timeline;
    }

    /**
     * Calculate field-level changes between two states
     */
    calculateChanges(before, after) {
        if (!before || !after) return [];

        const changes = [];

        // Compare all fields
        const allFields = new Set([
            ...Object.keys(before),
            ...Object.keys(after)
        ]);

        for (const field of allFields) {
            const beforeValue = before[field];
            const afterValue = after[field];

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
     * Determine type of change
     */
    getChangeType(before, after) {
        if (before === undefined || before === null) return 'added';
        if (after === undefined || after === null) return 'removed';
        return 'modified';
    }

    /**
     * Batch process pending activities
     */
    async processBatch() {
        if (this.pendingQueue.length === 0) {
            return;
        }

        const batch = this.pendingQueue.splice(0, this.batchSize);

        try {
            const response = await this.apiRequest(this.endpoints.logActivity, {
                method: 'PUT',
                body: JSON.stringify({ activities: batch })
            });

            // Add to cache
            batch.forEach(activity => this.addToCache(activity));

            console.log(`✓ Logged batch of ${batch.length} activities`);

            return response;
        } catch (error) {
            console.error('Failed to log batch to Xano:', error);

            // Re-queue failed activities
            this.pendingQueue.unshift(...batch);

            throw error;
        }
    }

    /**
     * Start automatic batch processing
     */
    startBatchProcessing() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }

        this.batchInterval = setInterval(() => {
            if (this.pendingQueue.length > 0) {
                this.processBatch().catch(err => {
                    console.error('Batch processing error:', err);
                });
            }
        }, this.batchIntervalMs);

        console.log(`✓ Started batch processing (interval: ${this.batchIntervalMs}ms)`);
    }

    /**
     * Stop batch processing
     */
    stopBatchProcessing() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
            console.log('✓ Stopped batch processing');
        }
    }

    /**
     * Add activity to local cache
     */
    addToCache(activity) {
        this.activityCache.unshift(activity);

        // Trim cache if too large
        if (this.activityCache.length > this.maxCacheSize) {
            this.activityCache = this.activityCache.slice(0, this.maxCacheSize);
        }
    }

    /**
     * Search local cache (for quick lookups without API call)
     */
    searchCache(options = {}) {
        let results = [...this.activityCache];

        if (options.entityId) {
            results = results.filter(a => a.entity_id === options.entityId);
        }

        if (options.userId) {
            results = results.filter(a => a.user_id === options.userId);
        }

        if (options.action) {
            results = results.filter(a => a.action === options.action);
        }

        if (options.startDate) {
            results = results.filter(a => a.timestamp >= options.startDate);
        }

        if (options.endDate) {
            results = results.filter(a => a.timestamp <= options.endDate);
        }

        return results.slice(0, options.limit || 100);
    }

    /**
     * Get activity statistics
     */
    getStats(options = {}) {
        const activities = options.useCache ? this.activityCache : [];

        const stats = {
            total: activities.length,
            byAction: {},
            byUser: {},
            byEntityType: {},
            recentActivity: activities.slice(0, 10)
        };

        activities.forEach(activity => {
            // By action
            stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;

            // By user
            if (activity.user_id) {
                stats.byUser[activity.user_id] = (stats.byUser[activity.user_id] || 0) + 1;
            }

            // By entity type
            stats.byEntityType[activity.entity_type] = (stats.byEntityType[activity.entity_type] || 0) + 1;
        });

        return stats;
    }

    /**
     * Make API request to Xano
     */
    async apiRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
            ...options.headers
        };

        const requestOptions = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`Xano API error: ${error.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Xano API request failed:', error);
            throw error;
        }
    }

    /**
     * Flush all pending activities immediately
     */
    async flush() {
        console.log(`🔄 Flushing ${this.pendingQueue.length} pending activities...`);

        while (this.pendingQueue.length > 0) {
            await this.processBatch();
        }

        console.log('✓ All pending activities flushed');
    }

    /**
     * Clear local cache
     */
    clearCache() {
        this.activityCache = [];
        console.log('✓ Activity cache cleared');
    }

    /**
     * Get pending queue status
     */
    getQueueStatus() {
        return {
            pending: this.pendingQueue.length,
            cached: this.activityCache.length,
            batchSize: this.batchSize,
            batchInterval: this.batchIntervalMs
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XanoIntegration;
}
