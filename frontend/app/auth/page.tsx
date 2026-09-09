'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

type Mode = 'sign-in' | 'sign-up';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) router.replace('/');
      });
    } catch (configurationError) {
      setError(configurationError instanceof Error ? configurationError.message : 'Supabase is not configured.');
    }
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { full_name: fullName.trim() } },
            });
      if (result.error) throw result.error;
      if (mode === 'sign-up' && !result.data.session) {
        setNotice('Account created. Check your email to confirm your address, then sign in.');
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">Jhar Samadhan</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {mode === 'sign-in'
            ? 'Sign in to report issues and access your stakeholder workspace.'
            : 'Use your email to join the civic resolution network.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'sign-up' && (
            <label className="block text-sm font-semibold text-slate-700">
              Full name
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-sm font-semibold text-indigo-700"
        >
          {mode === 'sign-in' ? 'Need an account? Create one' : 'Already registered? Sign in'}
        </button>
      </section>
    </main>
  );
}
