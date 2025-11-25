/**
 * EO Rewind Module
 *
 * Provides time-travel functionality using Xano activity history:
 * - Rewind to previous states
 * - Preview changes before applying
 * - Rollback with validation
 * - Timeline visualization
 */

class RewindEngine {
    constructor(config = {}) {
        this.xano = config.xano; // XanoIntegration instance
        this.softr = config.softr; // SoftrContext instance
        this.changeTracker = config.changeTracker; // ChangeTracker instance

        // Rewind state
        this.rewindState = {
            isRewinding: false,
            previewMode: false,
            currentSnapshot: null,
            targetSnapshot: null,
            timeline: []
        };

        // Preview cache
        this.previewCache = new Map(); // timestamp -> preview data

        // Listeners
        this.listeners = {
            rewindStart: [],
            rewindComplete: [],
            rewindCancel: [],
            previewReady: []
        };
    }

    /**
     * Initialize rewind engine
     */
    initialize() {
        console.log('⏪ Initializing Rewind Engine...');

        if (!this.xano) {
            throw new Error('Xano integration is required for rewind functionality');
        }

        console.log('✓ Rewind Engine initialized');
    }

    /**
     * Get timeline for an entity
     */
    async getTimeline(entityId, options = {}) {
        console.log(`📅 Loading timeline for ${entityId}...`);

        try {
            const timeline = await this.xano.getTimeline(entityId, options);

            this.rewindState.timeline = timeline;

            console.log(`✓ Loaded ${timeline.length} timeline entries`);

            return timeline;
        } catch (error) {
            console.error('Failed to load timeline:', error);
            throw error;
        }
    }

    /**
     * Preview state at a specific point in time
     */
    async previewAtTime(entityId, timestamp) {
        console.log(`👁️  Previewing ${entityId} at ${timestamp}...`);

        // Check cache first
        const cacheKey = `${entityId}:${timestamp}`;
        if (this.previewCache.has(cacheKey)) {
            console.log('  (from cache)');
            return this.previewCache.get(cacheKey);
        }

        try {
            // Get snapshot from Xano
            const snapshot = await this.xano.getSnapshot(entityId, timestamp);

            if (!snapshot || !snapshot.data) {
                console.warn('No snapshot found at this time');
                return null;
            }

            // Get activity history up to this point
            const history = await this.xano.getHistory({
                entityId,
                endDate: timestamp,
                limit: 10
            });

            const preview = {
                entityId,
                timestamp,
                data: snapshot.data,
                activity: history.items?.[0] || null,
                canRewind: true,
                nextStates: await this.getNextStates(entityId, timestamp),
                previousStates: await this.getPreviousStates(entityId, timestamp)
            };

            // Cache preview
            this.previewCache.set(cacheKey, preview);

            // Emit preview ready event
            this.emit('previewReady', preview);

            console.log('✓ Preview ready');

            return preview;
        } catch (error) {
            console.error('Failed to preview:', error);
            throw error;
        }
    }

    /**
     * Get next states in timeline
     */
    async getNextStates(entityId, currentTimestamp, limit = 5) {
        const history = await this.xano.getHistory({
            entityId,
            startDate: currentTimestamp,
            limit: limit + 1 // +1 to exclude current
        });

        return (history.items || []).slice(1); // Skip current
    }

    /**
     * Get previous states in timeline
     */
    async getPreviousStates(entityId, currentTimestamp, limit = 5) {
        const history = await this.xano.getHistory({
            entityId,
            endDate: currentTimestamp,
            limit: limit + 1 // +1 to exclude current
        });

        return (history.items || []).slice(1); // Skip current
    }

    /**
     * Rewind to a specific state
     */
    async rewindTo(entityId, targetTimestamp, options = {}) {
        if (this.rewindState.isRewinding) {
            throw new Error('Rewind already in progress');
        }

        this.rewindState.isRewinding = true;
        this.emit('rewindStart', { entityId, targetTimestamp });

        console.log(`⏪ Rewinding ${entityId} to ${targetTimestamp}...`);

        try {
            // Get target state
            const targetState = await this.xano.rewind(entityId, targetTimestamp);

            if (!targetState || !targetState.snapshot) {
                throw new Error('Target state not found');
            }

            // Validate rewind if requested
            if (options.validate) {
                const validation = await this.validateRewind(entityId, targetState);

                if (!validation.isValid) {
                    throw new Error(`Rewind validation failed: ${validation.reason}`);
                }
            }

            // Preview mode: don't actually apply changes
            if (options.preview) {
                this.rewindState.previewMode = true;
                this.rewindState.targetSnapshot = targetState;

                console.log('✓ Preview mode: changes not applied');

                return {
                    preview: true,
                    targetState,
                    changes: this.calculateRewindChanges(entityId, targetState)
                };
            }

            // Take snapshot of current state before rewinding
            const currentState = await this.captureCurrentState(entityId);
            this.rewindState.currentSnapshot = currentState;

            // Apply rewind
            const result = await this.applyRewind(entityId, targetState, options);

            // Log rewind activity
            await this.logRewindActivity(entityId, currentState, targetState);

            // Update change tracker
            if (this.changeTracker) {
                this.changeTracker.trackChange({
                    entityType: 'record',
                    entityId,
                    action: 'rewind',
                    before: currentState,
                    after: targetState.snapshot,
                    timestamp: targetTimestamp
                });
            }

            this.emit('rewindComplete', { entityId, targetState, result });

            console.log('✓ Rewind complete');

            return result;

        } catch (error) {
            console.error('Rewind failed:', error);
            this.emit('rewindCancel', { entityId, error });
            throw error;
        } finally {
            this.rewindState.isRewinding = false;
        }
    }

    /**
     * Validate rewind operation
     */
    async validateRewind(entityId, targetState) {
        // Check if target state exists
        if (!targetState.snapshot) {
            return {
                isValid: false,
                reason: 'Target state not found'
            };
        }

        // Check if entity has been deleted
        const currentState = await this.captureCurrentState(entityId);
        if (!currentState) {
            return {
                isValid: false,
                reason: 'Entity no longer exists'
            };
        }

        // Check for conflicts with pending changes
        if (this.changeTracker && this.changeTracker.isDirty(entityId)) {
            return {
                isValid: false,
                reason: 'Entity has unsaved changes. Save or discard before rewinding.'
            };
        }

        // Check timestamp validity
        const targetTime = new Date(targetState.timestamp).getTime();
        const now = Date.now();

        if (targetTime > now) {
            return {
                isValid: false,
                reason: 'Cannot rewind to future state'
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Calculate changes that would be made by rewind
     */
    calculateRewindChanges(entityId, targetState) {
        // This is a stub - implement based on your data structure
        return {
            fieldsChanged: [],
            fieldsAdded: [],
            fieldsRemoved: []
        };
    }

    /**
     * Capture current state of entity
     */
    async captureCurrentState(entityId) {
        // This is a stub - implement based on your data structure
        // Should return current entity data
        return {
            entityId,
            timestamp: new Date().toISOString(),
            data: {} // Current entity data
        };
    }

    /**
     * Apply rewind to entity
     */
    async applyRewind(entityId, targetState, options = {}) {
        console.log(`  Applying rewind to ${entityId}...`);

        // This is a stub - implement based on your data structure
        // Should:
        // 1. Update entity with targetState.snapshot data
        // 2. Handle any dependent entities
        // 3. Trigger UI updates

        const result = {
            entityId,
            timestamp: targetState.timestamp,
            applied: true,
            changes: this.calculateRewindChanges(entityId, targetState)
        };

        console.log(`  ✓ Rewind applied`);

        return result;
    }

    /**
     * Log rewind activity to Xano
     */
    async logRewindActivity(entityId, beforeState, afterState) {
        if (!this.xano) return;

        const activity = {
            action: 'rewind',
            entityType: 'record',
            entityId,
            before: beforeState,
            after: afterState.snapshot,
            metadata: {
                targetTimestamp: afterState.timestamp,
                rewindActivity: afterState.activity
            },
            ...this.softr?.getUserContext()
        };

        await this.xano.logActivity(activity);
    }

    /**
     * Cancel preview mode
     */
    cancelPreview() {
        if (!this.rewindState.previewMode) {
            console.warn('Not in preview mode');
            return;
        }

        this.rewindState.previewMode = false;
        this.rewindState.targetSnapshot = null;

        console.log('✓ Preview cancelled');
    }

    /**
     * Apply previewed rewind
     */
    async applyPreview() {
        if (!this.rewindState.previewMode || !this.rewindState.targetSnapshot) {
            throw new Error('No preview to apply');
        }

        const targetState = this.rewindState.targetSnapshot;
        this.rewindState.previewMode = false;

        console.log('✓ Applying previewed rewind...');

        return await this.rewindTo(targetState.entityId, targetState.timestamp, {
            preview: false
        });
    }

    /**
     * Fast-forward to a later state
     */
    async fastForwardTo(entityId, targetTimestamp, options = {}) {
        console.log(`⏩ Fast-forwarding ${entityId} to ${targetTimestamp}...`);

        // Fast-forward is essentially the same as rewind, just to a later point
        return await this.rewindTo(entityId, targetTimestamp, options);
    }

    /**
     * Step backward one change
     */
    async stepBackward(entityId) {
        const timeline = await this.getTimeline(entityId, { limit: 2 });

        if (timeline.length < 2) {
            console.warn('No previous state available');
            return null;
        }

        const previousState = timeline[1]; // Index 0 is current

        return await this.rewindTo(entityId, previousState.timestamp);
    }

    /**
     * Step forward one change
     */
    async stepForward(entityId) {
        const currentTime = new Date().toISOString();
        const nextStates = await this.getNextStates(entityId, currentTime, 1);

        if (nextStates.length === 0) {
            console.warn('No next state available');
            return null;
        }

        const nextState = nextStates[0];

        return await this.fastForwardTo(entityId, nextState.timestamp);
    }

    /**
     * Get rewind options for entity (all available restore points)
     */
    async getRewindOptions(entityId, options = {}) {
        const history = await this.xano.getHistory({
            entityId,
            ...options
        });

        return (history.items || []).map(activity => ({
            timestamp: activity.timestamp,
            action: activity.action,
            user: {
                id: activity.user_id,
                name: activity.user_name,
                email: activity.user_email
            },
            changes: activity.changes || [],
            canRewind: true
        }));
    }

    /**
     * Compare two states
     */
    async compareStates(entityId, timestamp1, timestamp2) {
        console.log(`🔍 Comparing states at ${timestamp1} vs ${timestamp2}...`);

        const [state1, state2] = await Promise.all([
            this.xano.getSnapshot(entityId, timestamp1),
            this.xano.getSnapshot(entityId, timestamp2)
        ]);

        const comparison = {
            timestamp1,
            timestamp2,
            state1: state1?.data,
            state2: state2?.data,
            differences: this.findDifferences(state1?.data, state2?.data)
        };

        console.log(`✓ Found ${comparison.differences.length} differences`);

        return comparison;
    }

    /**
     * Find differences between two states
     */
    findDifferences(state1, state2) {
        const differences = [];
        const allFields = new Set([
            ...Object.keys(state1 || {}),
            ...Object.keys(state2 || {})
        ]);

        for (const field of allFields) {
            const value1 = state1?.[field];
            const value2 = state2?.[field];

            if (JSON.stringify(value1) !== JSON.stringify(value2)) {
                differences.push({
                    field,
                    before: value1,
                    after: value2,
                    type: this.getChangeType(value1, value2)
                });
            }
        }

        return differences;
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
     * Clear preview cache
     */
    clearCache() {
        this.previewCache.clear();
        console.log('✓ Preview cache cleared');
    }

    /**
     * Get rewind state
     */
    getState() {
        return {
            isRewinding: this.rewindState.isRewinding,
            previewMode: this.rewindState.previewMode,
            hasCurrentSnapshot: !!this.rewindState.currentSnapshot,
            hasTargetSnapshot: !!this.rewindState.targetSnapshot,
            timelineLength: this.rewindState.timeline.length
        };
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
    module.exports = RewindEngine;
}
