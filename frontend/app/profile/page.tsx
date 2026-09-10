'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

interface Complaint {
  id: number;
  title: string;
  status: string;
  createdAt: string;
}

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!data.user) {
          setError('Sign in to view your profile.');
          return;
        }
        setEmail(data.user.email ?? null);
        setName((data.user.user_metadata?.full_name as string | undefined) ?? null);

        const response = await fetch('/api/profile/complaints', { cache: 'no-store' });
        const payload = (await response.json()) as { complaints?: Complaint[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Could not load reported problems.');
        setComplaints(payload.complaints ?? []);
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : 'Could not load your profile.');
      } finally {
        setLoadingComplaints(false);
      }
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

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-bold text-slate-900">Reported problems</h2>
          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
          {loadingComplaints && <p className="mt-3 text-sm text-slate-500">Loading your reports…</p>}
          {!loadingComplaints && !error && complaints.length === 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              You have not reported any problems yet.
            </p>
          )}
          {!loadingComplaints && complaints.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
              {complaints.map((complaint) => (
                <li key={complaint.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{complaint.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {new Date(complaint.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">
                    {complaint.status.replaceAll('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
