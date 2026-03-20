#!/usr/bin/env tsx
/**
 * Interactive Google Drive Webhook Setup Script
 *
 * This script guides you through the initial setup of the Google Drive webhook system.
 *
 * Prerequisites:
 * 1. Google Cloud project with Drive API enabled
 * 2. Service account credentials JSON
 * 3. Target Drive folders shared with service account email
 * 4. Tunnel URL configured (ngrok, cloudflare, etc.)
 * 5. Database tables initialized (run: npx tsx scripts/init-drive-tables.ts)
 *
 * Steps:
 * 1. Verify environment variables
 * 2. Initialize page token
 * 3. Register watch channel
 * 4. Verify webhook connectivity
 */

import * as readline from 'readline';
import { executeSQL } from '../egdesk-helpers';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function checkEnvironmentVariables(): Promise<boolean> {
  console.log('\n📋 Step 1: Checking environment variables...\n');

  const required = [
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'DRIVE_WEBHOOK_BASE_URL',
    'DRIVE_TARGET_FOLDER_IDS'
  ];

  let allPresent = true;

  for (const varName of required) {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Set`);
      if (varName === 'DRIVE_TARGET_FOLDER_IDS') {
        const folderIds = value.split(',').map(id => id.trim()).filter(Boolean);
        console.log(`   Monitoring ${folderIds.length} folder(s): ${folderIds.join(', ')}`);
      }
      if (varName === 'DRIVE_WEBHOOK_BASE_URL') {
        console.log(`   Webhook URL: ${value}/api/drive/webhook`);
      }
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    console.log('\n⚠️  Missing required environment variables. Please add them to .env.local');
    console.log('   See .env.example for reference.\n');
    return false;
  }

  console.log('\n✅ All environment variables configured\n');
  return true;
}

async function checkDatabaseTables(): Promise<boolean> {
  console.log('📋 Step 2: Checking database tables...\n');

  try {
    // Check if tables exist
    const result = await executeSQL(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND (name='drive_sync_state' OR name='drive_file_events')
      ORDER BY name
    `);

    const tables = result.rows?.map((row: any) => row.name) || [];

    if (tables.includes('drive_sync_state') && tables.includes('drive_file_events')) {
      console.log('✅ Database tables exist:');
      console.log('   - drive_sync_state');
      console.log('   - drive_file_events\n');
      return true;
    } else {
      console.log('❌ Database tables not found. Please run:');
      console.log('   npx tsx scripts/init-drive-tables.ts\n');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error checking database:', error.message);
    return false;
  }
}

async function initializePageToken(): Promise<boolean> {
  console.log('📋 Step 3: Initializing page token...\n');

  const webhookBaseUrl = process.env.DRIVE_WEBHOOK_BASE_URL;
  if (!webhookBaseUrl) {
    console.error('❌ DRIVE_WEBHOOK_BASE_URL not set');
    return false;
  }

  try {
    console.log('🔄 Calling /api/drive/init...');
    const response = await fetch(`${webhookBaseUrl}/api/drive/init`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to initialize: ${error}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ Page token initialized');
    console.log(`   Status: ${data.status}`);
    if (data.targetFolderIds) {
      console.log(`   Monitoring ${data.targetFolderIds.length} folder(s)`);
    }
    console.log();

    return true;
  } catch (error: any) {
    console.error(`❌ Error calling init API: ${error.message}`);
    console.log('\n⚠️  Make sure your Next.js server is running on the tunnel URL!');
    return false;
  }
}

async function registerWatchChannel(): Promise<boolean> {
  console.log('📋 Step 4: Registering watch channel...\n');

  const webhookBaseUrl = process.env.DRIVE_WEBHOOK_BASE_URL;
  if (!webhookBaseUrl) {
    console.error('❌ DRIVE_WEBHOOK_BASE_URL not set');
    return false;
  }

  try {
    console.log('🔄 Calling /api/drive/watch...');
    const response = await fetch(`${webhookBaseUrl}/api/drive/watch`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to register watch: ${error}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ Watch channel registered successfully!');
    console.log(`   Channel ID: ${data.channelId}`);
    console.log(`   Resource ID: ${data.resourceId}`);
    console.log(`   Expires: ${data.expiration}`);
    console.log(`   Expires in: ${data.expiresIn}`);
    console.log(`   Webhook URL: ${data.webhookUrl}`);
    console.log();

    return true;
  } catch (error: any) {
    console.error(`❌ Error calling watch API: ${error.message}`);
    return false;
  }
}

async function verifyWebhook(): Promise<void> {
  console.log('📋 Step 5: Verifying webhook connectivity...\n');

  const webhookBaseUrl = process.env.DRIVE_WEBHOOK_BASE_URL;
  if (!webhookBaseUrl) {
    console.error('❌ DRIVE_WEBHOOK_BASE_URL not set');
    return;
  }

  try {
    console.log('🔄 Testing webhook endpoint...');
    const response = await fetch(`${webhookBaseUrl}/api/drive/webhook`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Webhook endpoint is accessible');
      console.log(`   Status: ${data.status}`);
      console.log();
    } else {
      console.log('⚠️  Webhook endpoint returned error, but this is expected for GET requests');
      console.log('   Google will send POST requests when changes occur.\n');
    }
  } catch (error: any) {
    console.error(`❌ Error testing webhook: ${error.message}`);
    console.log('   Make sure your tunnel is forwarding to the Next.js server.\n');
  }
}

async function displayNextSteps(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🎉 Setup Complete!');
  console.log('='.repeat(70) + '\n');

  console.log('Next steps:\n');
  console.log('1. 📊 Check status:');
  console.log('   curl ' + process.env.DRIVE_WEBHOOK_BASE_URL + '/api/drive/status\n');

  console.log('2. 🧪 Test by uploading a file to one of your monitored folders\n');

  console.log('3. 📝 View logged events:');
  console.log('   Query the drive_file_events table in your database\n');

  console.log('4. 🔄 Start the auto-renewal daemon (optional):');
  console.log('   npx tsx scripts/run-drive-cron.ts &\n');

  console.log('5. 🛑 To stop watching:');
  console.log('   curl -X POST ' + process.env.DRIVE_WEBHOOK_BASE_URL + '/api/drive/stop\n');

  console.log('='.repeat(70) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Google Drive Webhook Setup');
  console.log('='.repeat(70) + '\n');

  // Step 1: Check environment
  const envOk = await checkEnvironmentVariables();
  if (!envOk) {
    console.log('❌ Setup cannot continue without environment variables.');
    rl.close();
    process.exit(1);
  }

  // Step 2: Check database
  const dbOk = await checkDatabaseTables();
  if (!dbOk) {
    console.log('❌ Setup cannot continue without database tables.');
    rl.close();
    process.exit(1);
  }

  // Confirm before proceeding
  const proceed = await question('Ready to initialize? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\n👋 Setup cancelled.');
    rl.close();
    process.exit(0);
  }

  // Step 3: Initialize page token
  const initOk = await initializePageToken();
  if (!initOk) {
    console.log('\n❌ Failed to initialize page token. Check that Next.js server is running.');
    rl.close();
    process.exit(1);
  }

  // Step 4: Register watch channel
  const watchOk = await registerWatchChannel();
  if (!watchOk) {
    console.log('\n❌ Failed to register watch channel.');
    rl.close();
    process.exit(1);
  }

  // Step 5: Verify webhook
  await verifyWebhook();

  // Display next steps
  await displayNextSteps();

  rl.close();
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});
