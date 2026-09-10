'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setName((data.user?.user_metadata?.full_name as string | undefined) ?? null);
    };
    void loadProfile();
  }, []);

  return (
    <main className="brand-shell brand-glow mx-auto min-h-screen w-full max-w-2xl px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top))]">
      <section className="surface-card p-6 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-green-700 hover:text-green-900">
          ← Back to workspace
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Your profile</h1>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-slate-500">Name</dt>
            <dd className="mt-1 text-slate-900">{name || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Email</dt>
            <dd className="mt-1 text-slate-900">{email || 'Not available'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
