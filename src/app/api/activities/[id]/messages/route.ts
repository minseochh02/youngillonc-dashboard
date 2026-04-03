import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params;

  if (!activityId) {
    return NextResponse.json({
      success: false,
      error: 'Activity ID is required'
    }, { status: 400 });
  }

  try {
    // Get activity with source_message_id
    const activityQuery = `
      SELECT
        id,
        employee_name,
        activity_date,
        activity_label,
        chat_room,
        source_message_id
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

    // Fetch source message if we have an ID
    let messages = [];
    if (activity.source_message_id) {
      const messagesQuery = `
        SELECT
          id,
          chat_date,
          user_name,
          message,
          chat_room
        FROM kakaotalk_raw_messages
        WHERE id = ${activity.source_message_id}
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
          activity_label: activity.activity_label,
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
