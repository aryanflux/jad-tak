'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../../lib/supabase/browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const completeAuth = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          if (result.error) throw result.error;
        }

        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        await supabase.auth.signOut();
        router.replace('/auth?confirmed=1');
      } catch (callbackError) {
        if (active) {
          setError(
            callbackError instanceof Error
              ? callbackError.message
              : 'Email confirmation could not be completed.'
          );
        }
      }
    };
    void completeAuth();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 text-center sm:p-8">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Confirmation link expired</h1>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Confirming your email…</h1>
            <p className="mt-2 text-sm text-slate-500">You will be returned to the login page.</p>
          </>
        )}
      </section>
    </main>
  );
}
