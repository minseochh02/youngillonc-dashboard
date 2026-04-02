# Google Drive Polling Setup (No Tunnel Required)

This is an **alternative to webhooks** that doesn't require ngrok or any tunnel.

## How It Works

Instead of Google pushing notifications to you, you **poll** Google Drive API periodically to check for changes.

**Pros:**
- ✅ No ngrok/tunnel needed
- ✅ Works locally without public URL
- ✅ Simpler setup

**Cons:**
- ⚠️ Not real-time (polling interval: 30s-60s)
- ⚠️ Uses more API quota (polling vs. push)

---

## Setup (Polling Mode)

### Step 1: Create Tables

```bash
curl -X POST http://localhost:3000/api/drive/init-tables
```

### Step 2: Configure Environment

Add to `.env.local` (no DRIVE_WEBHOOK_BASE_URL needed!):

```bash
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
DRIVE_TARGET_FOLDER_IDS=folder_id_1,folder_id_2
DRIVE_DOWNLOAD_PATH=./drive-downloads  # optional
```

### Step 3: Initialize Sync

```bash
# Initialize page token
curl http://localhost:3000/api/drive/init
```

**That's it!** No watch channel registration needed.

---

## Usage

### Option A: Manual Polling (Test)

Poll once manually:

```bash
curl -X POST http://localhost:3000/api/drive/poll
```

### Option B: Polling Daemon (Background)

Run continuous polling in background:

```bash
# Start polling every 30 seconds
npx tsx scripts/poll-drive-changes.ts

# Or run in background
npx tsx scripts/poll-drive-changes.ts &
```

### Option C: Cron Job (Production)

Set up a system cron job:

```bash
# Edit crontab
crontab -e

# Add this line (poll every minute)
* * * * * curl -X POST http://localhost:3000/api/drive/poll
```

Or use Next.js API route with Vercel Cron in production.

---

## Comparison: Polling vs. Webhooks

| Feature              | Polling (No Tunnel)     | Webhooks (Requires Tunnel) |
|----------------------|-------------------------|----------------------------|
| Setup complexity     | ⭐ Easy                 | ⭐⭐⭐ Complex             |
| Real-time detection  | ❌ 30-60s delay         | ✅ 10-60s                  |
| API quota usage      | Higher (frequent polls) | Lower (only when changes)  |
| Local development    | ✅ Works                | ❌ Needs ngrok             |
| Production           | ✅ Works                | ✅ Works                   |

---

## Polling Interval Recommendations

Edit `scripts/poll-drive-changes.ts` to adjust:

```typescript
const POLL_INTERVAL_SECONDS = 30; // Change this

// Examples:
// 10 seconds - very responsive, high API usage
// 30 seconds - balanced (recommended for dev)
// 60 seconds - conservative API usage
// 300 seconds (5 min) - minimal API usage
```

**Google Drive API Quota:** 20,000 requests per 100 seconds (plenty for polling)

---

## Check Status

```bash
curl http://localhost:3000/api/drive/status | jq
```

---

## Switching to Webhooks Later

If you want real-time later, just:

1. Add `DRIVE_WEBHOOK_BASE_URL` to `.env.local`
2. Run: `curl -X POST http://localhost:3000/api/drive/watch`
3. Stop polling daemon

The same database and sync state work for both modes!
