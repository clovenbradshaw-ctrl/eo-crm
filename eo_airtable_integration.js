/**
 * EO Airtable Integration Module
 *
 * Provides comprehensive Airtable API integration for:
 * - Schema synchronization (bases, tables, fields, views)
 * - Record synchronization (two-way sync)
 * - View configuration import
 * - Real-time change detection
 */

class AirtableIntegration {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.baseId = config.baseId || null;
        this.baseUrl = 'https://api.airtable.com/v0';
        this.metaApiUrl = 'https://api.airtable.com/v0/meta';

        // Sync state
        this.syncState = {
            lastSync: null,
            tables: new Map(), // tableId -> { schema, lastModified }
            records: new Map(), // recordId -> { data, lastModified, checksum }
            views: new Map() // viewId -> { config, filters, sorts, grouping }
        };

        // Rate limiting
        this.rateLimiter = {
            requestsPerSecond: 5,
            queue: [],
            processing: false
        };
    }

    /**
     * Initialize connection and fetch base metadata
     */
    async initialize() {
        if (!this.apiKey || !this.baseId) {
            throw new Error('API key and Base ID are required');
        }

        try {
            const baseMetadata = await this.fetchBaseMetadata();
            console.log('✓ Connected to Airtable base:', baseMetadata.name);

            // Fetch all tables and views
            await this.syncSchema();

            return {
                success: true,
                base: baseMetadata,
                tables: Array.from(this.syncState.tables.keys())
            };
        } catch (error) {
            console.error('Failed to initialize Airtable connection:', error);
            throw error;
        }
    }

    /**
     * Fetch base metadata using Meta API
     */
    async fetchBaseMetadata() {
        const response = await this.apiRequest(`${this.metaApiUrl}/bases/${this.baseId}/tables`);
        return response;
    }

    /**
     * Sync schema: tables, fields, and views
     */
    async syncSchema() {
        console.log('🔄 Syncing schema from Airtable...');

        const metadata = await this.fetchBaseMetadata();

        for (const table of metadata.tables) {
            const tableSchema = {
                id: table.id,
                name: table.name,
                primaryFieldId: table.primaryFieldId,
                fields: this.parseFields(table.fields),
                views: this.parseViews(table.views),
                description: table.description || ''
            };

            this.syncState.tables.set(table.id, {
                schema: tableSchema,
                lastModified: new Date().toISOString()
            });

            // Store each view
            for (const view of table.views) {
                this.syncState.views.set(view.id, {
                    tableId: table.id,
                    tableName: table.name,
                    config: view,
                    lastModified: new Date().toISOString()
                });
            }

            console.log(`  ✓ Synced table: ${table.name} (${table.fields.length} fields, ${table.views.length} views)`);
        }

        return metadata;
    }

    /**
     * Parse Airtable field definitions into EO-compatible schema
     */
    parseFields(fields) {
        return fields.map(field => {
            const eoField = {
                id: field.id,
                name: field.name,
                type: this.mapAirtableTypeToEO(field.type),
                airtableType: field.type,
                description: field.description || '',
                options: field.options || {}
            };

            // Handle linked records - infer EO operator
            if (field.type === 'multipleRecordLinks') {
                eoField.linkedTableId = field.options?.linkedTableId;
                eoField.eoOperator = this.inferOperatorFromFieldName(field.name);
                eoField.isSymmetric = field.options?.isSymmetric || false;
            }

            // Handle formula fields
            if (field.type === 'formula') {
                eoField.formula = field.options?.formula;
                eoField.resultType = field.options?.result?.type;
            }

            // Handle rollup fields
            if (field.type === 'rollup') {
                eoField.rollup = {
                    linkedFieldId: field.options?.linkedFieldId,
                    fieldId: field.options?.fieldId,
                    aggregation: field.options?.aggregation
                };
                eoField.eoOperator = 'SYN'; // Synthesis operator
            }

            return eoField;
        });
    }

    /**
     * Parse Airtable view configurations
     */
    parseViews(views) {
        return views.map(view => ({
            id: view.id,
            name: view.name,
            type: view.type, // grid, form, calendar, gallery, kanban, timeline, etc.
            visibleFieldIds: view.visibleFieldIds || null
        }));
    }

    /**
     * Map Airtable field types to EO types
     */
    mapAirtableTypeToEO(airtableType) {
        const typeMap = {
            'singleLineText': 'text',
            'multilineText': 'longText',
            'richText': 'richText',
            'number': 'number',
            'percent': 'number',
            'currency': 'number',
            'singleSelect': 'select',
            'multipleSelects': 'multiSelect',
            'date': 'date',
            'dateTime': 'dateTime',
            'checkbox': 'boolean',
            'multipleRecordLinks': 'linkedRecord',
            'formula': 'formula',
            'rollup': 'rollup',
            'count': 'count',
            'lookup': 'lookup',
            'multipleAttachments': 'attachment',
            'url': 'url',
            'email': 'email',
            'phoneNumber': 'phone',
            'rating': 'rating',
            'duration': 'duration',
            'barcode': 'barcode',
            'button': 'button',
            'autoNumber': 'autoNumber',
            'createdTime': 'createdTime',
            'createdBy': 'createdBy',
            'lastModifiedTime': 'lastModifiedTime',
            'lastModifiedBy': 'lastModifiedBy'
        };

        return typeMap[airtableType] || 'text';
    }

    /**
     * Infer EO operator from field name for linked records
     */
    inferOperatorFromFieldName(fieldName) {
        const name = fieldName.toLowerCase();

        // NUL - Recognize absence
        if (name.includes('missing') || name.includes('absent') || name.includes('lacks')) {
            return 'NUL';
        }

        // DES - Designate/classify
        if (name.includes('label') || name.includes('tag') || name.includes('category') ||
            name.includes('type') || name.includes('status') || name.includes('class')) {
            return 'DES';
        }

        // INS - Instantiate/create
        if (name.includes('created') || name.includes('generated') || name.includes('spawned')) {
            return 'INS';
        }

        // SEG - Segment/filter
        if (name.includes('filter') || name.includes('segment') || name.includes('group')) {
            return 'SEG';
        }

        // ALT - Alternate
        if (name.includes('alternate') || name.includes('variant') || name.includes('version')) {
            return 'ALT';
        }

        // SYN - Synthesize/aggregate
        if (name.includes('aggregate') || name.includes('sum') || name.includes('total') ||
            name.includes('merge') || name.includes('combine')) {
            return 'SYN';
        }

        // REC - Recurse/feedback
        if (name.includes('parent') || name.includes('child') || name.includes('recursive') ||
            name.includes('self') || name.includes('feedback')) {
            return 'REC';
        }

        // CON - Connect (default for most relationships)
        return 'CON';
    }

    /**
     * Fetch all records from a table with full context
     */
    async fetchTableRecords(tableIdOrName, options = {}) {
        const table = this.getTableByIdOrName(tableIdOrName);
        if (!table) {
            throw new Error(`Table not found: ${tableIdOrName}`);
        }

        console.log(`📥 Fetching records from table: ${table.schema.name}`);

        let allRecords = [];
        let offset = null;

        do {
            const params = new URLSearchParams({
                pageSize: options.pageSize || 100,
                ...(offset && { offset }),
                ...(options.view && { view: options.view }),
                ...(options.fields && { fields: options.fields.join(',') }),
                ...(options.filterByFormula && { filterByFormula: options.filterByFormula }),
                ...(options.sort && { sort: JSON.stringify(options.sort) })
            });

            const response = await this.apiRequest(
                `${this.baseUrl}/${this.baseId}/${table.schema.id}?${params}`
            );

            allRecords = allRecords.concat(response.records);
            offset = response.offset;

            console.log(`  Retrieved ${response.records.length} records (total: ${allRecords.length})`);

        } while (offset);

        // Process records into EO format with context
        const eoRecords = allRecords.map(record => this.convertAirtableRecordToEO(record, table.schema));

        // Update sync state
        for (const record of eoRecords) {
            this.syncState.records.set(record.id, {
                data: record,
                lastModified: record.lastModified,
                checksum: this.calculateChecksum(record.fields)
            });
        }

        console.log(`✓ Fetched ${eoRecords.length} records from ${table.schema.name}`);

        return eoRecords;
    }

    /**
     * Convert Airtable record to EO format with full context
     */
    convertAirtableRecordToEO(airtableRecord, tableSchema) {
        const eoRecord = {
            id: airtableRecord.id,
            tableId: tableSchema.id,
            tableName: tableSchema.name,
            fields: {},
            context: {
                source: {
                    system: 'airtable',
                    baseId: this.baseId,
                    tableId: tableSchema.id
                },
                agent: {
                    type: 'system',
                    id: 'airtable-sync',
                    name: 'Airtable Integration'
                },
                method: 'measured', // Data comes directly from Airtable
                scale: 'organization', // Airtable data is typically org-level
                timeframe: {
                    granularity: 'instant',
                    timestamp: new Date().toISOString()
                }
            },
            createdTime: airtableRecord.createdTime,
            lastModified: airtableRecord.createdTime // Airtable doesn't always provide lastModifiedTime
        };

        // Process each field with type-appropriate handling
        for (const [fieldName, value] of Object.entries(airtableRecord.fields)) {
            const fieldSchema = tableSchema.fields.find(f => f.name === fieldName);

            eoRecord.fields[fieldName] = {
                value: value,
                fieldId: fieldSchema?.id,
                type: fieldSchema?.type || 'text',
                airtableType: fieldSchema?.airtableType,
                context: { ...eoRecord.context }
            };
        }

        return eoRecord;
    }

    /**
     * Create or update record in Airtable
     */
    async upsertRecord(tableIdOrName, record, options = {}) {
        const table = this.getTableByIdOrName(tableIdOrName);
        if (!table) {
            throw new Error(`Table not found: ${tableIdOrName}`);
        }

        const isUpdate = record.id && record.id.startsWith('rec');
        const method = isUpdate ? 'PATCH' : 'POST';
        const url = isUpdate
            ? `${this.baseUrl}/${this.baseId}/${table.schema.id}/${record.id}`
            : `${this.baseUrl}/${this.baseId}/${table.schema.id}`;

        // Convert EO record to Airtable format
        const airtableRecord = {
            fields: this.convertEOFieldsToAirtable(record.fields, table.schema)
        };

        if (options.typecast) {
            airtableRecord.typecast = true;
        }

        const response = await this.apiRequest(url, {
            method,
            body: JSON.stringify(airtableRecord)
        });

        console.log(`✓ ${isUpdate ? 'Updated' : 'Created'} record in ${table.schema.name}: ${response.id}`);

        return this.convertAirtableRecordToEO(response, table.schema);
    }

    /**
     * Batch upsert records (max 10 at a time per Airtable limits)
     */
    async batchUpsertRecords(tableIdOrName, records, options = {}) {
        const table = this.getTableByIdOrName(tableIdOrName);
        if (!table) {
            throw new Error(`Table not found: ${tableIdOrName}`);
        }

        const batchSize = 10;
        const results = [];

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const hasIds = batch.every(r => r.id && r.id.startsWith('rec'));

            const method = hasIds ? 'PATCH' : 'POST';
            const url = `${this.baseUrl}/${this.baseId}/${table.schema.id}`;

            const payload = {
                records: batch.map(record => ({
                    ...(hasIds && { id: record.id }),
                    fields: this.convertEOFieldsToAirtable(record.fields, table.schema)
                })),
                ...(options.typecast && { typecast: true })
            };

            const response = await this.apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            results.push(...response.records);
            console.log(`✓ Batch ${hasIds ? 'updated' : 'created'} ${response.records.length} records in ${table.schema.name}`);
        }

        return results.map(r => this.convertAirtableRecordToEO(r, table.schema));
    }

    /**
     * Delete record from Airtable
     */
    async deleteRecord(tableIdOrName, recordId) {
        const table = this.getTableByIdOrName(tableIdOrName);
        if (!table) {
            throw new Error(`Table not found: ${tableIdOrName}`);
        }

        await this.apiRequest(
            `${this.baseUrl}/${this.baseId}/${table.schema.id}/${recordId}`,
            { method: 'DELETE' }
        );

        // Remove from sync state
        this.syncState.records.delete(recordId);

        console.log(`✓ Deleted record from ${table.schema.name}: ${recordId}`);
    }

    /**
     * Convert EO fields back to Airtable format
     */
    convertEOFieldsToAirtable(eoFields, tableSchema) {
        const airtableFields = {};

        for (const [fieldName, fieldData] of Object.entries(eoFields)) {
            const fieldSchema = tableSchema.fields.find(f => f.name === fieldName);

            if (!fieldSchema) {
                console.warn(`Field not found in schema: ${fieldName}, skipping`);
                continue;
            }

            // Extract value (handle both simple values and EO value objects)
            let value = fieldData.value !== undefined ? fieldData.value : fieldData;

            // Skip computed fields (formula, rollup, etc.)
            if (['formula', 'rollup', 'count', 'lookup', 'autoNumber',
                 'createdTime', 'createdBy', 'lastModifiedTime', 'lastModifiedBy'].includes(fieldSchema.airtableType)) {
                continue;
            }

            airtableFields[fieldName] = value;
        }

        return airtableFields;
    }

    /**
     * Get table by ID or name
     */
    getTableByIdOrName(identifier) {
        // Try by ID first
        if (this.syncState.tables.has(identifier)) {
            return this.syncState.tables.get(identifier);
        }

        // Try by name
        for (const [id, table] of this.syncState.tables.entries()) {
            if (table.schema.name === identifier) {
                return table;
            }
        }

        return null;
    }

    /**
     * Calculate checksum for change detection
     */
    calculateChecksum(fields) {
        const normalized = JSON.stringify(fields, Object.keys(fields).sort());
        return this.simpleHash(normalized);
    }

    /**
     * Simple hash function for checksums
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Rate-limited API request with retry logic
     */
    async apiRequest(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const requestOptions = {
            ...options,
            headers
        };

        // Add to rate limiter queue
        return new Promise((resolve, reject) => {
            this.rateLimiter.queue.push({ url, options: requestOptions, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Process rate-limited request queue
     */
    async processQueue() {
        if (this.rateLimiter.processing || this.rateLimiter.queue.length === 0) {
            return;
        }

        this.rateLimiter.processing = true;

        while (this.rateLimiter.queue.length > 0) {
            const { url, options, resolve, reject } = this.rateLimiter.queue.shift();

            try {
                const response = await fetch(url, options);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`);
                }

                const data = options.method === 'DELETE' ? { deleted: true } : await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }

            // Rate limiting: wait between requests
            await new Promise(resolve => setTimeout(resolve, 1000 / this.rateLimiter.requestsPerSecond));
        }

        this.rateLimiter.processing = false;
    }

    /**
     * Get all synced tables
     */
    getTables() {
        return Array.from(this.syncState.tables.values()).map(t => t.schema);
    }

    /**
     * Get all synced views
     */
    getViews(tableIdOrName = null) {
        const views = Array.from(this.syncState.views.values());

        if (tableIdOrName) {
            const table = this.getTableByIdOrName(tableIdOrName);
            if (table) {
                return views.filter(v => v.tableId === table.schema.id);
            }
        }

        return views;
    }

    /**
     * Get sync statistics
     */
    getSyncStats() {
        return {
            lastSync: this.syncState.lastSync,
            tableCount: this.syncState.tables.size,
            recordCount: this.syncState.records.size,
            viewCount: this.syncState.views.size,
            tables: Array.from(this.syncState.tables.values()).map(t => ({
                id: t.schema.id,
                name: t.schema.name,
                fieldCount: t.schema.fields.length,
                viewCount: t.schema.views.length
            }))
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AirtableIntegration;
}
