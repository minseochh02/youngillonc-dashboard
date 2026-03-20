#!/usr/bin/env tsx
/**
 * Google Drive Watch Channel Renewal Daemon
 *
 * Runs a cron job to automatically renew watch channels before expiration.
 * Run this script in the background alongside your Next.js server:
 *
 * Usage:
 *   npx tsx scripts/run-drive-cron.ts
 *
 * Or in background:
 *   npx tsx scripts/run-drive-cron.ts &
 */

import { initializeDriveCron } from '../src/lib/drive-cron-setup';

console.log('🚀 Starting Google Drive watch channel renewal daemon...\n');

// Initialize the cron job
initializeDriveCron();

console.log('\n✅ Daemon running. Press Ctrl+C to stop.\n');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down cron daemon...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down cron daemon...');
  process.exit(0);
});

// Prevent process from exiting
setInterval(() => {
  // Keep alive
}, 1000 * 60 * 60); // Check every hour
