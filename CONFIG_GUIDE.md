# 🔧 EO Airtable Sync - Configuration Guide

This guide explains how to configure the Airtable integration system with clear instructions for each API endpoint.

## 📋 Quick Setup Checklist

✅ **Airtable API Key** - Get from https://airtable.com/account
✅ **Airtable Base ID** - Found in your base URL
✅ **Xano Base URL** - Your Xano workspace URL
✅ **Xano PUT Endpoint** - Where to store activity logs
✅ **Xano GET Endpoints** - Where to retrieve history

---

## 🔑 Airtable Configuration

### Required Fields

#### 1. **API Key** ⚠️ REQUIRED
- **Where to get it:** https://airtable.com/account
- **Format:** `keyXXXXXXXXXXXXXX` (starts with "key")
- **Used for:** All read (GET) and write (POST/PATCH) operations
- **Example:** `key123abc456def789`

#### 2. **Base ID** ⚠️ REQUIRED
- **Where to get it:** Look in your Airtable base URL
- **Format:** `appXXXXXXXXXXXXXX` (starts with "app")
- **Example URL:** `https://airtable.com/appABCDEF12345678/...`
- **Example Base ID:** `appABCDEF12345678`

### Auto-Configured Fields (Usually Don't Need to Change)

#### 3. **API Base URL (GET/POST)**
- **Default:** `https://api.airtable.com/v0`
- **Purpose:** Base URL for reading and writing records
- **When to change:** Only if using a proxy or custom Airtable endpoint

#### 4. **Meta API URL (GET Schema)**
- **Default:** `https://api.airtable.com/v0/meta`
- **Purpose:** Fetching table schema, fields, and views
- **When to change:** Only if using a proxy or custom Airtable endpoint

---

## 🌐 Xano Configuration

### Required Fields

#### 1. **Base URL** ⚠️ REQUIRED
- **Format:** `https://x8ki-letl-twmt.n7.xano.io/api:xxxxx`
- **Where to find:**
  1. Log into Xano
  2. Go to your workspace
  3. Find API Group settings
  4. Copy the "Base API URL"
- **Example:** `https://x8ki-letl-twmt.n7.xano.io/api:abc123`

#### 2. **Auth Token** (Optional)
- **Purpose:** Bearer token for authenticated requests
- **When needed:** If your Xano endpoints require authentication
- **Format:** Any string token
- **Example:** `Bearer_abc123def456` or leave blank if not using auth

### PUT Endpoint (For Storing Activity)

#### 3. **PUT Activity Endpoint** ⚠️ REQUIRED
- **Purpose:** Where to STORE/LOG activity data
- **Default:** `/activity`
- **HTTP Method:** PUT
- **What it receives:** Activity log objects with change data
- **Example:** If your base URL is `https://...xano.io/api:abc123` and endpoint is `/activity`, full URL becomes:
  - `PUT https://...xano.io/api:abc123/activity`

**Xano Table Schema for Activity Endpoint:**
```json
{
  "activity_id": "text",
  "timestamp": "datetime",
  "user_id": "text",
  "user_email": "text",
  "user_name": "text",
  "action": "text",
  "entity_type": "text",
  "entity_id": "text",
  "entity_name": "text",
  "table_id": "text",
  "table_name": "text",
  "base_id": "text",
  "before": "json",
  "after": "json",
  "changes": "json",
  "sync_direction": "text",
  "conflict_resolution": "text",
  "metadata": "json"
}
```

### GET Endpoints (For Retrieving Data)

#### 4. **GET History Endpoint** ⚠️ REQUIRED
- **Purpose:** Where to RETRIEVE activity history
- **Default:** `/activity`
- **HTTP Method:** GET
- **What it returns:** Array of activity records
- **Query parameters supported:**
  - `entity_id` - Filter by specific entity
  - `user_id` - Filter by user
  - `start_date` - Filter by date range
  - `end_date` - Filter by date range
  - `action` - Filter by action type
  - `limit` - Number of results
  - `offset` - Pagination offset

**Example GET request:**
```
GET https://...xano.io/api:abc123/activity?entity_id=recXXX&limit=50
```

#### 5. **GET Snapshot Endpoint** (Optional)
- **Purpose:** Get point-in-time snapshot of an entity
- **Default:** `/activity/snapshot`
- **HTTP Method:** GET
- **Query parameters:**
  - `entity_id` - The entity to snapshot
  - `timestamp` - The point in time to retrieve
- **What it returns:** Entity state at that timestamp

**Example:**
```
GET https://...xano.io/api:abc123/activity/snapshot?entity_id=recXXX&timestamp=2025-11-25T10:00:00Z
```

#### 6. **GET Timeline Endpoint** (Optional)
- **Purpose:** Get formatted timeline of changes
- **Default:** `/activity/timeline`
- **HTTP Method:** GET
- **Query parameters:**
  - `entity_id` - The entity to get timeline for
  - `limit` - Number of timeline entries
- **What it returns:** Timeline with before/after states

---

## ⚙️ How API Endpoints Are Used

### Airtable Operations

**Reading Data (GET):**
```javascript
// Fetch all tables and views
GET https://api.airtable.com/v0/meta/bases/{baseId}/tables

// Fetch records from a table
GET https://api.airtable.com/v0/{baseId}/{tableIdOrName}?pageSize=100
```

**Writing Data (POST/PATCH):**
```javascript
// Create new records
POST https://api.airtable.com/v0/{baseId}/{tableIdOrName}

// Update existing records
PATCH https://api.airtable.com/v0/{baseId}/{tableIdOrName}/{recordId}

// Batch operations
POST https://api.airtable.com/v0/{baseId}/{tableIdOrName}
```

### Xano Operations

**Storing Activity (PUT):**
```javascript
// Log single activity
PUT https://your-xano.io/api:xxx/activity
Body: { activity_id, timestamp, action, ... }

// Batch log activities
PUT https://your-xano.io/api:xxx/activity
Body: { activities: [{ ... }, { ... }] }
```

**Retrieving Data (GET):**
```javascript
// Get history
GET https://your-xano.io/api:xxx/activity?entity_id=recXXX

// Get snapshot
GET https://your-xano.io/api:xxx/activity/snapshot?entity_id=recXXX&timestamp=...

// Get timeline
GET https://your-xano.io/api:xxx/activity/timeline?entity_id=recXXX
```

---

## 🛡️ Blank Field Protection

The configuration system **protects against accidentally erasing existing values** with blank fields:

### How It Works

```javascript
// If you have existing config:
{ apiKey: "keyABC123", baseUrl: "https://xano.io/api:abc" }

// And you save the form with blank apiKey:
{ apiKey: "", baseUrl: "https://xano.io/api:xyz" }

// Result:
{ apiKey: "keyABC123", baseUrl: "https://xano.io/api:xyz" }
// ↑ apiKey was preserved!   ↑ baseUrl was updated
```

**Rule:** Blank values will NOT overwrite existing non-blank values. Only non-blank values update the configuration.

---

## 🎯 Schema Reflection from Airtable

The system is designed to **automatically reflect your Airtable schema** without imposing structure:

### What Gets Automatically Imported:

✅ **All Tables** - Every table in your base
✅ **All Fields** - Every field with its type and settings
✅ **All Views** - Grid, Gallery, Kanban, Calendar, Timeline, Gantt, Form, Block
✅ **Field Types** - Text, Number, Select, Date, Attachments, Linked Records, etc.
✅ **View Settings** - Filters, sorts, grouping, visible fields
✅ **Linked Records** - Relationships between tables
✅ **Formulas & Rollups** - Computed fields

### No Manual Mapping Required

The system:
- ❌ Does NOT require you to define schema manually
- ❌ Does NOT force a specific table structure
- ❌ Does NOT require field mapping configuration
- ✅ Automatically discovers your entire schema
- ✅ Preserves all Airtable field types
- ✅ Maintains relationships and formulas
- ✅ Syncs schema changes automatically

### Example: Adding a New Field to Airtable

1. You add a new field "Customer Priority" to your Airtable "Customers" table
2. Next sync automatically detects the new field
3. EO system immediately recognizes and uses the new field
4. No configuration changes needed!

---

## 🧪 Testing Your Configuration

### Step 1: Enter Credentials
1. Open configuration modal (click ⚙️ Configure button)
2. Enter Airtable API Key and Base ID
3. Enter Xano Base URL
4. Enter Xano PUT endpoint (e.g., `/activity`)
5. Enter Xano GET History endpoint (e.g., `/activity`)

### Step 2: Test Connection
Click the **"Test & Save"** button to:
- ✅ Verify Airtable connection
- ✅ Fetch and display your tables
- ✅ Verify Xano connection
- ✅ Confirm endpoints are accessible
- ✅ Save configuration if all tests pass

### Step 3: Verify
Check browser console for:
```
✓ Connected to Airtable base: [Your Base Name]
✓ Synced table: Customers (15 fields, 4 views)
✓ Connected to Xano activity API
✓ Airtable connection successful
✓ Xano connection successful
```

---

## 🔍 Troubleshooting

### Airtable Issues

**"API Key should start with 'key'"**
- Check you copied the full API key from https://airtable.com/account
- Don't include extra spaces

**"Base ID should start with 'app'"**
- Look at your base URL: `https://airtable.com/appXXXXX/...`
- Copy only the `appXXXXX` part

**"Failed to fetch tables"**
- Verify API key has access to the base
- Check base ID is correct
- Ensure you have read permissions

### Xano Issues

**"Xano Base URL must be a valid URL"**
- Should start with `https://`
- Should include your workspace path
- Example: `https://x8ki-letl-twmt.n7.xano.io/api:abc123`

**"Failed to connect to Xano"**
- Check base URL is correct
- Verify endpoints exist in your Xano workspace
- Test endpoints directly in Xano's API tester first

**"PUT Endpoint required"**
- You must specify where to store activity logs
- Can be same as GET endpoint (e.g., both `/activity`)
- Endpoint must accept PUT requests

---

## 📝 Example Complete Configuration

```json
{
  "airtable": {
    "apiKey": "keyABC123DEF456GHI",
    "baseId": "appXYZ789UVW012MNO",
    "apiBaseUrl": "https://api.airtable.com/v0",
    "metaApiUrl": "https://api.airtable.com/v0/meta"
  },
  "xano": {
    "baseUrl": "https://x8ki-letl-twmt.n7.xano.io/api:myproject",
    "authToken": "",
    "putEndpoint": "/activity",
    "getHistoryEndpoint": "/activity",
    "getSnapshotEndpoint": "/activity/snapshot",
    "getTimelineEndpoint": "/activity/timeline"
  },
  "sync": {
    "direction": "bidirectional",
    "conflictResolution": "superposition",
    "autoSync": true,
    "syncInterval": 30000
  }
}
```

---

## 💡 Best Practices

1. **Keep Credentials Secure**
   - Never commit API keys to version control
   - Use environment variables in production
   - Rotate keys periodically

2. **Test Incrementally**
   - Test Airtable connection first
   - Then test Xano connection
   - Finally test full sync

3. **Start with Manual Sync**
   - Disable auto-sync initially
   - Test manual sync first
   - Enable auto-sync once confident

4. **Monitor Activity Logs**
   - Check Xano table for logged activities
   - Verify data structure matches expectations
   - Watch for sync errors in console

5. **Schema Changes**
   - System automatically picks up Airtable schema changes
   - No need to reconfigure after adding fields/tables
   - Just let the next sync detect changes

---

## 🆘 Still Need Help?

1. Check browser console for detailed error messages
2. Verify endpoints in Xano API tester
3. Test Airtable API directly using curl or Postman
4. Review the main README.md for architecture details

---

**Remember:** This system is designed to be **schema-agnostic** and **automatically reflect your Airtable structure**. You should never need to manually configure table schemas or field mappings!
