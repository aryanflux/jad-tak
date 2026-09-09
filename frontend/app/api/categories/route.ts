import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const result = await pool.query<{
      code: string;
      name: string;
      parent_code: string | null;
      parent_name: string | null;
    }>(
      `SELECT c.code, c.name, parent.code AS parent_code, parent.name AS parent_name
         FROM categories c
         LEFT JOIN categories parent ON parent.id = c.parent_id
        WHERE c.is_active = TRUE
        ORDER BY parent.name NULLS FIRST, c.name`
    );
    return NextResponse.json({
      categories: result.rows.filter((row) => !row.parent_code),
      subdivisions: result.rows
        .filter((row) => row.parent_code)
        .map((row) => ({ code: row.code, name: row.name, parentCode: row.parent_code })),
    });
  } catch (error) {
    console.error('[GET /api/categories] query failed:', error);
    return NextResponse.json({ error: 'Failed to load categories.' }, { status: 500 });
  }
}
