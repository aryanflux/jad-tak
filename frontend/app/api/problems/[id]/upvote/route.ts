import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const complaintId = Number(id);
  if (!Number.isInteger(complaintId) || complaintId <= 0) {
    return NextResponse.json({ error: 'Invalid problem id.' }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to upvote a problem.' }, { status: 401 });
    }

    const appUser = await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE auth_user_id = $1',
      [user.id],
    );
    const userId = appUser.rows[0]?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Your account is not linked to a citizen profile.' }, { status: 403 });
    }

    const inserted = await pool.query(
      `INSERT INTO complaint_upvotes (complaint_id, user_id)
       SELECT $1, $2
        WHERE EXISTS (
          SELECT 1 FROM complaints
           WHERE id = $1 AND status <> 'resolved'
        )
       ON CONFLICT (complaint_id, user_id) DO NOTHING
       RETURNING complaint_id`,
      [complaintId, userId],
    );

    if (inserted.rowCount === 0) {
      const problem = await pool.query(
        `SELECT 1 FROM complaints WHERE id = $1 AND status <> 'resolved'`,
        [complaintId],
      );
      if (problem.rowCount === 0) {
        return NextResponse.json({ error: 'Ongoing problem not found.' }, { status: 404 });
      }
    }

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM complaint_upvotes WHERE complaint_id = $1',
      [complaintId],
    );
    return NextResponse.json({
      upvoted: inserted.rowCount === 1,
      upvotes: Number(count.rows[0]?.count ?? 0),
    });
  } catch (error) {
    console.error('[POST /api/problems/:id/upvote] failed:', error);
    return NextResponse.json({ error: 'Could not record your upvote.' }, { status: 500 });
  }
}
