# Google Drive Webhook System - Setup & Usage Guide

## Overview

This system monitors Google Drive folders for file changes using webhooks, automatically downloads files, and logs all events to a SQLite database.

**Key Features:**
- Real-time file change detection (uploads, modifications, deletions)
- Automatic file downloads for supported formats
- SQLite database logging of all events
- Auto-renewal of watch channels (7-day expiration)
- REST API for status monitoring and control

---

## Architecture

```
Google Drive → Change Notification → Webhook Endpoint → Process Changes → Download Files → Log to Database
                                          ↓
                                    Update Page Token
```

**Components:**
- `drive_sync_state` table: Stores page token and channel info
- `drive_file_events` table: Logs all detected file changes
- API Routes: `/api/drive/init`, `/api/drive/watch`, `/api/drive/webhook`, `/api/drive/stop`, `/api/drive/status`
- Cron Job: Auto-renews watch channel before expiration

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

### 3. Setup Tunnel

Since Google needs to send webhooks to your local server, you need a public URL:

**Option A: ngrok (Recommended for development)**
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start tunnel to port 3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Cloudflare Tunnel**
```bash
cloudflared tunnel --url http://localhost:3000
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
npx tsx scripts/init-drive-tables.ts
```

This creates:
- `drive_sync_state` - Stores page token and channel info
- `drive_file_events` - Logs all file change events
- Indexes for performance

### Step 3: Configure Environment Variables

Add to `.env.local` (see `.env.example` for reference):

```bash
# Service Account JSON (entire JSON as single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Your tunnel URL
DRIVE_WEBHOOK_BASE_URL=https://your-tunnel-url.ngrok.io

# Folder IDs to monitor (comma-separated)
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2

# Optional: Download path
DRIVE_DOWNLOAD_PATH=./drive-downloads
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

Make sure your tunnel is forwarding to `localhost:3000`.

### Step 5: Run Setup Script

```bash
npx tsx scripts/setup-drive-watch.ts
```

This will:
1. Verify environment variables
2. Check database tables
3. Initialize page token
4. Register watch channel with Google
5. Verify webhook connectivity

---

## Usage

### Check Status

```bash
curl http://localhost:3000/api/drive/status | jq
```

Or via tunnel:
```bash
curl https://your-tunnel-url.ngrok.io/api/drive/status | jq
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
    "status": "active",
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

### View Logged Events

Query the database:
```bash
sqlite3 user_database.db "SELECT * FROM drive_file_events ORDER BY detected_at DESC LIMIT 10"
```

Or use a script:
```bash
npx tsx -e "import { executeSQL } from './egdesk-helpers'; executeSQL('SELECT * FROM drive_file_events LIMIT 10').then(r => console.log(r.rows))"
```

### Stop Monitoring

```bash
curl -X POST http://localhost:3000/api/drive/stop
```

This stops the watch channel and clears channel info from the database.

### Restart Monitoring

```bash
curl -X POST http://localhost:3000/api/drive/watch
```

### Auto-Renewal Daemon (Optional)

Run the cron daemon to automatically renew channels before expiration:

```bash
# Foreground
npx tsx scripts/run-drive-cron.ts

# Background
npx tsx scripts/run-drive-cron.ts &
```

The daemon checks daily at 2 AM and renews if expiring within 24 hours.

---

## API Reference

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

### Issue: "Sync state not initialized"

**Solution:** Run initialization:
```bash
curl http://localhost:3000/api/drive/init
```

### Issue: "No active watch channel"

**Solution:** Register a channel:
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

### Issue: Webhook not receiving notifications

**Checks:**
1. Tunnel is running and forwarding to localhost:3000
2. `DRIVE_WEBHOOK_BASE_URL` matches your tunnel URL
3. Service account has access to folders
4. Upload a file to test - Google may take 10-60 seconds to send notification

**Test webhook:**
```bash
curl https://your-tunnel-url.ngrok.io/api/drive/webhook
```

### Issue: Channel expired

**Solution:** Channels expire after 7 days. Renew:
```bash
curl -X POST http://localhost:3000/api/drive/watch
```

Or run the cron daemon to auto-renew.

### Issue: "Failed to download file"

**Possible causes:**
- File too large (>100MB default limit)
- Unsupported file type
- Permission denied (check service account access)

**Check logs in Next.js console for details.**

### Issue: Database errors

**Solution:** Reinitialize tables:
```bash
npx tsx scripts/init-drive-tables.ts
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

- Watch channels expire after 7 days (auto-renewable)
- Google Drive API quota: 20,000 queries / 100 seconds
- Webhook notifications may take 10-60 seconds
- Local tunnel required for development (not needed in production)

---

## Production Deployment

For production:

1. **Deploy Next.js to a platform with public URL:**
   - Vercel, Railway, Fly.io, etc.

2. **Update environment variables:**
   - Set `DRIVE_WEBHOOK_BASE_URL` to production URL

3. **Use persistent database:**
   - SQLite works for local, consider PostgreSQL for scale

4. **Run cron daemon:**
   - Use platform's cron features or separate service

5. **Monitor webhook health:**
   - Set up alerting for channel expiration
   - Log webhook failures

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
│   └── drive-cron-setup.ts          # Auto-renewal cron
├── app/api/drive/
│   ├── init/route.ts                # Initialize system
│   ├── watch/route.ts               # Register channel
│   ├── webhook/route.ts             # Handle notifications
│   ├── stop/route.ts                # Stop channel
│   └── status/route.ts              # Check status
scripts/
├── init-drive-tables.ts             # Create database tables
├── setup-drive-watch.ts             # Interactive setup
└── run-drive-cron.ts                # Cron daemon
```

---

**Last Updated:** 2024-03-19
**System Version:** 1.0.0
