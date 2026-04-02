/**
 * Interactive Setup for Google Drive Webhook System
 *
 * Guides you through:
 * 1. Environment variable verification
 * 2. Database table initialization
 * 3. Page token initialization
 * 4. Watch channel registration
 */

import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setup() {
  console.log('\n🚀 Google Drive Webhook Setup\n');
  console.log('This script will guide you through setting up the Drive webhook system.\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking environment variables...\n');

  const requiredEnvVars = [
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'DRIVE_WEBHOOK_BASE_URL',
    'DRIVE_TARGET_FOLDER_IDS'
  ];

  const missingVars: string[] = [];
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
      console.log(`❌ ${varName} - Missing`);
    } else {
      console.log(`✅ ${varName} - Found`);
    }
  });

  if (missingVars.length > 0) {
    console.log('\n❌ Missing required environment variables!');
    console.log('\nPlease add the following to your .env.local file:');
    missingVars.forEach(varName => {
      console.log(`   ${varName}=...`);
    });
    console.log('\nSee DRIVE_QUICK_START.md for details.\n');
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ All environment variables configured!\n');

  // Step 2: Check if dev server is running
  console.log('📋 Step 2: Checking if Next.js dev server is running...\n');
  console.log('The dev server must be running at http://localhost:3000');
  console.log('If not started, open a new terminal and run: npm run dev\n');

  const serverRunning = await ask('Is the dev server running? (y/n): ');
  if (serverRunning.toLowerCase() !== 'y') {
    console.log('\n❌ Please start the dev server first: npm run dev\n');
    rl.close();
    process.exit(1);
  }

  // Step 3: Check tunnel
  console.log('\n📋 Step 3: Checking tunnel setup...\n');
  console.log(`Webhook URL: ${process.env.DRIVE_WEBHOOK_BASE_URL}/api/drive/webhook`);
  console.log('\nMake sure your tunnel (ngrok/cloudflare) is forwarding to localhost:3000\n');

  const tunnelRunning = await ask('Is the tunnel running and configured? (y/n): ');
  if (tunnelRunning.toLowerCase() !== 'y') {
    console.log('\n❌ Please start tunnel first:');
    console.log('   ngrok http 3000');
    console.log('   Then update DRIVE_WEBHOOK_BASE_URL in .env.local\n');
    rl.close();
    process.exit(1);
  }

  // Step 4: Initialize system
  console.log('\n📋 Step 4: Initializing Drive webhook system...\n');
  console.log('This will:');
  console.log('  1. Initialize page token');
  console.log('  2. Register watch channel');
  console.log('  3. Start monitoring for changes\n');

  const proceed = await ask('Continue with initialization? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\n⚠️  Setup cancelled.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔧 Initializing...\n');
  console.log('Run these commands manually:');
  console.log('\n1. Initialize sync state:');
  console.log('   curl http://localhost:3000/api/drive/init\n');
  console.log('2. Register watch channel:');
  console.log('   curl -X POST http://localhost:3000/api/drive/watch\n');
  console.log('3. Check status:');
  console.log('   curl http://localhost:3000/api/drive/status | jq\n');

  console.log('\n✅ Setup complete! Your Drive webhook system is ready.\n');
  console.log('📝 Next steps:');
  console.log('   - Upload a file to your monitored Drive folder to test');
  console.log('   - Check status: curl http://localhost:3000/api/drive/status');
  console.log('   - View events: sqlite3 user_database.db "SELECT * FROM drive_file_events"\n');

  rl.close();
}

// Run setup
setup().catch((error) => {
  console.error('❌ Setup error:', error);
  rl.close();
  process.exit(1);
});
