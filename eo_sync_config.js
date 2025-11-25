/**
 * EO Sync Configuration Module
 *
 * Provides configuration interface for:
 * - Airtable API credentials
 * - Xano API credentials
 * - Sync settings
 * - Configuration persistence
 */

class SyncConfiguration {
    constructor() {
        // Configuration storage
        this.config = {
            airtable: {
                apiKey: null,
                baseId: null,
                tables: [] // List of table IDs to sync
            },
            xano: {
                baseUrl: null,
                authToken: null,
                activityEndpoint: '/activity',
                historyEndpoint: '/activity',
                snapshotEndpoint: '/activity/snapshot'
            },
            sync: {
                direction: 'bidirectional',
                conflictResolution: 'superposition',
                autoSync: true,
                syncInterval: 30000, // 30 seconds
                batchSize: 50
            },
            ui: {
                showSyncPanel: true,
                enableNotifications: true
            }
        };

        // Configuration UI elements
        this.elements = {
            modal: null,
            form: null
        };

        // Load saved configuration
        this.loadFromStorage();
    }

    /**
     * Show configuration modal
     */
    show() {
        if (!this.elements.modal) {
            this.createModal();
        }

        this.elements.modal.classList.remove('hidden');
        this.populateForm();
    }

    /**
     * Hide configuration modal
     */
    hide() {
        if (this.elements.modal) {
            this.elements.modal.classList.add('hidden');
        }
    }

    /**
     * Create configuration modal
     */
    createModal() {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
        backdrop.id = 'eo-sync-config-modal';

        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden';

        // Header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700';
        header.innerHTML = `
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">⚙️ Sync Configuration</h2>
            <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="window.eoSyncConfig.hide()">
                ✕
            </button>
        `;

        // Body
        const body = document.createElement('div');
        body.className = 'px-6 py-4 overflow-y-auto max-h-[70vh]';

        // Create form
        const form = this.createForm();
        body.appendChild(form);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700';
        footer.innerHTML = `
            <button class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md" onclick="window.eoSyncConfig.hide()">
                Cancel
            </button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md" onclick="window.eoSyncConfig.save()">
                Save Configuration
            </button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md" onclick="window.eoSyncConfig.testConnection()">
                Test & Save
            </button>
        `;

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        backdrop.appendChild(modal);

        document.body.appendChild(backdrop);

        this.elements.modal = backdrop;
        this.elements.form = form;

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.hide();
            }
        });
    }

    /**
     * Create configuration form
     */
    createForm() {
        const form = document.createElement('form');
        form.className = 'space-y-6';
        form.id = 'eo-sync-config-form';

        // Airtable section
        const airtableSection = this.createSection('Airtable Configuration', [
            {
                id: 'airtable-api-key',
                label: 'API Key',
                type: 'password',
                placeholder: 'key...',
                help: 'Get your API key from https://airtable.com/account',
                value: this.config.airtable.apiKey
            },
            {
                id: 'airtable-base-id',
                label: 'Base ID',
                type: 'text',
                placeholder: 'app...',
                help: 'Found in your Airtable base URL',
                value: this.config.airtable.baseId
            }
        ]);

        // Xano section
        const xanoSection = this.createSection('Xano Configuration', [
            {
                id: 'xano-base-url',
                label: 'Base URL',
                type: 'text',
                placeholder: 'https://x8ki-letl-twmt.n7.xano.io/api:xxxxx',
                help: 'Your Xano API base URL',
                value: this.config.xano.baseUrl
            },
            {
                id: 'xano-auth-token',
                label: 'Auth Token (Optional)',
                type: 'password',
                placeholder: 'Leave empty if not required',
                value: this.config.xano.authToken
            },
            {
                id: 'xano-activity-endpoint',
                label: 'Activity Endpoint',
                type: 'text',
                placeholder: '/activity',
                value: this.config.xano.activityEndpoint
            }
        ]);

        // Sync settings section
        const syncSection = this.createSection('Sync Settings', [
            {
                id: 'sync-direction',
                label: 'Sync Direction',
                type: 'select',
                options: [
                    { value: 'bidirectional', label: 'Bidirectional (Two-way)' },
                    { value: 'airtable_to_eo', label: 'Airtable → EO (One-way)' },
                    { value: 'eo_to_airtable', label: 'EO → Airtable (One-way)' }
                ],
                value: this.config.sync.direction
            },
            {
                id: 'conflict-resolution',
                label: 'Conflict Resolution',
                type: 'select',
                options: [
                    { value: 'superposition', label: 'Superposition (Keep both values)' },
                    { value: 'airtable_wins', label: 'Airtable Always Wins' },
                    { value: 'eo_wins', label: 'EO Always Wins' },
                    { value: 'newest_wins', label: 'Newest Timestamp Wins' }
                ],
                value: this.config.sync.conflictResolution
            },
            {
                id: 'auto-sync',
                label: 'Enable Auto-sync',
                type: 'checkbox',
                value: this.config.sync.autoSync
            },
            {
                id: 'sync-interval',
                label: 'Sync Interval (seconds)',
                type: 'number',
                min: 10,
                max: 3600,
                value: this.config.sync.syncInterval / 1000
            }
        ]);

        form.appendChild(airtableSection);
        form.appendChild(xanoSection);
        form.appendChild(syncSection);

        return form;
    }

    /**
     * Create configuration section
     */
    createSection(title, fields) {
        const section = document.createElement('div');
        section.className = 'space-y-4';

        const header = document.createElement('h3');
        header.className = 'text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2';
        header.textContent = title;

        section.appendChild(header);

        fields.forEach(field => {
            const fieldEl = this.createField(field);
            section.appendChild(fieldEl);
        });

        return section;
    }

    /**
     * Create form field
     */
    createField(field) {
        const container = document.createElement('div');
        container.className = 'space-y-1';

        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
        label.htmlFor = field.id;
        label.textContent = field.label;

        let input;

        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700';

            field.options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                if (option.value === field.value) {
                    optionEl.selected = true;
                }
                input.appendChild(optionEl);
            });
        } else if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'h-4 w-4 text-blue-600 rounded';
            input.checked = field.value;
        } else {
            input = document.createElement('input');
            input.type = field.type;
            input.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700';
            input.placeholder = field.placeholder || '';
            input.value = field.value || '';

            if (field.min !== undefined) input.min = field.min;
            if (field.max !== undefined) input.max = field.max;
        }

        input.id = field.id;

        container.appendChild(label);
        container.appendChild(input);

        if (field.help) {
            const help = document.createElement('p');
            help.className = 'text-xs text-gray-500 dark:text-gray-400';
            help.textContent = field.help;
            container.appendChild(help);
        }

        return container;
    }

    /**
     * Populate form with current values
     */
    populateForm() {
        // Form is already populated in createForm()
        // This method can be used to refresh values if needed
    }

    /**
     * Save configuration
     */
    save() {
        const form = this.elements.form;

        // Read values from form
        this.config.airtable.apiKey = form.querySelector('#airtable-api-key').value;
        this.config.airtable.baseId = form.querySelector('#airtable-base-id').value;

        this.config.xano.baseUrl = form.querySelector('#xano-base-url').value;
        this.config.xano.authToken = form.querySelector('#xano-auth-token').value;
        this.config.xano.activityEndpoint = form.querySelector('#xano-activity-endpoint').value;

        this.config.sync.direction = form.querySelector('#sync-direction').value;
        this.config.sync.conflictResolution = form.querySelector('#conflict-resolution').value;
        this.config.sync.autoSync = form.querySelector('#auto-sync').checked;
        this.config.sync.syncInterval = parseInt(form.querySelector('#sync-interval').value) * 1000;

        // Validate
        const validation = this.validate();

        if (!validation.isValid) {
            alert(`Configuration Error:\n${validation.errors.join('\n')}`);
            return false;
        }

        // Save to localStorage
        this.saveToStorage();

        console.log('✓ Configuration saved');

        // Notify user
        this.showNotification('Configuration saved successfully!', 'success');

        // Close modal
        this.hide();

        return true;
    }

    /**
     * Test connection and save if successful
     */
    async testConnection() {
        // First save to get the values
        if (!this.save()) {
            return;
        }

        this.showNotification('Testing connections...', 'info');

        try {
            // Test Airtable connection
            const airtable = new AirtableIntegration({
                apiKey: this.config.airtable.apiKey,
                baseId: this.config.airtable.baseId
            });

            await airtable.initialize();
            console.log('✓ Airtable connection successful');

            // Test Xano connection
            const xano = new XanoIntegration({
                baseUrl: this.config.xano.baseUrl,
                authToken: this.config.xano.authToken,
                activityEndpoint: this.config.xano.activityEndpoint
            });

            await xano.initialize();
            console.log('✓ Xano connection successful');

            this.showNotification('All connections successful!', 'success');

        } catch (error) {
            console.error('Connection test failed:', error);
            this.showNotification(`Connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        // Airtable validation
        if (!this.config.airtable.apiKey) {
            errors.push('Airtable API Key is required');
        } else if (!this.config.airtable.apiKey.startsWith('key')) {
            errors.push('Airtable API Key should start with "key"');
        }

        if (!this.config.airtable.baseId) {
            errors.push('Airtable Base ID is required');
        } else if (!this.config.airtable.baseId.startsWith('app')) {
            errors.push('Airtable Base ID should start with "app"');
        }

        // Xano validation
        if (!this.config.xano.baseUrl) {
            errors.push('Xano Base URL is required');
        } else if (!this.config.xano.baseUrl.startsWith('http')) {
            errors.push('Xano Base URL must be a valid URL');
        }

        // Sync validation
        if (this.config.sync.syncInterval < 10000) {
            errors.push('Sync interval must be at least 10 seconds');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Load configuration from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('eo_sync_config');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.config = { ...this.config, ...parsed };
                console.log('✓ Configuration loaded from storage');
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    /**
     * Save configuration to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('eo_sync_config', JSON.stringify(this.config));
            console.log('✓ Configuration saved to storage');
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }

    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveToStorage();
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        if (confirm('Are you sure you want to reset all configuration to defaults?')) {
            localStorage.removeItem('eo_sync_config');
            location.reload();
        }
    }

    /**
     * Export configuration as JSON
     */
    exportConfig() {
        const data = JSON.stringify(this.config, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'eo-sync-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import configuration from JSON file
     */
    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    this.config = { ...this.config, ...config };
                    this.saveToStorage();
                    this.showNotification('Configuration imported successfully!', 'success');
                    this.populateForm();
                } catch (error) {
                    this.showNotification(`Import failed: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
        } text-white`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncConfiguration;
}

// Global reference for inline event handlers
window.eoSyncConfig = null;
