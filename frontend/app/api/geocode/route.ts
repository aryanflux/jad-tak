import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAPPLS_ENDPOINT = 'https://apis.mapmyindia.com/advancedmaps/v1';

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('latitude'));
  const longitude = Number(request.nextUrl.searchParams.get('longitude'));
  const apiKey = process.env.MAPPLS_API_KEY ?? process.env.NEXT_PUBLIC_MAPPLS_API_KEY;

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
  }
  if (!apiKey || apiKey === 'twwfhvxcjfmdvdhtfgabvrktniubpllrvcyv') {
    return NextResponse.json({ error: 'Mappls is not configured.' }, { status: 503 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `${MAPPLS_ENDPOINT}/${encodeURIComponent(apiKey)}/rev_geocode?lat=${latitude}&lng=${longitude}`,
      { signal: controller.signal, cache: 'no-store' }
    );
    const data = (await response.json().catch(() => null)) as {
      results?: Array<{ locality?: string; city?: string; district?: string; state?: string }>;
    } | null;
    if (!response.ok) {
      return NextResponse.json({ error: 'Mappls reverse geocoding failed.' }, { status: 502 });
    }
    const result = data?.results?.[0];
    const city = result?.locality ?? result?.city ?? result?.district;
    const place = city && result?.state ? `${city}, ${result.state}` : city ?? result?.state ?? null;
    return NextResponse.json({ place });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Mappls reverse geocoding timed out.' }, { status: 504 });
    }
    console.error('[GET /api/geocode] Mappls request failed:', error);
    return NextResponse.json({ error: 'Mappls reverse geocoding failed.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
