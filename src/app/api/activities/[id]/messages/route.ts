import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const activityId = params.id;

  if (!activityId) {
    return NextResponse.json({
      success: false,
      error: 'Activity ID is required'
    }, { status: 400 });
  }

  try {
    // Get activity with source_message_ids
    const activityQuery = `
      SELECT
        id,
        employee_name,
        activity_date,
        activity_summary,
        chat_room,
        source_message_ids
      FROM employee_activity_log
      WHERE id = ${activityId}
    `;

    const activityResult = await executeSQL(activityQuery);

    if (!activityResult?.rows || activityResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Activity not found'
      }, { status: 404 });
    }

    const activity = activityResult.rows[0];

    // Parse source message IDs
    let messageIds: number[] = [];
    try {
      if (activity.source_message_ids) {
        messageIds = JSON.parse(activity.source_message_ids);
      }
    } catch (e) {
      console.error('Error parsing source_message_ids:', e);
    }

    // Fetch source messages if we have IDs
    let messages = [];
    if (messageIds.length > 0) {
      const messagesQuery = `
        SELECT
          id,
          chat_date,
          user_name,
          message,
          chat_room
        FROM kakaotalk_raw_messages
        WHERE id IN (${messageIds.join(',')})
        ORDER BY chat_date ASC
      `;

      const messagesResult = await executeSQL(messagesQuery);
      messages = messagesResult?.rows || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        activity: {
          id: activity.id,
          employee_name: activity.employee_name,
          activity_date: activity.activity_date,
          activity_summary: activity.activity_summary,
          chat_room: activity.chat_room
        },
        messages: messages,
        messageCount: messages.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching activity messages:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch messages'
    }, { status: 500 });
  }
}
