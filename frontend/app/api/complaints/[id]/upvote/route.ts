import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const complaintId = Number(id);
  const userId = Number(request.headers.get('x-user-id'));

  if (!Number.isInteger(complaintId) || complaintId <= 0) {
    return NextResponse.json({ error: 'Invalid complaint id.' }, { status: 400 });
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'A valid user id is required.' }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    const result = await pool.query<{ id: number }>(
      `INSERT INTO complaint_upvotes (complaint_id, user_id)
       SELECT $1, $2
        WHERE EXISTS (SELECT 1 FROM complaints WHERE id = $1)
       ON CONFLICT (complaint_id, user_id) DO NOTHING
       RETURNING complaint_id AS id`,
      [complaintId, userId]
    );

    if (result.rowCount === 0) {
      const complaint = await pool.query(
        'SELECT 1 FROM complaints WHERE id = $1',
        [complaintId]
      );
      if (complaint.rowCount === 0) {
        return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
      }
    }

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM complaint_upvotes WHERE complaint_id = $1',
      [complaintId]
    );
    return NextResponse.json({
      upvoted: result.rowCount === 1,
      upvotes: Number(count.rows[0]?.count ?? 0),
    });
  } catch (error) {
    console.error('[POST /api/complaints/:id/upvote] failed:', error);
    return NextResponse.json({ error: 'Could not record support.' }, { status: 500 });
  }
}
