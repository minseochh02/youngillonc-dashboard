import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    // Load raw messages
    const messagesResult = await executeSQL(`
      SELECT id, chat_date, user_name, message, chat_room
      FROM kakaotalk_raw_messages
      WHERE DATE(chat_date) = '${date}'
        AND user_name != 'SYSTEM'
      ORDER BY chat_date ASC
    `);

    // Load extracted activities
    const activitiesResult = await executeSQL(`
      SELECT *
      FROM employee_activity_log
      WHERE activity_date = '${date}'
      ORDER BY employee_name, id
    `);

    return NextResponse.json({
      success: true,
      data: {
        rawMessages: messagesResult?.rows || [],
        activities: activitiesResult?.rows || []
      }
    });
  } catch (error: any) {
    console.error('Error loading KakaoTalk demo data:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to load data'
    }, { status: 500 });
  }
}
