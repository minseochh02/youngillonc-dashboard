# Google Drive Setup Workaround - Database Lock Issue

## Problem
The database is locked when trying to create tables because EGDesk app is using it.

## Solution: Manual Setup via EGDesk UI

Since the database is managed by EGDesk, create the tables directly in the EGDesk app:

### Step 1: Open EGDesk App

Open the EGDesk desktop application.

### Step 2: Create Tables Manually

Go to the database/data management section and create these two tables:

#### Table 1: `drive_sync_state`

| Column Name           | Type    | Not Null | Default                  |
|-----------------------|---------|----------|--------------------------|
| id                    | INTEGER | Yes      | -                        |
| page_token            | TEXT    | Yes      | -                        |
| channel_id            | TEXT    | No       | -                        |
| channel_resource_id   | TEXT    | No       | -                        |
| channel_expiration    | TEXT    | No       | -                        |
| target_folder_ids     | TEXT    | No       | -                        |
| last_updated          | TEXT    | No       | datetime('now')          |
| created_at            | TEXT    | No       | datetime('now')          |

**Settings:**
- Display Name: "Drive Sync State"
- Description: "Stores Google Drive sync state and watch channel info"
- Unique Key Columns: `id`

#### Table 2: `drive_file_events`

| Column Name      | Type    | Not Null | Default         |
|------------------|---------|----------|-----------------|
| id               | INTEGER | Yes      | -               |
| file_id          | TEXT    | Yes      | -               |
| file_name        | TEXT    | Yes      | -               |
| mime_type        | TEXT    | No       | -               |
| folder_id        | TEXT    | No       | -               |
| event_type       | TEXT    | Yes      | -               |
| modified_time    | TEXT    | No       | -               |
| detected_at      | TEXT    | No       | datetime('now') |
| downloaded       | INTEGER | No       | 0               |
| download_path    | TEXT    | No       | -               |
| file_size        | INTEGER | No       | -               |
| metadata         | TEXT    | No       | -               |

**Settings:**
- Display Name: "Drive File Events"
- Description: "Logs all Google Drive file change events"
- Duplicate Action: "allow"

### Step 3: Verify Tables Created

Run:
```bash
curl http://localhost:3000/api/drive/init-tables
```

Should return:
```json
{
  "status": "ok",
  "driveTables": ["drive_sync_state", "drive_file_events"],
  "hasRequiredTables": true
}
```

### Step 4: Continue Setup

Once tables exist, continue with normal setup:

```bash
# Initialize sync
curl http://localhost:3000/api/drive/init

# Register watch
curl -X POST http://localhost:3000/api/drive/watch

# Check status
curl http://localhost:3000/api/drive/status
```

---

## Alternative: Wait and Retry

If EGDesk app is temporarily accessing the database:

```bash
# Wait 10 seconds and try again
sleep 10 && curl -X POST http://localhost:3000/api/drive/init-tables
```

---

## Verify Database Access

Check what's accessing the database:

```bash
# macOS/Linux
lsof | grep user_database.db

# Or check SQLite processes
ps aux | grep -i sqlite
```
