import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

interface ActivityRow {
  id: number;
  activity_date: string;
  activity_label: string | null;
  products: string | null;
  source_message_id: number | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeName = searchParams.get('employee');
  const productName = searchParams.get('product');

  if (!employeeName || !productName) {
    return NextResponse.json(
      {
        success: false,
        error: 'employee and product are required'
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
        products,
        source_message_id
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND products IS NOT NULL
        AND products != '[]'
        AND products != ''
      ORDER BY activity_date DESC
    `;

    const activitiesResult = await executeSQL(activitiesQuery);
    const allActivities: ActivityRow[] = activitiesResult?.rows || [];

    // Filter activities that contain this product
    const activities = allActivities.filter(activity => {
      if (!activity.products) return false;
      try {
        const products = JSON.parse(activity.products);
        return Array.isArray(products) && products.includes(productName);
      } catch (e) {
        return false;
      }
    });

    const messageIdSet = new Set<number>();

    activities.forEach((activity) => {
      if (activity.source_message_id) {
        messageIdSet.add(Number(activity.source_message_id));
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
        productName,
        activities,
        messages,
        activityCount: activities.length,
        messageCount: messages.length
      }
    });
  } catch (error: any) {
    console.error('Error in product messages API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load product messages'
      },
      { status: 500 }
    );
  }
}
