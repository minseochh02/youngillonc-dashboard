import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

interface ActivityRow {
  id: number;
  activity_date: string;
  activity_label: string | null;
  customer: string | null;
  source_message_id: number | null;
  source_message_ids: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeName = searchParams.get('employee');
  const companyName = searchParams.get('company');

  if (!employeeName || !companyName) {
    return NextResponse.json(
      {
        success: false,
        error: 'employee and company are required'
      },
      { status: 400 }
    );
  }

  try {
    const activitiesQuery = `
      SELECT
        id,
        activity_date,
        activity_label,
        customer,
        source_message_id,
        source_message_ids
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND customer = '${companyName}'
      ORDER BY activity_date DESC
    `;

    const activitiesResult = await executeSQL(activitiesQuery);
    const activities: ActivityRow[] = activitiesResult?.rows || [];

    const messageIdSet = new Set<number>();

    activities.forEach((activity) => {
      if (activity.source_message_id) {
        messageIdSet.add(Number(activity.source_message_id));
      }

      if (activity.source_message_ids) {
        try {
          const parsedIds = JSON.parse(activity.source_message_ids);
          if (Array.isArray(parsedIds)) {
            parsedIds.forEach((id) => {
              const numericId = Number(id);
              if (Number.isFinite(numericId) && numericId > 0) {
                messageIdSet.add(numericId);
              }
            });
          }
        } catch (error) {
          // Ignore malformed JSON for a single row.
        }
      }
    });

    const messageIds = [...messageIdSet];
    let messages: any[] = [];

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
        employeeName,
        companyName,
        activities,
        messages,
        activityCount: activities.length,
        messageCount: messages.length
      }
    });
  } catch (error: any) {
    console.error('Error in company messages API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load company messages'
      },
      { status: 500 }
    );
  }
}
