import { NextRequest, NextResponse } from 'next/server';
import { updateRows } from '@/egdesk-helpers';

/** Values accepted for manual correction; must stay in sync with activity extraction and /api/employees queries */
const ALLOWED_ACTIVITY_TYPES = new Set([
  'completed_task',
  'work_completed',
  'sales_activity',
  'planned_task',
  'planning',
  'issue',
  'meeting',
  'other'
]);

const COMPLETED_ACTIVITY_TYPES = new Set(['completed_task', 'work_completed', 'sales_activity']);

type PatchBody = {
  activity_type?: string;
  confidence_score?: number;
  completion_reason?: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid activity id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (body.activity_type !== undefined) {
    if (!ALLOWED_ACTIVITY_TYPES.has(body.activity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid activity_type' },
        { status: 400 }
      );
    }
    updates.activity_type = body.activity_type;
  }

  if (body.confidence_score !== undefined) {
    const c = Number(body.confidence_score);
    if (!Number.isFinite(c) || c < 0 || c > 1) {
      return NextResponse.json(
        { success: false, error: 'confidence_score must be between 0 and 1' },
        { status: 400 }
      );
    }
    updates.confidence_score = c;
  } else if (
    body.activity_type !== undefined &&
    COMPLETED_ACTIVITY_TYPES.has(body.activity_type)
  ) {
    // Human-verified completion: include in /api/employees tracker (confidence >= 0.7)
    updates.confidence_score = 1;
  }

  if (body.activity_type !== undefined && COMPLETED_ACTIVITY_TYPES.has(body.activity_type)) {
    const completionReason =
      typeof body.completion_reason === 'string' && body.completion_reason.trim().length > 0
        ? body.completion_reason.trim()
        : '관리자 보고로 완료 처리';

    updates.task_status = 'completed';
    updates.resolved_by = 'admin';
    updates.action_taken = 'manual_completion';
    updates.outcome = completionReason;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  try {
    await updateRows('employee_activity_log', updates, { ids: [id] });
    return NextResponse.json({ success: true, data: { id, ...updates } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update failed';
    console.error('PATCH employee activity:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
