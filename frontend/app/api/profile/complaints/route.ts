import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalForDb = globalThis as unknown as { profilePool?: Pool };
const pool =
  globalForDb.profilePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.profilePool = pool;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Route handlers can refresh cookies; read-only rendering cannot.
          }
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in to view your reported problems.' }, { status: 401 });
  }

  try {
    const result = await pool.query(
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
