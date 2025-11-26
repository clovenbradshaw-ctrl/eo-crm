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
                tables: [], // List of table IDs to sync
                schema: null // Cached schema from Meta API
            },
            xano: {
                baseUrl: null,
                authToken: null,
                // PUT endpoint - for writing activity logs
                activityEndpoint: '/activity',
                // GET endpoints - for reading data
                historyEndpoint: '/activity',
                snapshotEndpoint: '/activity/snapshot',
                timelineEndpoint: '/activity/timeline' // New: for building timelines
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
        } else {
            // Recreate form to ensure fresh state with updated placeholders
            const body = this.elements.modal.querySelector('.px-6.py-4');
            body.innerHTML = '';
            const form = this.createForm();
            body.appendChild(form);
            this.elements.form = form;
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

        // Xano section - with clear PUT/GET operation labels
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
                label: '📤 PUT Endpoint - Activity Logs',
                type: 'text',
                placeholder: '/activity',
                help: 'PUT endpoint for storing activity logs',
                value: this.config.xano.activityEndpoint
            },
            {
                id: 'xano-history-endpoint',
                label: '📥 GET Endpoint - History',
                type: 'text',
                placeholder: '/activity',
                help: 'GET endpoint for retrieving activity history',
                value: this.config.xano.historyEndpoint
            },
            {
                id: 'xano-snapshot-endpoint',
                label: '📥 GET Endpoint - Snapshot (Optional)',
                type: 'text',
                placeholder: '/activity/snapshot',
                help: 'GET endpoint for fetching point-in-time snapshots',
                value: this.config.xano.snapshotEndpoint
            },
            {
                id: 'xano-timeline-endpoint',
                label: '📥 GET Endpoint - Timeline (Optional)',
                type: 'text',
                placeholder: '/activity/timeline',
                help: 'GET endpoint for building entity timelines',
                value: this.config.xano.timelineEndpoint
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
     * Shows placeholders for saved credentials to indicate they're protected
     */
    populateForm() {
        if (!this.elements.form) return;

        const form = this.elements.form;

        // Update credential fields with placeholders if already saved
        if (this.config.airtable.apiKey) {
            const apiKeyField = form.querySelector('#airtable-api-key');
            apiKeyField.placeholder = '••••••••••••• (saved)';
            apiKeyField.value = ''; // Don't show actual key for security
        }

        if (this.config.airtable.baseId) {
            const baseIdField = form.querySelector('#airtable-base-id');
            baseIdField.placeholder = `${this.config.airtable.baseId.substring(0, 7)}••• (saved)`;
            baseIdField.value = ''; // Don't show actual ID
        }

        if (this.config.xano.baseUrl) {
            const baseUrlField = form.querySelector('#xano-base-url');
            baseUrlField.value = this.config.xano.baseUrl; // Show URL as it's less sensitive
        }

        if (this.config.xano.authToken) {
            const authTokenField = form.querySelector('#xano-auth-token');
            authTokenField.placeholder = '••••••••••••• (saved)';
            authTokenField.value = ''; // Don't show actual token for security
        }

        // Populate endpoint fields
        if (this.config.xano.activityEndpoint) {
            form.querySelector('#xano-activity-endpoint').value = this.config.xano.activityEndpoint;
        }

        if (this.config.xano.historyEndpoint) {
            form.querySelector('#xano-history-endpoint').value = this.config.xano.historyEndpoint;
        }

        if (this.config.xano.snapshotEndpoint) {
            form.querySelector('#xano-snapshot-endpoint').value = this.config.xano.snapshotEndpoint;
        }

        if (this.config.xano.timelineEndpoint) {
            form.querySelector('#xano-timeline-endpoint').value = this.config.xano.timelineEndpoint;
        }

        // Populate sync settings
        form.querySelector('#sync-direction').value = this.config.sync.direction;
        form.querySelector('#conflict-resolution').value = this.config.sync.conflictResolution;
        form.querySelector('#auto-sync').checked = this.config.sync.autoSync;
        form.querySelector('#sync-interval').value = this.config.sync.syncInterval / 1000;
    }

    /**
     * Save configuration
     * IMPORTANT: Prevents accidental credential overwrite from blank fields
     */
    save() {
        const form = this.elements.form;

        // Store old values for comparison
        const oldConfig = JSON.parse(JSON.stringify(this.config));

        // Read values from form with credential protection
        // Only update if field has a value OR no existing credential exists
        const airtableApiKey = form.querySelector('#airtable-api-key').value.trim();
        if (airtableApiKey || !this.config.airtable.apiKey) {
            this.config.airtable.apiKey = airtableApiKey;
        }

        const airtableBaseId = form.querySelector('#airtable-base-id').value.trim();
        if (airtableBaseId || !this.config.airtable.baseId) {
            this.config.airtable.baseId = airtableBaseId;
        }

        const xanoBaseUrl = form.querySelector('#xano-base-url').value.trim();
        if (xanoBaseUrl || !this.config.xano.baseUrl) {
            this.config.xano.baseUrl = xanoBaseUrl;
        }

        const xanoAuthToken = form.querySelector('#xano-auth-token').value.trim();
        if (xanoAuthToken || !this.config.xano.authToken) {
            this.config.xano.authToken = xanoAuthToken;
        }

        const activityEndpoint = form.querySelector('#xano-activity-endpoint').value.trim();
        if (activityEndpoint || !this.config.xano.activityEndpoint) {
            this.config.xano.activityEndpoint = activityEndpoint;
        }

        // Read Xano GET endpoints
        const historyEndpoint = form.querySelector('#xano-history-endpoint')?.value.trim();
        if (historyEndpoint !== undefined) {
            if (historyEndpoint || !this.config.xano.historyEndpoint) {
                this.config.xano.historyEndpoint = historyEndpoint;
            }
        }

        const snapshotEndpoint = form.querySelector('#xano-snapshot-endpoint')?.value.trim();
        if (snapshotEndpoint !== undefined) {
            if (snapshotEndpoint || !this.config.xano.snapshotEndpoint) {
                this.config.xano.snapshotEndpoint = snapshotEndpoint;
            }
        }

        const timelineEndpoint = form.querySelector('#xano-timeline-endpoint')?.value.trim();
        if (timelineEndpoint !== undefined) {
            if (timelineEndpoint || !this.config.xano.timelineEndpoint) {
                this.config.xano.timelineEndpoint = timelineEndpoint;
            }
        }

        // Non-credential fields (always update)
        this.config.sync.direction = form.querySelector('#sync-direction').value;
        this.config.sync.conflictResolution = form.querySelector('#conflict-resolution').value;
        this.config.sync.autoSync = form.querySelector('#auto-sync').checked;
        this.config.sync.syncInterval = parseInt(form.querySelector('#sync-interval').value) * 1000;

        // Check for credential changes and warn user
        const credentialChanges = this.detectCredentialChanges(oldConfig, this.config);
        if (credentialChanges.length > 0 && !confirm(
            `You are about to update the following credentials:\n\n${credentialChanges.join('\n')}\n\nAre you sure you want to continue?`
        )) {
            // Restore old config
            this.config = oldConfig;
            return false;
        }

        // Validate
        const validation = this.validate();

        if (!validation.isValid) {
            alert(`Configuration Error:\n${validation.errors.join('\n')}`);
            // Restore old config on validation failure
            this.config = oldConfig;
            return false;
        }

        // Save to localStorage
        this.saveToStorage();

        console.log('✓ Configuration saved');

        // Log what was preserved
        const preserved = this.detectPreservedCredentials(form);
        if (preserved.length > 0) {
            console.log(`🔒 Preserved existing credentials: ${preserved.join(', ')}`);
        }

        // Notify user
        this.showNotification('Configuration saved successfully!', 'success');

        // Close modal
        this.hide();

        return true;
    }

    /**
     * Detect which credentials were preserved (not overwritten by blank fields)
     */
    detectPreservedCredentials(form) {
        const preserved = [];

        if (!form.querySelector('#airtable-api-key').value.trim() && this.config.airtable.apiKey) {
            preserved.push('Airtable API Key');
        }
        if (!form.querySelector('#airtable-base-id').value.trim() && this.config.airtable.baseId) {
            preserved.push('Airtable Base ID');
        }
        if (!form.querySelector('#xano-base-url').value.trim() && this.config.xano.baseUrl) {
            preserved.push('Xano Base URL');
        }
        if (!form.querySelector('#xano-auth-token').value.trim() && this.config.xano.authToken) {
            preserved.push('Xano Auth Token');
        }

        return preserved;
    }

    /**
     * Detect credential changes between old and new config
     */
    detectCredentialChanges(oldConfig, newConfig) {
        const changes = [];

        if (oldConfig.airtable.apiKey !== newConfig.airtable.apiKey && newConfig.airtable.apiKey) {
            changes.push('• Airtable API Key');
        }
        if (oldConfig.airtable.baseId !== newConfig.airtable.baseId && newConfig.airtable.baseId) {
            changes.push('• Airtable Base ID');
        }
        if (oldConfig.xano.baseUrl !== newConfig.xano.baseUrl && newConfig.xano.baseUrl) {
            changes.push('• Xano Base URL');
        }
        if (oldConfig.xano.authToken !== newConfig.xano.authToken && newConfig.xano.authToken) {
            changes.push('• Xano Auth Token');
        }

        return changes;
    }

    /**
     * Test connection and save if successful
     * Tests all endpoints: Airtable (Meta API + Base API) and Xano (PUT + all GET endpoints)
     */
    async testConnection() {
        // First save to get the values
        if (!this.save()) {
            return;
        }

        this.showNotification('Testing connections...', 'info');

        const results = {
            airtable: { metaApi: false, baseApi: false },
            xano: { put: false, getHistory: false, getSnapshot: false, getTimeline: false }
        };

        try {
            // Test Airtable Meta API (schema fetching)
            console.log('Testing Airtable Meta API...');
            await this.fetchAirtableSchema();
            results.airtable.metaApi = true;
            console.log('✓ Airtable Meta API successful');

            // Test Airtable Base API (data fetching)
            console.log('Testing Airtable Base API...');
            const airtable = new AirtableIntegration({
                apiKey: this.config.airtable.apiKey,
                baseId: this.config.airtable.baseId
            });

            await airtable.initialize();
            results.airtable.baseApi = true;
            console.log('✓ Airtable Base API successful');

            // Test Xano PUT endpoint (activity logging)
            console.log('Testing Xano PUT endpoint...');
            const xano = new XanoIntegration({
                baseUrl: this.config.xano.baseUrl,
                authToken: this.config.xano.authToken,
                activityEndpoint: this.config.xano.activityEndpoint,
                historyEndpoint: this.config.xano.historyEndpoint,
                snapshotEndpoint: this.config.xano.snapshotEndpoint,
                timelineEndpoint: this.config.xano.timelineEndpoint
            });

            // Test PUT endpoint with a test activity
            try {
                await xano.logActivity({
                    action: 'test',
                    entityType: 'connection_test',
                    entityId: 'test',
                    user: { id: 'system', name: 'System Test' }
                });
                results.xano.put = true;
                console.log('✓ Xano PUT endpoint successful');
            } catch (error) {
                console.warn('⚠ Xano PUT endpoint failed:', error.message);
            }

            // Test GET History endpoint
            console.log('Testing Xano GET History endpoint...');
            try {
                await xano.getHistory({ limit: 1 });
                results.xano.getHistory = true;
                console.log('✓ Xano GET History endpoint successful');
            } catch (error) {
                console.warn('⚠ Xano GET History endpoint failed:', error.message);
            }

            // Test GET Snapshot endpoint (optional)
            if (this.config.xano.snapshotEndpoint) {
                console.log('Testing Xano GET Snapshot endpoint...');
                try {
                    await xano.getSnapshot('test', new Date().toISOString());
                    results.xano.getSnapshot = true;
                    console.log('✓ Xano GET Snapshot endpoint successful');
                } catch (error) {
                    console.warn('⚠ Xano GET Snapshot endpoint failed (optional):', error.message);
                }
            }

            // Test GET Timeline endpoint (optional)
            if (this.config.xano.timelineEndpoint) {
                console.log('Testing Xano GET Timeline endpoint...');
                try {
                    await xano.getTimeline('test');
                    results.xano.getTimeline = true;
                    console.log('✓ Xano GET Timeline endpoint successful');
                } catch (error) {
                    console.warn('⚠ Xano GET Timeline endpoint failed (optional):', error.message);
                }
            }

            // Show detailed results
            const successCount = Object.values(results.airtable).filter(v => v).length +
                                Object.values(results.xano).filter(v => v).length;
            const totalTests = Object.values(results.airtable).length +
                              Object.values(results.xano).length;

            this.showNotification(
                `Connection tests complete: ${successCount}/${totalTests} successful`,
                successCount === totalTests ? 'success' : 'warning'
            );

            // Log detailed results
            console.log('Connection test results:', results);

        } catch (error) {
            console.error('Connection test failed:', error);
            this.showNotification(`Connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Fetch Airtable schema using Meta API
     * This is the schema-driven approach - automatically mirrors your Airtable schema
     */
    async fetchAirtableSchema() {
        if (!this.config.airtable.apiKey || !this.config.airtable.baseId) {
            throw new Error('Airtable credentials required');
        }

        const url = `https://api.airtable.com/v0/meta/bases/${this.config.airtable.baseId}/tables`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.config.airtable.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Airtable Meta API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Cache the schema
        this.config.airtable.schema = {
            tables: data.tables || [],
            fetchedAt: new Date().toISOString()
        };

        console.log(`✓ Fetched schema for ${data.tables.length} tables from Airtable`);

        // Update tables list
        this.config.airtable.tables = data.tables.map(table => ({
            id: table.id,
            name: table.name,
            primaryFieldId: table.primaryFieldId,
            fields: table.fields
        }));

        // Save updated config with schema
        this.saveToStorage();

        return this.config.airtable.schema;
    }

    /**
     * Validate configuration
     * Enhanced validation to prevent incomplete configuration saves
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Airtable validation
        if (!this.config.airtable.apiKey) {
            errors.push('Airtable API Key is required');
        } else {
            if (!this.config.airtable.apiKey.startsWith('key')) {
                errors.push('Airtable API Key should start with "key"');
            }
            if (this.config.airtable.apiKey.length < 17) {
                errors.push('Airtable API Key appears to be incomplete');
            }
        }

        if (!this.config.airtable.baseId) {
            errors.push('Airtable Base ID is required');
        } else {
            if (!this.config.airtable.baseId.startsWith('app')) {
                errors.push('Airtable Base ID should start with "app"');
            }
            if (this.config.airtable.baseId.length < 17) {
                errors.push('Airtable Base ID appears to be incomplete');
            }
        }

        // Xano validation
        if (!this.config.xano.baseUrl) {
            errors.push('Xano Base URL is required');
        } else {
            if (!this.config.xano.baseUrl.startsWith('http')) {
                errors.push('Xano Base URL must be a valid URL starting with http:// or https://');
            }
            // Validate URL format
            try {
                new URL(this.config.xano.baseUrl);
            } catch (e) {
                errors.push('Xano Base URL is not a valid URL');
            }
        }

        // Validate Xano endpoints (required)
        if (!this.config.xano.activityEndpoint) {
            errors.push('Xano Activity Endpoint (PUT) is required');
        } else if (!this.config.xano.activityEndpoint.startsWith('/')) {
            warnings.push('Xano Activity Endpoint should start with "/"');
        }

        if (!this.config.xano.historyEndpoint) {
            errors.push('Xano History Endpoint (GET) is required');
        } else if (!this.config.xano.historyEndpoint.startsWith('/')) {
            warnings.push('Xano History Endpoint should start with "/"');
        }

        // Optional endpoints - just warn if format is wrong
        if (this.config.xano.snapshotEndpoint && !this.config.xano.snapshotEndpoint.startsWith('/')) {
            warnings.push('Xano Snapshot Endpoint should start with "/"');
        }

        if (this.config.xano.timelineEndpoint && !this.config.xano.timelineEndpoint.startsWith('/')) {
            warnings.push('Xano Timeline Endpoint should start with "/"');
        }

        // Sync validation
        if (this.config.sync.syncInterval < 10000) {
            errors.push('Sync interval must be at least 10 seconds');
        }

        if (this.config.sync.syncInterval > 3600000) {
            warnings.push('Sync interval is very long (>1 hour). This may cause data staleness.');
        }

        // Validate sync direction
        const validDirections = ['bidirectional', 'airtable_to_eo', 'eo_to_airtable'];
        if (!validDirections.includes(this.config.sync.direction)) {
            errors.push('Invalid sync direction');
        }

        // Validate conflict resolution
        const validResolutions = ['superposition', 'airtable_wins', 'eo_wins', 'newest_wins'];
        if (!validResolutions.includes(this.config.sync.conflictResolution)) {
            errors.push('Invalid conflict resolution strategy');
        }

        // Log warnings
        if (warnings.length > 0) {
            console.warn('Configuration warnings:', warnings);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
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
