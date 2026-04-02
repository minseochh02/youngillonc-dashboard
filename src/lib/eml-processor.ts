import * as fs from 'fs';
import { executeSQL, insertRows, queryTable, updateRows } from '../../egdesk-helpers';

/**
 * KakaoTalk message structure
 */
export interface KakaoMessage {
  chat_room: string;
  chat_date: string;  // ISO format
  user_name: string;
  message: string;
}

/**
 * Insert result statistics
 */
export interface InsertResult {
  found: number;
  inserted: number;
  duplicates: number;
}

/**
 * Parse Korean datetime format to ISO 8601
 *
 * Input: "2024년 2월 13일 오후 5:30"
 * Output: "2024-02-13T17:30:00"
 *
 * Edge cases:
 * - 오전 12:30 → 00:30:00 (midnight)
 * - 오후 12:30 → 12:30:00 (noon)
 * - 오전 11:59 → 11:59:00
 * - 오후 11:59 → 23:59:00
 */
export function parseKoreanDateTime(dateStr: string): string {
  const match = dateStr.match(/(\d+)년 (\d+)월 (\d+)일 (오전|오후) (\d+):(\d+)/);

  if (!match) {
    throw new Error(`Invalid Korean date format: ${dateStr}`);
  }

  const [_, year, month, day, ampm, hourStr, minute] = match;
  let hour = parseInt(hourStr);

  // Convert 12-hour to 24-hour format
  if (ampm === '오후' && hour !== 12) {
    hour += 12;
  }
  if (ampm === '오전' && hour === 12) {
    hour = 0;
  }

  const pad = (n: string) => n.padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(String(hour))}:${pad(minute)}:00`;
}

/**
 * Extract chat room name from EML content
 * Looks for "Subject:" header in Korean format
 */
function extractChatRoom(content: string): string {
  // Look for Subject line
  const subjectMatch = content.match(/Subject:\s*(.+)/i);
  if (subjectMatch) {
    return subjectMatch[1].trim();
  }

  // Fallback: look for first line with Korean characters
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && /[가-힣]/.test(trimmed)) {
      return trimmed;
    }
  }

  return 'Unknown Chat Room';
}

/**
 * Extract messages from EML file content
 *
 * Parses line-by-line with pattern:
 * "YYYY년 M월 D일 오전/오후 H:MM, UserName : Message"
 *
 * Handles multi-line messages by accumulating lines until next timestamp
 */
export function extractMessagesFromEML(
  content: string,
  chatRoom: string
): KakaoMessage[] {
  const lines = content.split('\n');
  const messages: KakaoMessage[] = [];

  // Pattern: "2024년 2월 13일 오후 5:30, 홍길동 : 안녕하세요"
  const messagePattern = /^(\d+년 \d+월 \d+일 (?:오전|오후) \d+:\d+), (.+?) : (.+)$/;

  let currentMessage: KakaoMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    const match = trimmed.match(messagePattern);

    if (match) {
      // Save previous message if exists
      if (currentMessage) {
        messages.push(currentMessage);
      }

      // Start new message
      const [_, dateStr, userName, messageText] = match;

      try {
        currentMessage = {
          chat_room: chatRoom,
          chat_date: parseKoreanDateTime(dateStr),
          user_name: userName.trim(),
          message: messageText.trim()
        };
      } catch (error: any) {
        console.warn(`⚠️  Failed to parse date: ${dateStr} - ${error.message}`);
        currentMessage = null;
      }
    } else if (currentMessage && trimmed) {
      // Multi-line continuation
      currentMessage.message += '\n' + trimmed;
    }
  }

  // Don't forget the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

/**
 * Insert messages with duplicate checking
 *
 * Uses latest message check for efficiency:
 * 1. Get latest message from EML file
 * 2. Check latest message in database for this chat room
 * 3. If EML latest <= DB latest → all messages already backed up
 * 4. If EML latest > DB latest → insert only newer messages
 *
 * Returns statistics about found/inserted/duplicate messages
 */
export async function insertMessagesWithDuplicateCheck(
  messages: KakaoMessage[]
): Promise<InsertResult> {
  if (messages.length === 0) {
    return { found: 0, inserted: 0, duplicates: 0 };
  }

  const found = messages.length;
  const chatRoom = messages[0].chat_room;

  try {
    // Sort messages by date to find latest
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(b.chat_date).getTime() - new Date(a.chat_date).getTime()
    );
    const latestEMLMessage = sortedMessages[0];

    // Get latest message date from database for this chat room
    // Escape single quotes in chat room name for SQL safety
    const escapedChatRoom = chatRoom.replace(/'/g, "''");
    const dbLatestQuery = await executeSQL(`
      SELECT MAX(chat_date) as latest_date
      FROM kakaotalk_raw_messages
      WHERE chat_room = '${escapedChatRoom}'
    `);

    const dbLatestDate = dbLatestQuery.rows?.[0]?.latest_date;

    // If database has no messages for this chat room, insert all
    if (!dbLatestDate) {
      console.log('   📝 New chat room - inserting all messages');
      const result = await insertRows('kakaotalk_raw_messages', messages);
      const inserted = result?.rowsInserted || found;
      return { found, inserted, duplicates: 0 };
    }

    // Compare latest dates
    const latestEMLDate = new Date(latestEMLMessage.chat_date);
    const latestDBDate = new Date(dbLatestDate);

    // If EML latest <= DB latest, all messages are already backed up
    if (latestEMLDate <= latestDBDate) {
      console.log(`   ✅ All messages already backed up (latest: ${dbLatestDate})`);
      return { found, inserted: 0, duplicates: found };
    }

    // Insert only messages newer than DB latest
    const newMessages = messages.filter(msg =>
      new Date(msg.chat_date) > latestDBDate
    );

    console.log(`   📝 Inserting ${newMessages.length} new messages (newer than ${dbLatestDate})`);
    const result = await insertRows('kakaotalk_raw_messages', newMessages);
    const inserted = result?.rowsInserted || newMessages.length;
    const duplicates = found - inserted;

    return { found, inserted, duplicates };
  } catch (error: any) {
    console.error('❌ Error in duplicate check:', error.message);
    throw error;
  }
}

/**
 * Log processing status to eml_processing_log table
 */
async function logProcessingStatus(
  fileId: string,
  fileName: string,
  chatRoom: string,
  downloadPath: string,
  status: 'processing' | 'completed' | 'failed',
  stats?: InsertResult,
  errorMessage?: string,
  deletedFromDrive: boolean = false,
  deletedFromLocal: boolean = false
): Promise<void> {
  try {
    const logEntry: Record<string, any> = {
      file_id: fileId,
      file_name: fileName,
      chat_room: chatRoom,
      download_path: downloadPath,
      status,
      deleted_from_drive: deletedFromDrive ? 1 : 0,
      deleted_from_local: deletedFromLocal ? 1 : 0
    };

    if (status === 'processing') {
      logEntry.started_at = new Date().toISOString();
    } else {
      logEntry.completed_at = new Date().toISOString();
    }

    if (stats) {
      logEntry.messages_found = stats.found;
      logEntry.messages_inserted = stats.inserted;
      logEntry.messages_duplicate = stats.duplicates;
    }

    if (errorMessage) {
      logEntry.error_message = errorMessage;
    }

    // Check if entry exists
    const existing = await queryTable('eml_processing_log', {
      filters: { file_id: fileId },
      limit: 1
    });

    if (existing?.rows?.length > 0) {
      // Update existing entry
      await updateRows('eml_processing_log', logEntry, {
        filters: { file_id: fileId }
      });
    } else {
      // Insert new entry
      await insertRows('eml_processing_log', [logEntry]);
    }
  } catch (error: any) {
    console.error(`❌ Failed to log processing status: ${error.message}`);
  }
}

/**
 * Process EML file: parse, insert, and log results
 *
 * Main orchestration function that:
 * 1. Reads file with UTF-8 encoding
 * 2. Extracts chat room name from header
 * 3. Parses all messages
 * 4. Inserts to database with duplicate checking
 * 5. Logs results to eml_processing_log
 *
 * Note: Does NOT delete files - caller should handle deletion
 */
export async function processEMLFile(
  fileId: string,
  filePath: string,
  fileName: string
): Promise<InsertResult> {
  console.log(`📧 Processing EML: ${fileName}`);

  let chatRoom = 'Unknown';

  try {
    // Log processing start
    await logProcessingStatus(
      fileId,
      fileName,
      chatRoom,
      filePath,
      'processing'
    );

    // Read file with UTF-8 encoding
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract chat room name
    chatRoom = extractChatRoom(content);
    console.log(`   Chat room: ${chatRoom}`);

    // Parse messages
    const messages = extractMessagesFromEML(content, chatRoom);
    console.log(`   Found ${messages.length} messages`);

    if (messages.length === 0) {
      console.warn(`⚠️  No messages found in ${fileName}`);
      await logProcessingStatus(
        fileId,
        fileName,
        chatRoom,
        filePath,
        'completed',
        { found: 0, inserted: 0, duplicates: 0 }
      );
      return { found: 0, inserted: 0, duplicates: 0 };
    }

    // Insert to database
    const stats = await insertMessagesWithDuplicateCheck(messages);
    console.log(`   Inserted: ${stats.inserted}, Duplicates: ${stats.duplicates}`);

    // Log success
    await logProcessingStatus(
      fileId,
      fileName,
      chatRoom,
      filePath,
      'completed',
      stats
    );

    return stats;
  } catch (error: any) {
    console.error(`❌ Error processing ${fileName}: ${error.message}`);

    // Log failure
    await logProcessingStatus(
      fileId,
      fileName,
      chatRoom,
      filePath,
      'failed',
      undefined,
      error.message
    );

    throw error;
  }
}

/**
 * Update deletion status in processing log
 */
export async function updateDeletionStatus(
  fileId: string,
  deletedFromDrive: boolean,
  deletedFromLocal: boolean
): Promise<void> {
  try {
    await updateRows('eml_processing_log', {
      deleted_from_drive: deletedFromDrive ? 1 : 0,
      deleted_from_local: deletedFromLocal ? 1 : 0
    }, {
      filters: { file_id: fileId }
    });
  } catch (error: any) {
    console.error(`❌ Failed to update deletion status: ${error.message}`);
  }
}
