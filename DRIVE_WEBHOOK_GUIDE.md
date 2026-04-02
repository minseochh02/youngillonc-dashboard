# Google Drive Monitoring System - Setup & Usage Guide

## Overview

This system monitors Google Drive folders for file changes, automatically downloads files, and logs all events to a SQLite database.

**Two Modes Available:**

### 🔔 Webhook Mode (Real-time)
- Real-time notifications from Google Drive
- Requires public URL (ngrok/tunnel)
- More efficient API usage
- **Best for:** Production, real-time requirements

### 📊 Polling Mode (No Tunnel Required) ⭐ RECOMMENDED FOR LOCAL DEV
- Checks for changes every 30-60 seconds
- No tunnel/ngrok needed
- Simpler setup
- **Best for:** Local development, simpler deployments

**Key Features:**
- File change detection (uploads, modifications, deletions)
- Automatic file downloads for supported formats
- SQLite database logging of all events
- REST API for status monitoring and control

---

## Which Mode Should I Use?

| Scenario                    | Recommended Mode      |
|-----------------------------|-----------------------|
| Local development           | 📊 **Polling Mode**   |
| Testing/prototyping         | 📊 **Polling Mode**   |
| Simple deployment           | 📊 **Polling Mode**   |
| Production (real-time)      | 🔔 **Webhook Mode**   |
| Production (non-critical)   | 📊 **Polling Mode**   |

**tl;dr:** Use **Polling Mode** unless you need real-time notifications (< 30 seconds).

---

## Quick Start (Polling Mode - No Tunnel) ⭐

**Fastest way to get started:**

```bash
# 1. Start dev server
npm run dev

# 2. Create tables
curl -X POST http://localhost:3000/api/drive/init-tables

# 3. Configure .env.local
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2

# 4. Initialize
curl http://localhost:3000/api/drive/init

# 5. Start polling
npx tsx scripts/poll-drive-changes.ts
```

See [DRIVE_POLLING_SETUP.md](./DRIVE_POLLING_SETUP.md) or [DRIVE_QUICK_START.md](./DRIVE_QUICK_START.md) for detailed setup.

---

## Architecture

### Webhook Mode:
```
Google Drive → Change Notification → Webhook Endpoint → Process Changes → Download Files → Log to Database
                                          ↓
                                    Update Page Token
```

### Polling Mode:
```
Polling Script → Check for Changes → Process Changes → Download Files → Log to Database
      ↓
Update Page Token
```

**Components:**
- `drive_sync_state` table: Stores page token and channel info
- `drive_file_events` table: Logs all detected file changes
- API Routes: `/api/drive/init`, `/api/drive/watch`, `/api/drive/webhook`, `/api/drive/stop`, `/api/drive/status`, `/api/drive/poll`
- Polling Script: `scripts/poll-drive-changes.ts`
- Cron Job (webhook mode): Auto-renews watch channel before expiration

---

## Prerequisites

### 1. Google Cloud Setup

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Drive API:**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

3. **Create Service Account:**
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "drive-webhook-monitor")
   - Grant role: "Viewer" or "Editor" (for Drive access)
   - Click "Done"

4. **Download Service Account JSON:**
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the file (keep it secure!)

5. **Get Service Account Email:**
   - Copy the service account email (looks like: `name@project-id.iam.gserviceaccount.com`)

### 2. Share Drive Folders

1. Open Google Drive and navigate to the folder(s) you want to monitor
2. Right-click the folder > "Share"
3. Add the service account email
4. Grant "Viewer" or "Editor" permissions
5. Copy the folder ID from the URL (e.g., `https://drive.google.com/drive/folders/[FOLDER_ID]`)

### 3. Setup Tunnel (Webhook Mode Only)

**Skip this step if using Polling Mode!**

For webhook mode, Google needs to send notifications to your local server, so you need a public URL:

**Option A: ngrok**
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start tunnel to port 3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Cloudflare Tunnel (Lightweight)**
```bash
# No installation needed
npx cloudflared tunnel --url http://localhost:3000
```

**Option C: Skip Tunnel - Use Polling Mode Instead**
```bash
# See DRIVE_POLLING_SETUP.md for polling setup (no tunnel required)
```

---

## Installation & Setup

### Step 1: Install Dependencies

Dependencies are already installed. If needed:
```bash
npm install googleapis node-cron
npm install -D @types/node-cron
```

### Step 2: Initialize Database Tables

```bash
# Via API (recommended - works while dev server is running)
curl -X POST http://localhost:3000/api/drive/init-tables

# Or via script (requires stopping dev server first)
npx tsx scripts/init-drive-tables.ts
```

This creates:
- `drive_sync_state` - Stores page token and channel info
- `drive_file_events` - Logs all file change events
- Indexes for performance

### Step 3: Configure Environment Variables

Add to `.env.local`:

**For Polling Mode (No Tunnel):**
```bash
# Service Account JSON (entire JSON as single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Folder IDs to monitor (comma-separated)
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2

# Optional: Download path
DRIVE_DOWNLOAD_PATH=./drive-downloads
```

**For Webhook Mode (Requires Tunnel):**
```bash
# All above variables, PLUS:

# Your tunnel URL
DRIVE_WEBHOOK_BASE_URL=https://your-tunnel-url.ngrok.io
```

**Getting the Service Account JSON:**
```bash
# Format the JSON as a single line
cat /path/to/service-account.json | jq -c '.' | sed 's/"/\\"/g'
# Then wrap in single quotes
```

### Step 4: Start Next.js Server

```bash
npm run dev
```

### Step 5: Initialize Sync System

```bash
# Initialize page token
curl http://localhost:3000/api/drive/init
```

### Step 6a: Start Polling (No Tunnel) ⭐

```bash
# Poll manually once
curl -X POST http://localhost:3000/api/drive/poll

# Or run continuous polling daemon
npx tsx scripts/poll-drive-changes.ts
```

### Step 6b: Register Webhook (Requires Tunnel)

```bash
# Make sure tunnel is running first
npx tsx scripts/setup-drive-watch.ts

# Or manually
curl -X POST http://localhost:3000/api/drive/watch
```

---

## Usage

### Polling Mode Usage

**Manual Poll:**
```bash
curl -X POST http://localhost:3000/api/drive/poll
```

**Continuous Polling:**
```bash
# Run polling daemon (checks every 30 seconds)
npx tsx scripts/poll-drive-changes.ts

# Or run in background
npx tsx scripts/poll-drive-changes.ts &
```

**Adjust Poll Interval:**
Edit `scripts/poll-drive-changes.ts`:
```typescript
const POLL_INTERVAL_SECONDS = 30; // Change to 60, 120, etc.
```

### Webhook Mode Usage

**Register Watch Channel:**
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

**Stop Monitoring:**
```bash
curl -X POST http://localhost:3000/api/drive/stop
```

**Restart Monitoring:**
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

**Auto-Renewal Daemon (Webhook only):**

Run the cron daemon to automatically renew channels before expiration:

```bash
# Foreground
npx tsx scripts/run-drive-cron.ts

# Background
npx tsx scripts/run-drive-cron.ts &
```

The daemon checks daily at 2 AM and renews if expiring within 24 hours.

### Check Status (Both Modes)

```bash
curl http://localhost:3000/api/drive/status | jq
```

**Response:**
```json
{
  "status": "initialized",
  "sync": {
    "initialized": true,
    "targetFolders": 2
  },
  "channel": {
    "status": "active",  // "none" for polling mode
    "channelId": "drive-watch-abc123",
    "expiration": "2024-03-26T12:00:00.000Z",
    "expiresIn": "6d 23h"
  },
  "events": {
    "total": 15,
    "last24Hours": 3,
    "downloaded": 10
  }
}
```

### View Logged Events (Both Modes)

Check via status endpoint:
```bash
curl http://localhost:3000/api/drive/status | jq '.events'
```

---

## API Reference

### POST /api/drive/init-tables

Create database tables for Drive monitoring.

**Response:**
```json
{
  "status": "success",
  "tables": {
    "drive_sync_state": "created",
    "drive_file_events": "created"
  }
}
```

### GET /api/drive/init

Initialize sync system with page token.

**Query Params:**
- `reset=true` - Force re-initialization
- `folderIds=id1,id2` - Override folder IDs from env

**Response:**
```json
{
  "status": "initialized",
  "pageToken": "CAESBAgCIAEaA...",
  "targetFolderIds": ["folder1", "folder2"]
}
```

### POST /api/drive/poll

Poll for Drive changes manually (polling mode).

**Response:**
```json
{
  "status": "success",
  "changesProcessed": 5,
  "filesLogged": 3,
  "filesDownloaded": 2,
  "timestamp": "2024-03-19T10:30:00.000Z"
}
```

### POST /api/drive/watch

Register watch channel for notifications.

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

### POST /api/drive/webhook

Webhook endpoint for Google notifications (handled automatically).

**Headers (from Google):**
- `x-goog-channel-id` - Channel ID
- `x-goog-resource-id` - Resource ID
- `x-goog-resource-state` - Event type (`sync`, `change`, `update`)

### POST /api/drive/stop

Stop active watch channel.

**Response:**
```json
{
  "status": "stopped",
  "stoppedChannelId": "drive-watch-abc123"
}
```

### GET /api/drive/status

Get system status (see "Check Status" section above).

---

## File Download Behavior

**Automatically Downloaded:**
- PDF files
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)
- Word (.doc, .docx)
- Text files (.txt)
- CSV files
- JSON files
- ZIP archives
- Images (PNG, JPG)

**Skipped:**
- Files > 100MB (configurable)
- Google Docs native formats (use export API separately)
- Unsupported mime types

**Download Location:**
- Default: `./drive-downloads/`
- Configure: `DRIVE_DOWNLOAD_PATH` in `.env.local`
- Files named: `{fileId}_{sanitizedFileName}`

---

## Database Schema

### drive_sync_state

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Always 1 (singleton) |
| page_token | TEXT | Current changes API token |
| channel_id | TEXT | Active watch channel ID |
| channel_resource_id | TEXT | Google resource ID |
| channel_expiration | TEXT | ISO timestamp |
| target_folder_ids | TEXT | JSON array of folder IDs |
| last_updated | TEXT | Last state update |

### drive_file_events

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| file_id | TEXT | Google Drive file ID |
| file_name | TEXT | File name |
| mime_type | TEXT | File MIME type |
| folder_id | TEXT | Parent folder ID |
| event_type | TEXT | 'created', 'modified', 'deleted' |
| modified_time | TEXT | File modification time |
| detected_at | TEXT | Event detection timestamp |
| downloaded | INTEGER | 0=pending, 1=downloaded |
| download_path | TEXT | Local file path |
| file_size | INTEGER | File size in bytes |
| metadata | TEXT | Additional JSON data |

---

## Troubleshooting

### Common Issues (Both Modes)

**Issue: "Sync state not initialized"**

Solution:
```bash
curl http://localhost:3000/api/drive/init
```

**Issue: "database is locked"**

Solution:
1. Stop dev server
2. Close EGDesk app if running
3. Try API endpoint instead: `curl -X POST http://localhost:3000/api/drive/init-tables`

**Issue: No changes detected**

Checks:
1. Verify folders are shared with service account email
2. Check folder IDs are correct in `.env.local`
3. Upload a test file
4. For polling: Wait 30 seconds or manually poll: `curl -X POST http://localhost:3000/api/drive/poll`
5. For webhook: Google may take 10-60 seconds to send notification

**Issue: "Failed to download file"**

Possible causes:
- File too large (>100MB default limit)
- Unsupported file type
- Permission denied (check service account access)

Check logs in Next.js console for details.

### Polling Mode Issues

**Issue: Polling not detecting changes**

Solution:
1. Manually trigger poll: `curl -X POST http://localhost:3000/api/drive/poll`
2. Check response for errors
3. Verify service account has folder access
4. Check Next.js console for logs

**Issue: Polling too slow/fast**

Solution: Edit `scripts/poll-drive-changes.ts`:
```typescript
const POLL_INTERVAL_SECONDS = 60; // Adjust as needed
```

### Webhook Mode Issues

**Issue: "No active watch channel"**

Solution: Register a channel:
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

**Issue: Webhook not receiving notifications**

Checks:
1. Tunnel is running and forwarding to localhost:3000
2. `DRIVE_WEBHOOK_BASE_URL` matches your tunnel URL
3. Service account has access to folders
4. Upload a file to test - Google may take 10-60 seconds

Test webhook:
```bash
curl https://your-tunnel-url.ngrok.io/api/drive/webhook
```

**Issue: Channel expired**

Solution: Channels expire after 7 days. Renew:
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

Or run the cron daemon to auto-renew:
```bash
npx tsx scripts/run-drive-cron.ts &
```

---

## Security Considerations

1. **Service Account Credentials:**
   - Never commit `GOOGLE_SERVICE_ACCOUNT_JSON` to git
   - Store in `.env.local` (git-ignored)
   - Rotate keys periodically

2. **Webhook Verification:**
   - System verifies channel ID and resource ID
   - Consider adding HMAC signature validation for production

3. **Tunnel Security:**
   - Use HTTPS tunnels only
   - Don't share tunnel URLs publicly
   - Consider authentication for production webhooks

4. **File Downloads:**
   - Downloads are limited to 100MB by default
   - File names are sanitized to prevent path traversal
   - Only whitelisted MIME types are downloaded

---

## Monitoring & Maintenance

### Daily Checks
- Verify tunnel is active
- Check `/api/drive/status` for channel health

### Weekly
- Review `drive_file_events` for new uploads
- Check downloaded files in `DRIVE_DOWNLOAD_PATH`

### Monthly
- Clean up old entries from `drive_file_events` (optional)
- Review download storage usage

---

## Advanced Configuration

### Custom Download Logic

Edit `src/lib/drive-webhook-processor.ts`:

```typescript
export function shouldDownloadFile(mimeType: string | undefined | null): boolean {
  // Add your custom logic
  return mimeType === 'your/custom-type';
}
```

### Multiple Folder Rules

Modify processing to apply different rules per folder:

```typescript
if (folderId === 'folder1') {
  // Process differently
}
```

### Background Processing

For heavy processing, decouple webhook receipt from processing:
- Return 200 immediately in `/api/drive/webhook`
- Queue changes to a job queue (Bull, BullMQ)
- Process asynchronously

---

## Limitations

### Polling Mode
- Detection delay: 30-60 seconds (configurable)
- Higher API quota usage (1 request per poll)
- Google Drive API quota: 20,000 queries / 100 seconds (plenty for polling)

### Webhook Mode
- Watch channels expire after 7 days (auto-renewable)
- Notification delay: 10-60 seconds
- Tunnel required for local development
- Need to manage channel lifecycle

### Both Modes
- Files > 100MB not downloaded by default (configurable)
- Google Docs native formats not downloaded (need export API)
- Service account must have folder access

---

## Production Deployment

### Polling Mode Production

1. **Deploy Next.js to any platform:**
   - Vercel, Railway, Fly.io, etc.

2. **Set up polling cron job:**
   ```bash
   # Use platform cron (Vercel Cron, etc.)
   # Or run daemon: npx tsx scripts/poll-drive-changes.ts
   ```

3. **Adjust poll interval for production:**
   - Edit `scripts/poll-drive-changes.ts`
   - Recommended: 60-300 seconds for lower API usage

### Webhook Mode Production

1. **Deploy Next.js to a platform with public URL:**
   - Vercel, Railway, Fly.io, etc.

2. **Update environment variables:**
   - Set `DRIVE_WEBHOOK_BASE_URL` to production URL
   - No tunnel needed in production

3. **Run auto-renewal cron daemon:**
   - Use platform's cron features or separate service
   - Or manually renew every 6 days

4. **Monitor webhook health:**
   - Set up alerting for channel expiration
   - Log webhook failures

### Both Modes

- **Database:** EGDesk handles SQLite, scales with your data
- **File storage:** Configure `DRIVE_DOWNLOAD_PATH` appropriately
- **Monitoring:** Check `/api/drive/status` regularly

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Next.js console logs
3. Verify Google Cloud Console for API errors
4. Check database state with SQL queries

---

## File Structure

```
src/
├── lib/
│   ├── google-drive-client.ts       # Drive API client
│   ├── drive-webhook-processor.ts   # Change processing logic
│   └── drive-cron-setup.ts          # Auto-renewal cron (webhook mode)
├── app/api/drive/
│   ├── init-tables/route.ts         # Create database tables
│   ├── init/route.ts                # Initialize system
│   ├── poll/route.ts                # Manual polling endpoint
│   ├── watch/route.ts               # Register webhook channel
│   ├── webhook/route.ts             # Handle webhook notifications
│   ├── stop/route.ts                # Stop webhook channel
│   └── status/route.ts              # Check system status
scripts/
├── init-drive-tables.ts             # Create database tables
├── poll-drive-changes.ts            # Polling daemon (no tunnel)
├── setup-drive-watch.ts             # Interactive webhook setup
└── run-drive-cron.ts                # Auto-renewal daemon (webhook)
```

---

## Summary & Recommendations

**For Local Development:**
- ✅ Use **Polling Mode**
- ✅ No tunnel setup required
- ✅ Simple configuration
- ✅ 30-second delay is acceptable

**For Production (Real-time Critical):**
- Use **Webhook Mode**
- More efficient API usage
- Lower latency (10-60s vs 30-60s)
- Requires public URL (easy in production)

**For Production (Real-time Not Critical):**
- Consider **Polling Mode**
- Simpler deployment
- No webhook channel management
- Works on any platform

**Best Practice:**
Start with Polling Mode for development, switch to Webhooks in production only if you need the lower latency.

---

**Last Updated:** 2024-03-19
**System Version:** 2.0.0 (Added Polling Mode)
