import { NextResponse } from 'next/server';
import { queryTable } from '../../../../../egdesk-helpers';

/**
 * GET /api/eml/status
 *
 * Returns EML processing status and statistics
 */
export async function GET() {
  try {
    // Get all log entries (avoid executeSQL with column names containing SQL keywords like messages_inserted)
    const allLogs = await queryTable('eml_processing_log', {
      limit: 10000
    });

    const logs = allLogs.rows || [];

    // Calculate statistics manually
    const stats = logs.reduce((acc: any, log: any) => {
      acc.total_files++;
      if (log.status === 'completed') acc.completed++;
      if (log.status === 'failed') acc.failed++;
      if (log.status === 'processing') acc.processing++;
      acc.total_messages_found += log.messages_found || 0;
      acc.total_messages_inserted += log.messages_inserted || 0;
      acc.total_duplicates += log.messages_duplicate || 0;
      acc.files_deleted_from_drive += log.deleted_from_drive || 0;
      acc.files_deleted_from_local += log.deleted_from_local || 0;
      return acc;
    }, {
      total_files: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      total_messages_found: 0,
      total_messages_inserted: 0,
      total_duplicates: 0,
      files_deleted_from_drive: 0,
      files_deleted_from_local: 0
    });

    // Get recent processing history (last 20 files)
    const recentFiles = await queryTable('eml_processing_log', {
      limit: 20,
      orderBy: 'started_at',
      orderDirection: 'DESC'
    });

    // Get failed files
    const failedFiles = await queryTable('eml_processing_log', {
      filters: { status: 'failed' },
      limit: 10,
      orderBy: 'started_at',
      orderDirection: 'DESC'
    });

    // Get chat room statistics (calculate manually to avoid executeSQL with SQL keywords in column names)
    const completedLogs = logs.filter((log: any) => log.status === 'completed');
    const chatRoomMap = new Map<string, any>();

    completedLogs.forEach((log: any) => {
      const room = log.chat_room || 'Unknown';
      if (!chatRoomMap.has(room)) {
        chatRoomMap.set(room, {
          chat_room: room,
          file_count: 0,
          total_messages: 0,
          inserted_messages: 0,
          last_processed: log.started_at
        });
      }
      const roomStats = chatRoomMap.get(room);
      roomStats.file_count++;
      roomStats.total_messages += log.messages_found || 0;
      roomStats.inserted_messages += log.messages_inserted || 0;
      if (log.started_at > roomStats.last_processed) {
        roomStats.last_processed = log.started_at;
      }
    });

    const chatRoomStats = {
      rows: Array.from(chatRoomMap.values())
        .sort((a, b) => b.file_count - a.file_count)
        .slice(0, 10)
    };

    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: stats.total_files,
        completed: stats.completed,
        failed: stats.failed,
        processing: stats.processing,
        totalMessagesFound: stats.total_messages_found,
        totalMessagesInserted: stats.total_messages_inserted,
        totalDuplicates: stats.total_duplicates,
        filesDeletedFromDrive: stats.files_deleted_from_drive,
        filesDeletedFromLocal: stats.files_deleted_from_local
      },
      recentFiles: recentFiles.rows || [],
      failedFiles: failedFiles.rows || [],
      chatRoomStats: chatRoomStats.rows || []
    });
  } catch (error: any) {
    console.error('❌ Error fetching EML status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
