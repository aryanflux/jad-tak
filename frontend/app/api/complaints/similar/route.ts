import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { text?: unknown; categoryCode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  if (text.length < 10) return NextResponse.json({ complaints: [] });

  const embeddingResponse = await fetch(
    `${process.env.SBERT_SERVICE_URL ?? 'http://localhost:8000/api/v1/embed'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  );
  if (!embeddingResponse.ok) return NextResponse.json({ complaints: [] });
  const embeddingPayload = (await embeddingResponse.json()) as { embedding?: unknown };
  if (!Array.isArray(embeddingPayload.embedding) || embeddingPayload.embedding.length !== 384) {
    return NextResponse.json({ complaints: [] });
  }

  try {
    const pool = getDbPool();
    const categoryCode =
      typeof body.categoryCode === 'string' ? body.categoryCode.trim().toUpperCase() : null;
    const embedding = `[${embeddingPayload.embedding.join(',')}]`;
    const result = await pool.query<{
      id: number;
      title: string;
      description: string;
      status: string;
      category_name: string;
      similarity: number;
    }>(
      `SELECT c.id, c.title, c.description, c.status, cat.name AS category_name,
              1 - (c.embedding <=> $1::vector) AS similarity
         FROM complaints c
         JOIN categories cat ON cat.id = c.category_id
         LEFT JOIN categories parent ON parent.id = cat.parent_id
        WHERE c.embedding IS NOT NULL
          AND ($2::text IS NULL OR cat.code = $2 OR parent.code = $2)
        ORDER BY c.embedding <=> $1::vector
        LIMIT 5`,
      [embedding, categoryCode]
    );
    return NextResponse.json({
      complaints: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        category: row.category_name,
        similarity: Math.round(Number(row.similarity) * 1000) / 1000,
      })),
    });
  } catch (error) {
    console.error('[POST /api/complaints/similar] query failed:', error);
    return NextResponse.json({ complaints: [] });
  }
}
