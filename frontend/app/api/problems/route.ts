import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProblemRow {
  id: number;
  title: string;
  description: string;
  status: string;
  category: string;
  address: string | null;
  photo_url: string | null;
  created_at: string;
  upvotes: number;
}

export async function GET() {
  try {
    const result = await getDbPool().query<ProblemRow>(
      `SELECT c.id, c.title, c.description, c.status, c.address, c.created_at,
              c.images->0->>'url' AS photo_url,
              cat.name AS category,
              COUNT(cu.user_id)::int AS upvotes
         FROM complaints c
         JOIN categories cat ON cat.id = c.category_id
         LEFT JOIN complaint_upvotes cu ON cu.complaint_id = c.id
        WHERE c.status <> 'resolved'
        GROUP BY c.id, cat.name
        ORDER BY upvotes DESC, c.created_at DESC`,
    );

    return NextResponse.json({
      problems: result.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        description: row.description,
        status: row.status,
        category: row.category,
        location: row.address,
        photoUrl: row.photo_url,
        upvotes: Number(row.upvotes ?? 0),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('[GET /api/problems] failed:', error);
    return NextResponse.json({ error: 'Could not load ongoing problems.' }, { status: 500 });
  }
}
