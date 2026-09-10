import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { getDbPool } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in to view your reported problems.' }, { status: 401 });
  }

  try {
    const result = await getDbPool().query(
      `SELECT c.id, c.title, c.status, c.created_at
       FROM complaints c
       INNER JOIN users u ON u.id = c.user_id
       WHERE u.auth_user_id = $1
       ORDER BY c.created_at DESC`,
      [user.id],
    );

    return NextResponse.json({
      complaints: result.rows.map((complaint) => ({
        id: Number(complaint.id),
        title: complaint.title,
        status: complaint.status,
        createdAt: complaint.created_at,
      })),
    });
  } catch (error) {
    console.error('[GET /api/profile/complaints] query failed:', error);
    return NextResponse.json({ error: 'Could not load reported problems.' }, { status: 500 });
  }
}
