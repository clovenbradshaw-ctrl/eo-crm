/**
 * EO Sync UI Module
 *
 * Provides user interface for:
 * - Sync status display
 * - Manual sync controls
 * - Conflict resolution UI
 * - Activity timeline
 * - Rewind controls
 */

class SyncUI {
    constructor(config = {}) {
        this.syncEngine = config.syncEngine; // SyncEngine instance
        this.rewindEngine = config.rewindEngine; // RewindEngine instance
        this.changeTracker = config.changeTracker; // ChangeTracker instance
        this.airtable = config.airtable; // AirtableIntegration instance

        // UI elements (will be created dynamically)
        this.elements = {
            container: null,
            statusPanel: null,
            controlPanel: null,
            activityPanel: null,
            conflictPanel: null,
            rewindPanel: null
        };

        // UI state
        this.state = {
            isVisible: true,
            activePanel: 'status',
            selectedConflict: null,
            selectedActivity: null
        };
    }

    /**
     * Initialize UI
     */
    initialize() {
        console.log('🎨 Initializing Sync UI...');

        // Create UI structure
        this.createUI();

        // Set up event listeners
        this.setupEventListeners();

        // Start status updates
        this.startStatusUpdates();

        console.log('✓ Sync UI initialized');
    }

    /**
     * Create UI structure
     */
    createUI() {
        // Create main container
        this.elements.container = this.createElement('div', {
            id: 'eo-sync-ui',
            className: 'fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-96 max-h-[600px] overflow-hidden z-50'
        });

        // Create header
        const header = this.createHeader();
        this.elements.container.appendChild(header);

        // Create tab navigation
        const tabs = this.createTabs();
        this.elements.container.appendChild(tabs);

        // Create panels
        this.elements.statusPanel = this.createStatusPanel();
        this.elements.controlPanel = this.createControlPanel();
        this.elements.activityPanel = this.createActivityPanel();
        this.elements.conflictPanel = this.createConflictPanel();
        this.elements.rewindPanel = this.createRewindPanel();

        // Create panel container
        const panelContainer = this.createElement('div', {
            className: 'p-4 overflow-y-auto max-h-[500px]'
        });

        panelContainer.appendChild(this.elements.statusPanel);
        panelContainer.appendChild(this.elements.controlPanel);
        panelContainer.appendChild(this.elements.activityPanel);
        panelContainer.appendChild(this.elements.conflictPanel);
        panelContainer.appendChild(this.elements.rewindPanel);

        this.elements.container.appendChild(panelContainer);

        // Add to document
        document.body.appendChild(this.elements.container);

        // Show default panel
        this.showPanel('status');
    }

    /**
     * Create header
     */
    createHeader() {
        const header = this.createElement('div', {
            className: 'flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
        });

        const title = this.createElement('h3', {
            className: 'text-sm font-semibold text-gray-900 dark:text-white',
            textContent: '🔄 Airtable Sync'
        });

        const controls = this.createElement('div', {
            className: 'flex items-center gap-2'
        });

        // Minimize button
        const minimizeBtn = this.createElement('button', {
            className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            innerHTML: '−',
            onclick: () => this.toggleMinimize()
        });

        controls.appendChild(minimizeBtn);
        header.appendChild(title);
        header.appendChild(controls);

        return header;
    }

    /**
     * Create tabs
     */
    createTabs() {
        const tabsContainer = this.createElement('div', {
            className: 'flex border-b border-gray-200 dark:border-gray-700'
        });

        const tabs = [
            { id: 'status', label: 'Status', icon: '📊' },
            { id: 'controls', label: 'Controls', icon: '⚙️' },
            { id: 'activity', label: 'Activity', icon: '📝' },
            { id: 'conflicts', label: 'Conflicts', icon: '⚠️' },
            { id: 'rewind', label: 'Rewind', icon: '⏪' }
        ];

        tabs.forEach(tab => {
            const button = this.createElement('button', {
                id: `tab-${tab.id}`,
                className: 'flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent',
                textContent: `${tab.icon} ${tab.label}`,
                onclick: () => this.showPanel(tab.id)
            });

            tabsContainer.appendChild(button);
        });

        return tabsContainer;
    }

    /**
     * Create status panel
     */
    createStatusPanel() {
        const panel = this.createElement('div', {
            id: 'panel-status',
            className: 'space-y-4 hidden'
        });

        // Sync status
        const syncStatus = this.createElement('div', {
            id: 'sync-status',
            className: 'space-y-2'
        });

        panel.appendChild(syncStatus);

        // Stats
        const stats = this.createElement('div', {
            id: 'sync-stats',
            className: 'grid grid-cols-2 gap-2'
        });

        panel.appendChild(stats);

        return panel;
    }

    /**
     * Create control panel
     */
    createControlPanel() {
        const panel = this.createElement('div', {
            id: 'panel-controls',
            className: 'space-y-3 hidden'
        });

        // Manual sync button
        const syncBtn = this.createElement('button', {
            className: 'w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium',
            textContent: '🔄 Sync Now',
            onclick: () => this.handleManualSync()
        });

        panel.appendChild(syncBtn);

        // Auto-sync toggle
        const autoSyncToggle = this.createToggle('Auto-sync', true, (enabled) => {
            if (enabled) {
                this.syncEngine.startAutoSync();
            } else {
                this.syncEngine.stopAutoSync();
            }
        });

        panel.appendChild(autoSyncToggle);

        // Sync direction select
        const directionSelect = this.createSelect('Sync Direction', [
            { value: 'bidirectional', label: 'Bidirectional' },
            { value: 'airtable_to_eo', label: 'Airtable → EO' },
            { value: 'eo_to_airtable', label: 'EO → Airtable' }
        ], this.syncEngine.syncConfig.direction, (value) => {
            this.syncEngine.syncConfig.direction = value;
        });

        panel.appendChild(directionSelect);

        // Conflict resolution select
        const conflictSelect = this.createSelect('Conflict Resolution', [
            { value: 'superposition', label: 'Superposition (SUP)' },
            { value: 'airtable_wins', label: 'Airtable Wins' },
            { value: 'eo_wins', label: 'EO Wins' },
            { value: 'newest_wins', label: 'Newest Wins' }
        ], this.syncEngine.syncConfig.conflictResolution, (value) => {
            this.syncEngine.syncConfig.conflictResolution = value;
        });

        panel.appendChild(conflictSelect);

        return panel;
    }

    /**
     * Create activity panel
     */
    createActivityPanel() {
        const panel = this.createElement('div', {
            id: 'panel-activity',
            className: 'space-y-2 hidden'
        });

        const activityList = this.createElement('div', {
            id: 'activity-list',
            className: 'space-y-2'
        });

        panel.appendChild(activityList);

        return panel;
    }

    /**
     * Create conflict panel
     */
    createConflictPanel() {
        const panel = this.createElement('div', {
            id: 'panel-conflicts',
            className: 'space-y-2 hidden'
        });

        const conflictList = this.createElement('div', {
            id: 'conflict-list',
            className: 'space-y-2'
        });

        panel.appendChild(conflictList);

        return panel;
    }

    /**
     * Create rewind panel
     */
    createRewindPanel() {
        const panel = this.createElement('div', {
            id: 'panel-rewind',
            className: 'space-y-3 hidden'
        });

        // Timeline
        const timeline = this.createElement('div', {
            id: 'rewind-timeline',
            className: 'space-y-2'
        });

        panel.appendChild(timeline);

        return panel;
    }

    /**
     * Show panel
     */
    showPanel(panelId) {
        // Hide all panels
        Object.values(this.elements).forEach(el => {
            if (el && el.id && el.id.startsWith('panel-')) {
                el.classList.add('hidden');
            }
        });

        // Remove active state from all tabs
        document.querySelectorAll('[id^="tab-"]').forEach(tab => {
            tab.classList.remove('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
            tab.classList.add('border-transparent');
        });

        // Show selected panel
        const panel = document.getElementById(`panel-${panelId}`);
        if (panel) {
            panel.classList.remove('hidden');
        }

        // Activate tab
        const tab = document.getElementById(`tab-${panelId}`);
        if (tab) {
            tab.classList.add('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
            tab.classList.remove('border-transparent');
        }

        this.state.activePanel = panelId;

        // Update panel content
        this.updatePanel(panelId);
    }

    /**
     * Update panel content
     */
    updatePanel(panelId) {
        switch (panelId) {
            case 'status':
                this.updateStatusPanel();
                break;
            case 'activity':
                this.updateActivityPanel();
                break;
            case 'conflicts':
                this.updateConflictPanel();
                break;
            case 'rewind':
                this.updateRewindPanel();
                break;
        }
    }

    /**
     * Update status panel
     */
    updateStatusPanel() {
        const status = this.syncEngine.getStatus();
        const stats = this.syncEngine.getStats();

        const statusEl = document.getElementById('sync-status');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                    <span class="text-sm ${status.isRunning ? 'text-green-600' : 'text-gray-600'}">
                        ${status.isRunning ? '🔄 Syncing...' : '✓ Idle'}
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Last Sync:</span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">
                        ${status.lastSync ? this.formatTime(status.lastSync) : 'Never'}
                    </span>
                </div>
            `;
        }

        const statsEl = document.getElementById('sync-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2">
                    <div class="text-xs text-gray-600 dark:text-gray-400">Created</div>
                    <div class="text-lg font-semibold text-blue-600 dark:text-blue-400">${stats.recordsCreated}</div>
                </div>
                <div class="bg-green-50 dark:bg-green-900/20 rounded-md p-2">
                    <div class="text-xs text-gray-600 dark:text-gray-400">Updated</div>
                    <div class="text-lg font-semibold text-green-600 dark:text-green-400">${stats.recordsUpdated}</div>
                </div>
                <div class="bg-red-50 dark:bg-red-900/20 rounded-md p-2">
                    <div class="text-xs text-gray-600 dark:text-gray-400">Deleted</div>
                    <div class="text-lg font-semibold text-red-600 dark:text-red-400">${stats.recordsDeleted}</div>
                </div>
                <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-2">
                    <div class="text-xs text-gray-600 dark:text-gray-400">Conflicts</div>
                    <div class="text-lg font-semibold text-yellow-600 dark:text-yellow-400">${stats.conflictsResolved}</div>
                </div>
            `;
        }
    }

    /**
     * Update activity panel
     */
    updateActivityPanel() {
        if (!this.changeTracker) return;

        const activities = this.changeTracker.getAllChanges({ limit: 20 });
        const listEl = document.getElementById('activity-list');

        if (listEl) {
            listEl.innerHTML = activities.length === 0
                ? '<div class="text-sm text-gray-500 text-center py-4">No recent activity</div>'
                : activities.map(activity => `
                    <div class="bg-gray-50 dark:bg-gray-900 rounded-md p-2 text-xs">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-medium text-gray-900 dark:text-white">${this.formatAction(activity.action)}</span>
                            <span class="text-gray-500 dark:text-gray-400">${this.formatTime(activity.timestamp)}</span>
                        </div>
                        <div class="text-gray-600 dark:text-gray-400">${activity.entityType}: ${activity.entityId}</div>
                        ${activity.field ? `<div class="text-gray-500 dark:text-gray-500">Field: ${activity.field}</div>` : ''}
                    </div>
                `).join('');
        }
    }

    /**
     * Update conflict panel
     */
    updateConflictPanel() {
        const conflicts = this.syncEngine.syncState.conflicts;
        const listEl = document.getElementById('conflict-list');

        if (listEl) {
            if (conflicts.size === 0) {
                listEl.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">No conflicts</div>';
            } else {
                listEl.innerHTML = Array.from(conflicts.values()).map(conflict => `
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-xs">
                        <div class="font-medium text-gray-900 dark:text-white mb-2">
                            Record: ${conflict.recordId}
                        </div>
                        <div class="text-gray-600 dark:text-gray-400 mb-2">
                            ${conflict.fieldConflicts?.length || 0} field(s) in conflict
                        </div>
                        <button class="text-blue-600 hover:text-blue-700 dark:text-blue-400" onclick="window.eoSyncUI.resolveConflict('${conflict.recordId}')">
                            Resolve →
                        </button>
                    </div>
                `).join('');
            }
        }
    }

    /**
     * Update rewind panel
     */
    updateRewindPanel() {
        // Placeholder - would show timeline and rewind controls
        const timelineEl = document.getElementById('rewind-timeline');

        if (timelineEl) {
            timelineEl.innerHTML = `
                <div class="text-sm text-gray-500 text-center py-4">
                    Select an entity to view its history
                </div>
            `;
        }
    }

    /**
     * Handle manual sync
     */
    async handleManualSync() {
        try {
            await this.syncEngine.performFullSync();
            this.updatePanel(this.state.activePanel);
        } catch (error) {
            console.error('Manual sync failed:', error);
            alert(`Sync failed: ${error.message}`);
        }
    }

    /**
     * Resolve conflict
     */
    resolveConflict(recordId) {
        // Placeholder - would show conflict resolution UI
        console.log(`Resolving conflict for ${recordId}`);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for sync events
        this.syncEngine.on('syncStart', () => {
            this.updateStatusPanel();
        });

        this.syncEngine.on('syncComplete', () => {
            this.updateStatusPanel();
            this.updateActivityPanel();
        });

        this.syncEngine.on('conflictDetected', () => {
            this.updateConflictPanel();
        });

        // Listen for change tracker events
        if (this.changeTracker) {
            this.changeTracker.on('change', () => {
                this.updateActivityPanel();
            });
        }
    }

    /**
     * Start status updates
     */
    startStatusUpdates() {
        setInterval(() => {
            if (this.state.activePanel === 'status') {
                this.updateStatusPanel();
            }
        }, 1000);
    }

    /**
     * Toggle minimize
     */
    toggleMinimize() {
        const container = this.elements.container;
        if (container.classList.contains('h-12')) {
            container.classList.remove('h-12');
            this.state.isVisible = true;
        } else {
            container.classList.add('h-12');
            this.state.isVisible = false;
        }
    }

    /**
     * Helper: Create element
     */
    createElement(tag, props = {}) {
        const el = document.createElement(tag);

        Object.entries(props).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'textContent') {
                el.textContent = value;
            } else if (key === 'innerHTML') {
                el.innerHTML = value;
            } else if (key.startsWith('on')) {
                el.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        });

        return el;
    }

    /**
     * Helper: Create toggle
     */
    createToggle(label, defaultValue, onChange) {
        const container = this.createElement('div', {
            className: 'flex items-center justify-between'
        });

        const labelEl = this.createElement('label', {
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300',
            textContent: label
        });

        const input = this.createElement('input', {
            type: 'checkbox',
            checked: defaultValue,
            className: 'h-4 w-4 text-blue-600 rounded',
            onchange: (e) => onChange(e.target.checked)
        });

        container.appendChild(labelEl);
        container.appendChild(input);

        return container;
    }

    /**
     * Helper: Create select
     */
    createSelect(label, options, defaultValue, onChange) {
        const container = this.createElement('div', {
            className: 'space-y-1'
        });

        const labelEl = this.createElement('label', {
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300',
            textContent: label
        });

        const select = this.createElement('select', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700',
            onchange: (e) => onChange(e.target.value)
        });

        options.forEach(option => {
            const optionEl = this.createElement('option', {
                value: option.value,
                textContent: option.label
            });

            if (option.value === defaultValue) {
                optionEl.selected = true;
            }

            select.appendChild(optionEl);
        });

        container.appendChild(labelEl);
        container.appendChild(select);

        return container;
    }

    /**
     * Helper: Format time
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    /**
     * Helper: Format action
     */
    formatAction(action) {
        const actionMap = {
            create: '➕ Created',
            update: '✏️ Updated',
            delete: '🗑️ Deleted',
            sync: '🔄 Synced',
            rewind: '⏪ Rewound'
        };

        return actionMap[action] || action;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncUI;
}

// Global reference for inline event handlers
window.eoSyncUI = null;
