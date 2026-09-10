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
    if (new URLSearchParams(window.location.search).get('confirmed') === '1') {
      setNotice('Email confirmed. Sign in to continue.');
    }
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
              options: {
                data: { full_name: fullName.trim() },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
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

  const resendConfirmation = async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError) throw resendError;
      setNotice('A new confirmation email was requested. Check spam or promotions too.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the confirmation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">जड़Tak</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {mode === 'sign-in' ? 'Welcome back' : 'Get started'}
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
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
            />
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {error && error.toLowerCase().includes('email not confirmed') && (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={loading || !email.trim()}
              className="min-h-[44px] w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {loading ? 'Requesting email…' : 'Resend confirmation email'}
            </button>
          )}
          {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
          {notice && mode === 'sign-up' && (
            <button
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={loading || !email.trim()}
              className="min-h-[44px] w-full rounded-xl border border-green-200 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
            >
              {loading ? 'Requesting email…' : 'Resend confirmation email'}
            </button>
          )}
          <button
            disabled={loading}
            className="w-full rounded-full bg-slate-950 px-4 py-3 font-bold text-white transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Register'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-sm font-semibold text-green-700"
        >
          {mode === 'sign-in' ? 'New here? Register now' : 'Already registered? Sign in'}
        </button>
      </section>
    </main>
  );
}
