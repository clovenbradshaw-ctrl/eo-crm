/**
 * EO Airtable Sync - Main Integration
 *
 * This is the main entry point for the Airtable integration system.
 * It initializes and coordinates all modules:
 * - Airtable API integration
 * - Xano activity logging
 * - Softr user context
 * - Sync engine with conflict resolution
 * - Change tracking
 * - Rewind functionality
 * - Views integration
 * - UI controls
 */

class EOAirtableSync {
    constructor() {
        // Configuration
        this.configManager = new SyncConfiguration();

        // Core integrations
        this.airtable = null;
        this.xano = null;
        this.softr = null;

        // Engines
        this.syncEngine = null;
        this.rewindEngine = null;
        this.changeTracker = null;
        this.viewsIntegration = null;

        // UI
        this.syncUI = null;

        // State
        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the entire sync system
     */
    async initialize(config = null) {
        console.log('🚀 Initializing EO Airtable Sync System...');

        try {
            // Load configuration
            if (config) {
                this.configManager.updateConfig(config);
            }

            const cfg = this.configManager.getConfig();

            // Step 1: Initialize Softr context (detect user)
            console.log('1/7 Initializing Softr context...');
            this.softr = new SoftrContext({
                enablePostMessage: true,
                enableUrlParams: true,
                enableLocalStorage: true
            });
            await this.softr.initialize();

            // Step 2: Initialize Airtable integration
            console.log('2/7 Initializing Airtable integration...');
            this.airtable = new AirtableIntegration({
                apiKey: cfg.airtable.apiKey,
                baseId: cfg.airtable.baseId
            });
            await this.airtable.initialize();

            // Step 3: Initialize Xano integration
            console.log('3/7 Initializing Xano integration...');
            this.xano = new XanoIntegration({
                baseUrl: cfg.xano.baseUrl,
                authToken: cfg.xano.authToken,
                activityEndpoint: cfg.xano.activityEndpoint,
                historyEndpoint: cfg.xano.historyEndpoint,
                snapshotEndpoint: cfg.xano.snapshotEndpoint
            });
            await this.xano.initialize();

            // Step 4: Initialize change tracker
            console.log('4/7 Initializing change tracker...');
            this.changeTracker = new ChangeTracker({
                xano: this.xano,
                softr: this.softr,
                autoSave: true,
                batchDelay: 2000
            });
            this.changeTracker.initialize();

            // Step 5: Initialize sync engine
            console.log('5/7 Initializing sync engine...');
            this.syncEngine = new SyncEngine({
                airtable: this.airtable,
                xano: this.xano,
                softr: this.softr,
                direction: cfg.sync.direction,
                conflictResolution: cfg.sync.conflictResolution,
                autoSync: cfg.sync.autoSync,
                syncInterval: cfg.sync.syncInterval,
                batchSize: cfg.sync.batchSize
            });
            await this.syncEngine.initialize();

            // Step 6: Initialize rewind engine
            console.log('6/7 Initializing rewind engine...');
            this.rewindEngine = new RewindEngine({
                xano: this.xano,
                softr: this.softr,
                changeTracker: this.changeTracker
            });
            this.rewindEngine.initialize();

            // Step 7: Initialize views integration
            console.log('7/7 Initializing views integration...');
            this.viewsIntegration = new AirtableViewsIntegration({
                airtable: this.airtable,
                viewManager: null // TODO: Connect to EO view management system
            });
            await this.viewsIntegration.initialize();

            // Initialize UI
            if (cfg.ui.showSyncPanel) {
                this.initializeUI();
            }

            this.initialized = true;
            this.isRunning = true;

            console.log('✅ EO Airtable Sync System initialized successfully!');

            // Log initialization to Xano
            await this.xano.logActivity({
                action: 'system_initialized',
                entityType: 'system',
                entityId: 'eo-airtable-sync',
                metadata: {
                    user: this.softr.getUser(),
                    config: {
                        syncDirection: cfg.sync.direction,
                        conflictResolution: cfg.sync.conflictResolution,
                        autoSync: cfg.sync.autoSync
                    }
                }
            });

            return {
                success: true,
                user: this.softr.getUser(),
                tables: this.airtable.getTables(),
                views: this.viewsIntegration.getSyncedViews(),
                syncStatus: this.syncEngine.getStatus()
            };

        } catch (error) {
            console.error('❌ Failed to initialize EO Airtable Sync:', error);
            throw error;
        }
    }

    /**
     * Initialize UI
     */
    initializeUI() {
        console.log('🎨 Initializing Sync UI...');

        this.syncUI = new SyncUI({
            syncEngine: this.syncEngine,
            rewindEngine: this.rewindEngine,
            changeTracker: this.changeTracker,
            airtable: this.airtable
        });

        this.syncUI.initialize();

        // Make globally accessible for inline event handlers
        window.eoSyncUI = this.syncUI;
        window.eoSyncConfig = this.configManager;

        console.log('✓ Sync UI initialized');
    }

    /**
     * Show configuration modal
     */
    showConfig() {
        this.configManager.show();
    }

    /**
     * Perform manual sync
     */
    async sync() {
        if (!this.initialized) {
            throw new Error('System not initialized. Call initialize() first.');
        }

        console.log('🔄 Starting manual sync...');

        return await this.syncEngine.performFullSync();
    }

    /**
     * Rewind entity to previous state
     */
    async rewind(entityId, timestamp) {
        if (!this.initialized) {
            throw new Error('System not initialized. Call initialize() first.');
        }

        return await this.rewindEngine.rewindTo(entityId, timestamp);
    }

    /**
     * Get sync status
     */
    getStatus() {
        if (!this.initialized) {
            return {
                initialized: false,
                isRunning: false
            };
        }

        return {
            initialized: this.initialized,
            isRunning: this.isRunning,
            user: this.softr.getUser(),
            syncStatus: this.syncEngine.getStatus(),
            changeTrackerStats: this.changeTracker.getStats(),
            airtableStats: this.airtable.getSyncStats(),
            xanoQueueStatus: this.xano.getQueueStatus(),
            viewsStats: this.viewsIntegration.getStats()
        };
    }

    /**
     * Get activity history
     */
    async getHistory(options = {}) {
        if (!this.initialized) {
            throw new Error('System not initialized. Call initialize() first.');
        }

        return await this.xano.getHistory(options);
    }

    /**
     * Get timeline for entity
     */
    async getTimeline(entityId, options = {}) {
        if (!this.initialized) {
            throw new Error('System not initialized. Call initialize() first.');
        }

        return await this.xano.getTimeline(entityId, options);
    }

    /**
     * Shutdown system
     */
    async shutdown() {
        console.log('🛑 Shutting down EO Airtable Sync System...');

        // Flush pending changes
        if (this.changeTracker) {
            await this.changeTracker.flush();
        }

        // Stop auto-sync
        if (this.syncEngine) {
            this.syncEngine.stopAutoSync();
        }

        // Stop batch processing
        if (this.xano) {
            this.xano.stopBatchProcessing();
            await this.xano.flush();
        }

        // Log shutdown
        if (this.xano) {
            await this.xano.logActivity({
                action: 'system_shutdown',
                entityType: 'system',
                entityId: 'eo-airtable-sync',
                user: this.softr?.getUserContext()
            });
        }

        this.isRunning = false;

        console.log('✓ System shutdown complete');
    }

    /**
     * Get API instances (for advanced usage)
     */
    getAPIs() {
        return {
            airtable: this.airtable,
            xano: this.xano,
            softr: this.softr,
            syncEngine: this.syncEngine,
            rewindEngine: this.rewindEngine,
            changeTracker: this.changeTracker,
            viewsIntegration: this.viewsIntegration
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EOAirtableSync;
}

// Global initialization helper
window.initializeEOAirtableSync = async function(config = null) {
    // Create instance
    window.eoSync = new EOAirtableSync();

    try {
        // Initialize
        const result = await window.eoSync.initialize(config);

        console.log('✅ EO Airtable Sync ready!');
        console.log('User:', result.user.name);
        console.log('Tables:', result.tables.length);
        console.log('Views:', result.views.length);

        // Make configuration accessible
        window.showSyncConfig = () => window.eoSync.showConfig();

        return result;
    } catch (error) {
        console.error('Failed to initialize:', error);

        // Show configuration modal if initialization failed
        if (!config) {
            console.log('Opening configuration modal...');
            window.eoSync.showConfig();
        }

        throw error;
    }
};

// Auto-initialize if config exists in localStorage
document.addEventListener('DOMContentLoaded', async () => {
    const storedConfig = localStorage.getItem('eo_sync_config');

    if (storedConfig) {
        console.log('Found stored configuration, auto-initializing...');

        try {
            await window.initializeEOAirtableSync();
        } catch (error) {
            console.error('Auto-initialization failed:', error);
        }
    } else {
        console.log('No configuration found. Call initializeEOAirtableSync() or showSyncConfig() to get started.');

        // Create config manager for first-time setup
        window.eoSyncConfig = new SyncConfiguration();
    }
});
