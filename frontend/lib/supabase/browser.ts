import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL.');
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'NEXT_PUBLIC_SUPABASE_URL is invalid.'
    );
  }
  return createBrowserClient(url, anonKey);
}
