# EO Airtable Sync System

A comprehensive two-way sync system that integrates Airtable with EO Activibase, featuring activity logging to Xano and full rewind/rollback capabilities.

## 🎯 Overview

This system transforms EO Activibase into an Airtable-integrated backend tool with:

- **Two-way sync** between Airtable and EO
- **Activity logging** to Xano API via PUT
- **Rewind functionality** using Xano GET
- **Softr user context** detection for embedded use
- **EO Superposition (SUP)** for conflict resolution
- **View synchronization** with all Airtable view types
- **Real-time change tracking** and dirty state management

## 📦 Components

### Core Modules

1. **`eo_airtable_integration.js`** - Airtable API integration
   - Schema synchronization (tables, fields, views)
   - Record CRUD operations
   - Batch operations
   - EO operator inference from field names
   - Rate limiting

2. **`eo_xano_integration.js`** - Xano API integration
   - Activity logging (PUT)
   - History retrieval (GET)
   - Snapshot management
   - Timeline generation
   - Batch processing

3. **`eo_softr_context.js`** - User context detection
   - PostMessage communication with Softr parent
   - URL parameter detection
   - LocalStorage persistence
   - Activity tracking

4. **`eo_sync_engine.js`** - Two-way sync engine
   - Bidirectional synchronization
   - Conflict detection
   - Superposition-based conflict resolution
   - Change application
   - Event system

5. **`eo_change_tracker.js`** - Change detection and tracking
   - Real-time change monitoring
   - Dirty state tracking
   - Undo/redo support
   - Auto-save
   - Snapshot management

6. **`eo_rewind.js`** - Rewind/rollback engine
   - Time-travel to previous states
   - Preview mode
   - State comparison
   - Timeline navigation

7. **`eo_airtable_views.js`** - View synchronization
   - Import all Airtable view types
   - View configuration mapping
   - Filter/sort/grouping preservation

8. **`eo_sync_ui.js`** - User interface
   - Sync status panel
   - Manual controls
   - Activity timeline
   - Conflict resolution UI
   - Rewind controls

9. **`eo_sync_config.js`** - Configuration management
   - Credential storage
   - Settings UI
   - Connection testing
   - Import/export

10. **`eo_airtable_sync.js`** - Main integration
    - Orchestrates all modules
    - Initialization
    - Global API

## 🚀 Quick Start

### 1. Include Scripts

Add all modules to your HTML:

```html
<!-- Core integrations -->
<script src="eo_airtable_integration.js"></script>
<script src="eo_xano_integration.js"></script>
<script src="eo_softr_context.js"></script>

<!-- Engines -->
<script src="eo_sync_engine.js"></script>
<script src="eo_change_tracker.js"></script>
<script src="eo_rewind.js"></script>
<script src="eo_airtable_views.js"></script>

<!-- UI and config -->
<script src="eo_sync_config.js"></script>
<script src="eo_sync_ui.js"></script>

<!-- Main integration -->
<script src="eo_airtable_sync.js"></script>
```

### 2. Initialize

```javascript
// Option 1: Auto-initialize with stored config
// (happens automatically on page load if config exists)

// Option 2: Initialize with config object
await initializeEOAirtableSync({
  airtable: {
    apiKey: 'keyXXXXXXXXXXXXXX',
    baseId: 'appXXXXXXXXXXXXXX'
  },
  xano: {
    baseUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:xxxxx',
    authToken: 'optional-auth-token'
  },
  sync: {
    direction: 'bidirectional',
    conflictResolution: 'superposition',
    autoSync: true,
    syncInterval: 30000
  }
});

// Option 3: Show configuration UI
showSyncConfig();
```

### 3. Use the System

```javascript
// Manual sync
await window.eoSync.sync();

// Get sync status
const status = window.eoSync.getStatus();

// Get activity history
const history = await window.eoSync.getHistory({
  entityId: 'recXXXXXXXXXXXXXX',
  limit: 50
});

// Rewind to previous state
await window.eoSync.rewind('recXXXXXXXXXXXXXX', '2025-11-25T12:00:00Z');

// Get timeline
const timeline = await window.eoSync.getTimeline('recXXXXXXXXXXXXXX');
```

## 🔧 Configuration

### Airtable Settings

- **API Key**: Get from https://airtable.com/account
- **Base ID**: Found in base URL (starts with `app`)
- **Tables**: Automatically detected

### Xano Settings

- **Base URL**: Your Xano API endpoint
- **Auth Token**: Optional authentication token
- **Activity Endpoint**: Default `/activity`
- **History Endpoint**: Default `/activity`
- **Snapshot Endpoint**: Default `/activity/snapshot`

### Sync Settings

- **Direction**:
  - `bidirectional` - Two-way sync
  - `airtable_to_eo` - Airtable → EO only
  - `eo_to_airtable` - EO → Airtable only

- **Conflict Resolution**:
  - `superposition` - Keep both values with context (EO SUP)
  - `airtable_wins` - Airtable always wins
  - `eo_wins` - EO always wins
  - `newest_wins` - Most recent timestamp wins

- **Auto-sync**: Enable/disable automatic syncing
- **Sync Interval**: Milliseconds between syncs (minimum 10000)
- **Batch Size**: Records per batch operation (default 50)

## 🎨 User Interface

The sync UI provides:

### Status Panel
- Current sync status (running/idle)
- Last sync timestamp
- Statistics (created/updated/deleted/conflicts)

### Controls Panel
- Manual sync button
- Auto-sync toggle
- Sync direction selector
- Conflict resolution selector

### Activity Panel
- Recent changes timeline
- User attribution
- Field-level details

### Conflicts Panel
- Active conflicts list
- Field-level conflict details
- Resolution options

### Rewind Panel
- Timeline navigation
- Preview states
- Rollback controls

## 🔄 Sync Flow

### Full Sync Process

1. **Fetch Airtable Data**
   - Schema (tables, fields, views)
   - Records with all fields

2. **Detect Changes**
   - Compare checksums
   - Identify creates/updates/deletes
   - Detect conflicts

3. **Resolve Conflicts**
   - Apply configured strategy
   - Create SUP values if needed
   - Log resolutions to Xano

4. **Apply Changes**
   - Create new records
   - Update modified records
   - Delete removed records
   - Log all activities to Xano

5. **Update UI**
   - Refresh status
   - Show statistics
   - Display conflicts if any

## 🧩 EO Integration Features

### Operator Inference

The system automatically infers EO operators from Airtable field names:

| Field Name Pattern | Inferred Operator | Meaning |
|-------------------|-------------------|---------|
| "missing", "absent" | NUL | Recognize absence |
| "label", "category", "status" | DES | Designate/classify |
| "created", "generated" | INS | Instantiate |
| "filter", "segment" | SEG | Segment/bound |
| "related", "linked" | CON | Connect |
| "alternate", "variant" | ALT | Alternate |
| "total", "sum", "aggregate" | SYN | Synthesize |
| "parent", "child", "recursive" | REC | Recurse |

### Superposition (SUP) for Conflicts

When conflicts occur and SUP is selected:

```javascript
{
  value_1: {
    value: { ...eoFields },
    method: 'declared',
    scale: 'individual',
    source: { system: 'eo-activibase' },
    agent: { userId: 'usr_123', name: 'John Doe' },
    timestamp: '2025-11-25T10:00:00Z'
  },
  value_2: {
    value: { ...airtableFields },
    method: 'measured',
    scale: 'organization',
    source: { system: 'airtable' },
    agent: { type: 'system', id: 'airtable' },
    timestamp: '2025-11-25T10:05:00Z'
  },
  eoOperator: 'SUP',
  dominantValue: 'value_2' // Shown by default in UI
}
```

### Context Enrichment

Every synced record includes full EO context:

```javascript
{
  source: {
    system: 'airtable',
    baseId: 'appXXXXXXXXXXXXXX',
    tableId: 'tblXXXXXXXXXXXXXX'
  },
  agent: {
    type: 'person',
    id: 'usr_123',
    name: 'John Doe',
    email: 'john@example.com'
  },
  method: 'declared', // or 'measured', 'aggregated', 'inferred', 'derived'
  scale: 'individual', // or 'team', 'department', 'organization'
  timeframe: {
    granularity: 'instant',
    timestamp: '2025-11-25T10:00:00Z'
  }
}
```

## 📊 Activity Logging to Xano

All activities are logged with full context:

```javascript
{
  activity_id: 'act_1732564800000_abc123',
  timestamp: '2025-11-25T10:00:00Z',

  // User context (from Softr)
  user_id: 'usr_123',
  user_email: 'john@example.com',
  user_name: 'John Doe',

  // Action details
  action: 'update', // 'create', 'update', 'delete', 'sync'
  entity_type: 'record',
  entity_id: 'recXXXXXXXXXXXXXX',
  entity_name: 'Project Alpha',

  // Data context
  table_id: 'tblXXXXXXXXXXXXXX',
  table_name: 'Projects',
  base_id: 'appXXXXXXXXXXXXXX',

  // Change tracking
  before: { /* previous state */ },
  after: { /* new state */ },
  changes: [
    { field: 'status', before: 'In Progress', after: 'Complete', type: 'modified' }
  ],
  checksum_before: 'abc123',
  checksum_after: 'def456',

  // Sync metadata
  sync_direction: 'eo_to_airtable',
  sync_session_id: 'sync_1732564800000_xyz789',
  conflict_resolution: null,

  // EO context
  eo_operator: 'DES',
  eo_position: null,
  context: { /* full EO context */ },

  // Source
  source_system: 'eo-activibase',
  metadata: {},
  tags: []
}
```

## ⏪ Rewind Functionality

### Get Timeline

```javascript
const timeline = await window.eoSync.getTimeline('recXXXXXXXXXXXXXX');

// Returns:
[
  {
    timestamp: '2025-11-25T10:05:00Z',
    action: 'update',
    user: { id: 'usr_123', name: 'John Doe' },
    changes: [
      { field: 'status', before: 'In Progress', after: 'Complete' }
    ],
    canRewind: true
  },
  // ... more timeline entries
]
```

### Preview State

```javascript
const preview = await window.eoSync.rewindEngine.previewAtTime(
  'recXXXXXXXXXXXXXX',
  '2025-11-25T10:00:00Z'
);

// Returns:
{
  entityId: 'recXXXXXXXXXXXXXX',
  timestamp: '2025-11-25T10:00:00Z',
  data: { /* state at this time */ },
  activity: { /* related activity */ },
  canRewind: true,
  nextStates: [ /* ... */ ],
  previousStates: [ /* ... */ ]
}
```

### Rewind

```javascript
// Rewind to specific time
const result = await window.eoSync.rewind(
  'recXXXXXXXXXXXXXX',
  '2025-11-25T10:00:00Z'
);

// Rewind with validation
const result = await window.eoSync.rewindEngine.rewindTo(
  'recXXXXXXXXXXXXXX',
  '2025-11-25T10:00:00Z',
  { validate: true }
);

// Preview only (don't apply)
const preview = await window.eoSync.rewindEngine.rewindTo(
  'recXXXXXXXXXXXXXX',
  '2025-11-25T10:00:00Z',
  { preview: true }
);
```

## 🌐 Softr Integration

When embedded in a Softr page, the system automatically detects user context:

### PostMessage Communication

```javascript
// Parent Softr page sends user data
window.postMessage({
  type: 'softr:user',
  data: {
    id: 'usr_123',
    email: 'john@example.com',
    name: 'John Doe',
    role: 'admin'
  }
}, '*');

// EO Activibase acknowledges
window.parent.postMessage({
  type: 'eo:user:updated',
  user: { id: 'usr_123', email: 'john@example.com', name: 'John Doe' },
  sessionId: 'ses_1732564800000_abc123'
}, parentOrigin);
```

### URL Parameters

If PostMessage is not available, user context can be passed via URL:

```
https://your-eo-app.com/?user_id=usr_123&user_email=john@example.com&user_name=John%20Doe
```

### LocalStorage Persistence

User context is persisted to localStorage for offline support and faster subsequent loads.

## 🎯 View Synchronization

The system imports all Airtable view types:

- **Grid** - Standard table view
- **Form** - Data entry forms
- **Calendar** - Date-based views
- **Gallery** - Card-based views
- **Kanban** - Board views by status
- **Timeline** - Gantt-style views
- **Gantt** - Project planning views
- **Block** - Custom blocks

Each view preserves:
- Visible fields
- Filters (when available via API)
- Sorts
- Grouping
- View-specific settings (date fields, card covers, etc.)

## 📱 API Reference

### Main Integration

```javascript
// Initialize
const result = await window.eoSync.initialize(config);

// Manual sync
await window.eoSync.sync();

// Get status
const status = window.eoSync.getStatus();

// Get history
const history = await window.eoSync.getHistory(options);

// Get timeline
const timeline = await window.eoSync.getTimeline(entityId, options);

// Rewind
await window.eoSync.rewind(entityId, timestamp);

// Shutdown
await window.eoSync.shutdown();

// Get API instances
const apis = window.eoSync.getAPIs();
```

### Airtable Integration

```javascript
const airtable = window.eoSync.getAPIs().airtable;

// Fetch records
const records = await airtable.fetchTableRecords('tblXXXXXXXXXXXXXX');

// Upsert record
const record = await airtable.upsertRecord('tblXXXXXXXXXXXXXX', recordData);

// Batch upsert
const records = await airtable.batchUpsertRecords('tblXXXXXXXXXXXXXX', recordsArray);

// Delete record
await airtable.deleteRecord('tblXXXXXXXXXXXXXX', 'recXXXXXXXXXXXXXX');

// Get tables
const tables = airtable.getTables();

// Get views
const views = airtable.getViews('tblXXXXXXXXXXXXXX');
```

### Xano Integration

```javascript
const xano = window.eoSync.getAPIs().xano;

// Log activity
await xano.logActivity(activityData);

// Queue activity (batched)
xano.queueActivity(activityData);

// Get history
const history = await xano.getHistory(options);

// Get snapshot
const snapshot = await xano.getSnapshot(entityId, timestamp);

// Get timeline
const timeline = await xano.getTimeline(entityId, options);

// Rewind
const result = await xano.rewind(entityId, timestamp);

// Flush pending activities
await xano.flush();
```

### Change Tracker

```javascript
const changeTracker = window.eoSync.getAPIs().changeTracker;

// Track change
changeTracker.trackChange({
  entityType: 'record',
  entityId: 'recXXXXXXXXXXXXXX',
  action: 'update',
  before: previousData,
  after: newData
});

// Get changes
const changes = changeTracker.getChanges('recXXXXXXXXXXXXXX');

// Check if dirty
const isDirty = changeTracker.isDirty('recXXXXXXXXXXXXXX');

// Create snapshot
changeTracker.createSnapshot('recXXXXXXXXXXXXXX', currentData);

// Undo/redo
const undone = changeTracker.undo();
const redone = changeTracker.redo();
```

## 🔐 Security Considerations

1. **API Keys**: Store in environment variables or secure configuration
2. **Auth Tokens**: Use secure storage, never commit to version control
3. **PostMessage**: Verify parent origin before processing messages
4. **User Context**: Validate user permissions before operations
5. **CORS**: Ensure proper CORS configuration on Xano endpoints

## 🐛 Troubleshooting

### Common Issues

**Sync not working**
- Check API credentials in configuration
- Verify Airtable base ID is correct
- Check browser console for errors
- Test connection via configuration UI

**User context not detected**
- Verify PostMessage is enabled
- Check URL parameters are present
- Confirm LocalStorage is not blocked
- Check Softr embedding configuration

**Conflicts not resolving**
- Verify conflict resolution strategy
- Check for pending changes
- Review activity log for details

**Rewind failing**
- Ensure Xano endpoints are configured
- Check activity history exists
- Verify snapshot data is available

## 📄 License

This system is part of EO Activibase and follows the same license terms.

## 🤝 Contributing

Contributions welcome! Please ensure:
- All modules follow the established pattern
- Activity logging is comprehensive
- EO context is preserved
- User attribution is accurate

## 📞 Support

For issues or questions, please refer to:
- EO Framework documentation
- Airtable API documentation
- Xano API documentation

---

**Built with ❤️ for EO Activibase**
