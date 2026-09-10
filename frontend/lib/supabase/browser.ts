import { createBrowserClient } from '@supabase/ssr';

export interface MockUserMetadata {
  role?: string;
  full_name?: string;
  [key: string]: unknown;
}

export interface MockUser {
  id: string;
  email: string;
  user_metadata: MockUserMetadata;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
}

export interface MockAuthResponse {
  data: {
    user: MockUser | null;
    session: MockSession | null;
  };
  error: Error | null;
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' && parsedUrl.hostname.endsWith('.supabase.co')) {
        return createBrowserClient(url, anonKey);
      }
    } catch {
      // Fallback to mock
    }
  }

  // Safe mock client for AI Studio preview
  const getStoredUser = (): MockUser | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('jadtak_mock_user');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  };

  const setStoredUser = (user: MockUser | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (user) {
        localStorage.setItem('jadtak_mock_user', JSON.stringify(user));
        document.cookie = `jadtak_mock_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800`;
      } else {
        localStorage.removeItem('jadtak_mock_user');
        document.cookie = 'jadtak_mock_user=; path=/; max-age=0';
      }
    } catch {
      // ignore
    }
  };

  return {
    auth: {
      async getSession(): Promise<{ data: { session: MockSession | null }; error: Error | null }> {
        const user = getStoredUser();
        return {
          data: {
            session: user ? { user, access_token: 'mock-access-token' } : null,
          },
          error: null,
        };
      },
      async getUser(): Promise<{ data: { user: MockUser | null }; error: Error | null }> {
        const user = getStoredUser();
        return {
          data: { user },
          error: null,
        };
      },
      async signInWithPassword({ email }: { email: string; password?: string }): Promise<MockAuthResponse> {
        let role = 'citizen';
        let fullName = 'Citizen User';
        if (email.includes('admin')) {
          role = 'govt_admin';
          fullName = 'Aarti Sinha';
        } else if (email.includes('student') || email.includes('bitmesra') || email.includes('iitism')) {
          role = 'student';
          fullName = 'Priya Murmu';
        } else if (email.includes('tatasteel') || email.includes('csr')) {
          role = 'csr';
          fullName = 'Vikramaditya Roy';
        } else if (email.includes('agri') || email.includes('ngo')) {
          role = 'ngo';
          fullName = 'Shweta Kujur';
        }

        const user: MockUser = {
          id: '00000000-0000-0000-0000-000000000017',
          email,
          user_metadata: { role, full_name: fullName },
        };
        setStoredUser(user);
        return {
          data: { user, session: { user, access_token: 'mock-access-token' } },
          error: null,
        };
      },
      async signUp({
        email,
        options,
      }: {
        email: string;
        password?: string;
        options?: { data?: { role?: string; full_name?: string } };
      }): Promise<MockAuthResponse> {
        const user: MockUser = {
          id: '00000000-0000-0000-0000-000000000017',
          email,
          user_metadata: {
            role: options?.data?.role ?? 'citizen',
            full_name: options?.data?.full_name ?? 'Community Member',
          },
        };
        setStoredUser(user);
        return {
          data: { user, session: { user, access_token: 'mock-access-token' } },
          error: null,
        };
      },
      async signOut(): Promise<{ error: Error | null }> {
        setStoredUser(null);
        return { error: null };
      },
      async resend(): Promise<{ error: Error | null }> {
        return { error: null };
      },
      async resetPasswordForEmail(): Promise<{ error: Error | null }> {
        return { error: null };
      },
      async exchangeCodeForSession(_code: string): Promise<MockAuthResponse> {
        const user = getStoredUser() || {
          id: '00000000-0000-0000-0000-000000000017',
          email: 'citizen@jharsamadhaan.gov.in',
          user_metadata: { role: 'citizen', full_name: 'Sunita Soren' },
        };
        setStoredUser(user);
        return {
          data: { user, session: { user, access_token: 'mock-access-token' } },
          error: null,
        };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },
    },
  };
}
