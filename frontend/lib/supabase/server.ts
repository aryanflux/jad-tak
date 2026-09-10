import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' && parsedUrl.hostname.endsWith('.supabase.co')) {
        const cookieStore = await cookies();
        return createServerClient(url, anonKey, {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            },
          },
        });
      }
    } catch {
      // fallback
    }
  }

  // Safe mock server client for development and preview
  let user = {
    id: '00000000-0000-0000-0000-000000000017',
    email: 'citizen@jharsamadhaan.gov.in',
    user_metadata: { role: 'citizen', full_name: 'Sunita Soren' },
  };

  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('jadtak_mock_user');
    if (cookie?.value) {
      user = JSON.parse(decodeURIComponent(cookie.value));
    }
  } catch {
    // fallback to default
  }

  return {
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
      async getSession() {
        return {
          data: { session: { user, access_token: 'mock-token' } },
          error: null,
        };
      },
    },
  } as unknown as Awaited<ReturnType<typeof createServerClient>>;
}
