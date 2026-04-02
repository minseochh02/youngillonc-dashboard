# Google Drive Monitoring - Quick Start Guide

## Two Modes Available

### 🔔 Webhook Mode
- Real-time notifications
- Requires tunnel (ngrok/cloudflare)
- Best for production

### 📊 Polling Mode ⭐ RECOMMENDED FOR LOCAL
- No tunnel needed
- Checks every 30-60 seconds
- Simpler setup

---

## Prerequisites

1. **Google Cloud Setup**
   - Service account created with Drive API enabled
   - Service account JSON credentials downloaded
   - Service account email shared with target Drive folders

2. **Tunnel Setup** (ONLY for Webhook Mode)
   - Skip if using Polling Mode
   - Install ngrok: `brew install ngrok`
   - Or use Cloudflare Tunnel: `npx cloudflared tunnel --url http://localhost:3000`

---

## Quick Start - Polling Mode (No Tunnel) ⭐

### Step 1: Start Development Server

```bash
npm run dev
```

### Step 2: Create Database Tables

```bash
curl -X POST http://localhost:3000/api/drive/init-tables
```

### Step 3: Configure Environment Variables

Add to `.env.local`:

```bash
# Service Account JSON (entire JSON as single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'

# Folder IDs to monitor (comma-separated)
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2

# Optional: Download path (defaults to ./drive-downloads)
DRIVE_DOWNLOAD_PATH=./drive-downloads
```

**Getting Folder IDs:**
- Open Google Drive folder in browser
- Copy ID from URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`

### Step 4: Initialize Sync System

```bash
curl http://localhost:3000/api/drive/init
```

### Step 5: Start Polling

```bash
# Option A: Poll manually once
curl -X POST http://localhost:3000/api/drive/poll

# Option B: Run continuous polling daemon (recommended)
npx tsx scripts/poll-drive-changes.ts
```

**That's it!** Your system is now monitoring Drive changes every 30 seconds.

---

## Quick Start - Webhook Mode (Requires Tunnel)

### Step 1: Start Tunnel (Separate Terminal)

```bash
# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### Step 2: Configure Environment Variables

Add to `.env.local`:

```bash
# Service Account JSON (entire JSON as single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'

# Your tunnel URL (from ngrok or cloudflare)
DRIVE_WEBHOOK_BASE_URL=https://your-tunnel-url.ngrok.io

# Folder IDs to monitor (comma-separated)
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2

# Optional: Download path (defaults to ./drive-downloads)
DRIVE_DOWNLOAD_PATH=./drive-downloads
```

### Step 3: Start Next.js Development Server

```bash
npm run dev
```

### Step 4: Create Database Tables

```bash
curl -X POST http://localhost:3000/api/drive/init-tables
```

### Step 5: Initialize Drive Sync System

```bash
# 1. Initialize sync state and page token
curl http://localhost:3000/api/drive/init

# 2. Register watch channel for notifications
curl -X POST http://localhost:3000/api/drive/watch

# 3. Verify system is running
curl http://localhost:3000/api/drive/status | jq
```

**Expected Response:**
```json
{
  "status": "initialized",
  "channel": {
    "status": "active",
    "expiresIn": "7d 0h"
  },
  "events": {
    "total": 0,
    "last24Hours": 0
  }
}
```

---

## Testing

Upload a file to your monitored Drive folder and check:

**For Polling Mode:**
```bash
# Manually trigger a poll
curl -X POST http://localhost:3000/api/drive/poll

# View recent events
curl http://localhost:3000/api/drive/status | jq '.events'
```

**For Webhook Mode:**
```bash
# View recent events (updates automatically)
curl http://localhost:3000/api/drive/status | jq '.events'
```

**Check Database:**
```bash
# View via EGDesk user data tools
curl http://localhost:3000/api/drive/status | jq
```

---

## Comparison: Polling vs Webhooks

| Feature              | Polling Mode           | Webhook Mode          |
|----------------------|------------------------|-----------------------|
| Setup Complexity     | ⭐ Easy                | ⭐⭐⭐ Complex        |
| Tunnel Required      | ❌ No                  | ✅ Yes (ngrok)        |
| Detection Delay      | 30-60 seconds          | 10-60 seconds         |
| API Usage            | Higher                 | Lower                 |
| Local Development    | ✅ Perfect             | ⚠️ Requires tunnel    |
| Production           | ✅ Works               | ✅ Works              |

**Recommendation:** Use **Polling Mode** for local development, switch to Webhooks for production if real-time is critical.

---

## API Reference

### Create Tables

```bash
# Create database tables
POST http://localhost:3000/api/drive/init-tables

# Check if tables exist
GET http://localhost:3000/api/drive/init-tables
```

---

### Initialize Sync

```bash
GET http://localhost:3000/api/drive/init

# Force re-initialization
GET http://localhost:3000/api/drive/init?reset=true

# Override folder IDs
GET http://localhost:3000/api/drive/init?folderIds=id1,id2
```

---

### Poll for Changes (Polling Mode)

```bash
# Poll once manually
POST http://localhost:3000/api/drive/poll

# Or run continuous polling
npx tsx scripts/poll-drive-changes.ts
```

**Response:**
```json
{
  "status": "success",
  "changesProcessed": 5,
  "filesLogged": 3,
  "filesDownloaded": 2
}
```

---

### Start/Renew Watch Channel (Webhook Mode)

```bash
POST http://localhost:3000/api/drive/watch
```

**Response:**
```json
{
  "status": "watching",
  "channelId": "drive-watch-abc123",
  "expiration": "2024-03-26T12:00:00.000Z",
  "expiresIn": "7 days",
  "webhookUrl": "https://your-tunnel.ngrok.io/api/drive/webhook"
}
```

**Note:** Channels expire after 7 days and must be renewed.

---

### Stop Monitoring

```bash
POST http://localhost:3000/api/drive/stop
```

---

### Check Status

```bash
GET http://localhost:3000/api/drive/status
```

**Response:**
```json
{
  "status": "initialized",
  "sync": {
    "initialized": true,
    "targetFolders": 2,
    "targetFolderIds": ["folder1", "folder2"]
  },
  "channel": {
    "status": "active",
    "channelId": "drive-watch-abc123",
    "expiration": "2024-03-26T12:00:00.000Z",
    "expiresIn": "6d 23h",
    "needsRenewal": false
  },
  "events": {
    "total": 15,
    "last24Hours": 3,
    "downloaded": 10,
    "latest": {
      "file_name": "report.pdf",
      "event_type": "created",
      "detected_at": "2024-03-19T10:30:00.000Z"
    }
  },
  "recommendations": []
}
```

---

### Webhook Endpoint (Google Calls This)

```bash
POST http://localhost:3000/api/drive/webhook

# Health check
GET http://localhost:3000/api/drive/webhook
```

**Headers (sent by Google):**
- `x-goog-channel-id` - Channel ID
- `x-goog-resource-id` - Resource ID
- `x-goog-resource-state` - Event type (`sync`, `change`, `update`)

---

## Troubleshooting

### "Sync state not initialized"
```bash
curl http://localhost:3000/api/drive/init
```

### Polling Mode Issues

**No changes detected:**
1. Verify folders are shared with service account email
2. Check folder IDs are correct in `.env.local`
3. Upload a test file and wait 30 seconds
4. Manually poll: `curl -X POST http://localhost:3000/api/drive/poll`

**"database is locked" error:**
1. Stop dev server
2. Close EGDesk app if running
3. Run script again
4. Or use API endpoint instead: `curl -X POST http://localhost:3000/api/drive/init-tables`

### Webhook Mode Issues

**"No active watch channel"**
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

**Webhook not receiving notifications:**
1. Verify tunnel is running: `curl https://your-tunnel-url.ngrok.io/api/drive/webhook`
2. Check `DRIVE_WEBHOOK_BASE_URL` matches tunnel URL
3. Upload a test file (notifications may take 10-60 seconds)
4. Check Next.js console for webhook logs

**Channel expired:**
```bash
# Renew channel
curl -X POST http://localhost:3000/api/drive/watch
```

---

## File Download Behavior

**Automatically Downloaded:**
- PDF, Excel (.xlsx), PowerPoint (.pptx), Word (.docx)
- Images (PNG, JPG), Text files (.txt), CSV, JSON, ZIP

**Skipped:**
- Files > 100MB (configurable)
- Google Docs native formats
- Unsupported MIME types

**Download Location:** `./drive-downloads/{fileId}_{fileName}`

---

## Database Schema

### View Events

```bash
# Recent events
sqlite3 user_database.db "SELECT file_name, event_type, detected_at FROM drive_file_events ORDER BY detected_at DESC LIMIT 10"

# Downloaded files
sqlite3 user_database.db "SELECT file_name, download_path FROM drive_file_events WHERE downloaded = 1"

# Events by type
sqlite3 user_database.db "SELECT event_type, COUNT(*) FROM drive_file_events GROUP BY event_type"
```

---

## Switching Between Modes

The same database and sync state work for both modes!

### Switch from Polling to Webhooks

```bash
# 1. Add webhook URL to .env.local
DRIVE_WEBHOOK_BASE_URL=https://your-tunnel-url.ngrok.io

# 2. Stop polling daemon (Ctrl+C)

# 3. Register webhook
curl -X POST http://localhost:3000/api/drive/watch
```

### Switch from Webhooks to Polling

```bash
# 1. Stop webhook channel
curl -X POST http://localhost:3000/api/drive/stop

# 2. Start polling
npx tsx scripts/poll-drive-changes.ts
```

---

## Production Deployment

### Polling Mode in Production

```bash
# Use platform cron jobs (Vercel Cron, etc.)
# Or run polling daemon as a background service
# Set poll interval to 60-300 seconds for lower API usage
```

### Webhook Mode in Production

For production environments:

1. **Deploy to platform with public URL** (Vercel, Railway, Fly.io)
2. **Update `.env` with production URL:**
   ```bash
   DRIVE_WEBHOOK_BASE_URL=https://your-production-domain.com
   ```
3. **No tunnel needed** - use production domain directly
4. **Set up auto-renewal** - implement cron job to renew channels before expiration

---

## Next Steps

For more detailed information, see:
- **DRIVE_WEBHOOK_GUIDE.md** - Comprehensive setup guide for both modes
- **DRIVE_POLLING_SETUP.md** - Detailed polling mode guide
- **src/lib/google-drive-client.ts** - Drive API client implementation
- **src/lib/drive-webhook-processor.ts** - Change processing logic
- **scripts/poll-drive-changes.ts** - Polling daemon script

## Summary

**Local Development?** → Use **Polling Mode** (no tunnel needed!)
**Production with real-time needs?** → Use **Webhook Mode**
**Simple deployment?** → Use **Polling Mode** (works everywhere)
