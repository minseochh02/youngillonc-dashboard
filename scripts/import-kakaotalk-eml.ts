#!/usr/bin/env tsx
/**
 * Import KakaoTalk .eml Files to Database
 *
 * Parses KakaoTalk group chat export files and stores messages in kakaotalk_raw_messages table.
 * Handles duplicate detection via unique constraint.
 *
 * Usage:
 *   npx tsx scripts/import-kakaotalk-eml.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createTable, insertRows, queryTable } from '../egdesk-helpers';

interface ParsedMessage {
  chat_room: string;
  chat_date: string; // ISO timestamp
  user_name: string;
  message: string;
}

/**
 * Parse Korean date/time to ISO timestamp
 * Example: "2024년 2월 5일 오후 7:30" -> "2024-02-05T19:30:00"
 */
function parseKoreanDateTime(dateStr: string): string {
  const match = dateStr.match(/(\d+)년 (\d+)월 (\d+)일 (오전|오후) (\d+):(\d+)/);
  if (!match) {
    throw new Error(`Cannot parse date: ${dateStr}`);
  }

  const [, year, month, day, meridiem, hour, minute] = match;
  let hours = parseInt(hour);

  // Convert 오후/오전 to 24-hour format
  if (meridiem === '오후' && hours !== 12) {
    hours += 12;
  } else if (meridiem === '오전' && hours === 12) {
    hours = 0;
  }

  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
  return isoDate;
}

/**
 * Parse a single .eml file
 */
async function parseEmlFile(filePath: string): Promise<ParsedMessage[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract chat room name from first line (remove BOM if present)
  const chatRoom = lines[0].replace(/^\uFEFF/, '').trim();
  console.log(`📝 Parsing chat room: ${chatRoom}`);

  const messages: ParsedMessage[] = [];

  // Regex to match message lines
  // Format: "2024년 2월 5일 오후 7:30, 신형철 : 안녕하세요"
  const messageRegex = /^(\d+년 \d+월 \d+일 오(?:전|후) \d+:\d+),\s*(.+?)\s*:\s*(.+)$/;

  // Regex to match system messages (user joined, etc.)
  const systemRegex = /^(\d+년 \d+월 \d+일 오(?:전|후) \d+:\d+),\s*(.+?님이.+)$/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try to match regular message
    const messageMatch = trimmedLine.match(messageRegex);
    if (messageMatch) {
      const [, dateStr, userName, message] = messageMatch;
      try {
        const isoDate = parseKoreanDateTime(dateStr);
        messages.push({
          chat_room: chatRoom,
          chat_date: isoDate,
          user_name: userName.trim(),
          message: message.trim()
        });
      } catch (e) {
        // Skip lines that can't be parsed
        continue;
      }
      continue;
    }

    // Try to match system message
    const systemMatch = trimmedLine.match(systemRegex);
    if (systemMatch) {
      const [, dateStr, systemMessage] = systemMatch;
      try {
        const isoDate = parseKoreanDateTime(dateStr);
        messages.push({
          chat_room: chatRoom,
          chat_date: isoDate,
          user_name: 'SYSTEM',
          message: systemMessage.trim()
        });
      } catch (e) {
        continue;
      }
    }
  }

  console.log(`✅ Parsed ${messages.length} messages from ${path.basename(filePath)}`);
  return messages;
}

/**
 * Create the kakaotalk_raw_messages table
 */
async function createMessagesTable() {
  console.log('🔨 Creating kakaotalk_raw_messages table...');

  try {
    const result = await createTable(
      '카카오톡원본메시지',
      [
        { name: 'chat_room', type: 'TEXT', notNull: true },
        { name: 'chat_date', type: 'TEXT', notNull: true },
        { name: 'user_name', type: 'TEXT', notNull: true },
        { name: 'message', type: 'TEXT', notNull: true },
        { name: 'imported_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      {
        tableName: 'kakaotalk_raw_messages',
        description: 'Raw KakaoTalk messages parsed from .eml export files',
        uniqueKeyColumns: ['chat_room', 'chat_date', 'user_name', 'message'],
        duplicateAction: 'skip' // Skip duplicates on re-import
      }
    );
    console.log('✅ Table created successfully:', result);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Table already exists, skipping creation');
    } else {
      throw error;
    }
  }
}

/**
 * Insert messages into database with batch processing
 */
async function insertMessages(messages: ParsedMessage[]) {
  console.log(`📥 Inserting ${messages.length} messages...`);

  // Insert in batches of 100 to avoid overwhelming the API
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    try {
      const result = await insertRows('kakaotalk_raw_messages', batch);

      // Count how many were actually inserted vs skipped
      const batchInserted = result.rowsAffected || batch.length;
      inserted += batchInserted;
      skipped += (batch.length - batchInserted);

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchInserted} inserted, ${batch.length - batchInserted} skipped (duplicates)`);
    } catch (error) {
      console.error(`❌ Error inserting batch starting at ${i}:`, error);
      throw error;
    }
  }

  console.log(`✅ Insertion complete: ${inserted} new messages, ${skipped} duplicates skipped`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting KakaoTalk .eml import process\n');

  // Step 1: Create table
  await createMessagesTable();
  console.log();

  // Step 2: Find all .eml files in the project root
  const projectRoot = path.join(__dirname, '..');
  const files = await fs.readdir(projectRoot);
  const emlFiles = files.filter(f => f.endsWith('.eml'));

  if (emlFiles.length === 0) {
    console.log('❌ No .eml files found in project root');
    return;
  }

  console.log(`📂 Found ${emlFiles.length} .eml files:`);
  emlFiles.forEach(f => console.log(`   - ${f}`));
  console.log();

  // Step 3: Parse all .eml files
  const allMessages: ParsedMessage[] = [];
  for (const emlFile of emlFiles) {
    const filePath = path.join(projectRoot, emlFile);
    const messages = await parseEmlFile(filePath);
    allMessages.push(...messages);
  }

  console.log(`\n📊 Total messages parsed: ${allMessages.length}`);
  console.log();

  // Step 4: Insert messages
  if (allMessages.length > 0) {
    await insertMessages(allMessages);
  }

  // Step 5: Show summary
  console.log('\n📈 Import Summary:');
  const summary = await queryTable('kakaotalk_raw_messages', {
    limit: 1,
    orderBy: 'id',
    orderDirection: 'DESC'
  });

  if (summary && summary.rows && summary.rows.length > 0) {
    console.log(`   Total rows in database: ${summary.totalRows || 'unknown'}`);
  }

  // Show unique chat rooms
  console.log('\n💬 Chat rooms in database:');
  const rooms = await queryTable('kakaotalk_raw_messages', {
    limit: 100
  });

  if (rooms && rooms.rows) {
    const uniqueRooms = new Set(rooms.rows.map((r: any) => r.chat_room));
    uniqueRooms.forEach(room => console.log(`   - ${room}`));
  }

  console.log('\n✅ Import complete!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
