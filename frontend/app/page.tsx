'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabase/browser';

type Role = 'citizen' | 'govt_admin' | 'institution' | 'student' | 'ngo' | 'csr';

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'govt_admin', label: 'Government Admin' },
  { value: 'institution', label: 'Institution' },
  { value: 'student', label: 'Student' },
  { value: 'ngo', label: 'NGO' },
  { value: 'csr', label: 'Corporate / CSR' },
];

const ROUTES: Record<Role, string> = {
  citizen: '/intake',
  govt_admin: '/admin/complaints?admin=1',
  institution: '/academic/opportunities?uid=5',
  student: '/academic/opportunities?uid=5',
  ngo: '/industry/marketplace?pid=2',
  csr: '/industry/marketplace?pid=2',
};

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [role, setRole] = useState<Role | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        const savedRole = data.session?.user.user_metadata?.role as Role | undefined;
        if (savedRole && savedRole in ROUTES) router.replace(ROUTES[savedRole]);
      });
    } catch (configurationError) {
      setError(
        configurationError instanceof Error
          ? configurationError.message
          : 'Authentication is not configured.'
      );
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role || !email.trim() || !password) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      const result =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
          : await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: {
                data: { role },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
            });
      if (result.error) throw result.error;
      if (mode === 'sign-up' && !result.data.session) {
        setNotice('Registration successful. Confirm your email, then sign in.');
        return;
      }
      const savedRole = result.data.user?.user_metadata?.role as Role | undefined;
      if (mode === 'sign-in' && savedRole && savedRole !== role) {
        await supabase.auth.signOut();
        throw new Error(`This profile is registered for the ${savedRole} workspace.`);
      }
      const authenticatedRole =
        savedRole ?? role;
      router.replace(ROUTES[authenticatedRole in ROUTES ? authenticatedRole : role]);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof TypeError && submitError.message === 'Failed to fetch'
          ? 'Cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL is the exact Project URL from Supabase, then redeploy.'
          : submitError instanceof Error
            ? submitError.message
            : 'Authentication failed. Check your email and password.';
      setError(
        message
      );
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
        email: email.trim().toLowerCase(),
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
    <main className="min-h-screen brand-glow px-4 py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="px-1 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-lg font-black text-white shadow-lg shadow-green-600/20">
              JT
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">जड़Tak</span>
          </div>
          <p className="mt-16 text-xs font-bold uppercase tracking-[0.25em] text-green-700">
            Community operations platform
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-6xl">
            Bridging Citizens, Academia, and Industry
            <span className="block text-green-600">to Solve Civic Challenges.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Bring community reports, trusted partners, and resolution teams into one clear,
            collaborative workspace.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
            {[
              ['Report', 'Capture what matters'],
              ['Connect', 'Find the right team'],
              ['Resolve', 'Track real progress'],
            ].map(([title, description]) => (
              <div key={title} className="surface-card p-4 transition-all duration-200 hover:-translate-y-1">
                <p className="font-bold text-slate-950">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
                Workspace access
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {mode === 'sign-in' ? 'Welcome back' : 'Get started'}
              </h2>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
              Secure
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {mode === 'sign-in'
              ? 'Enter your credentials to return to your workspace anytime.'
              : 'Register with your email to access your stakeholder workspace.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              I am signing in as
              <select
                required
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
              >
                <option value="" disabled>Choose your role</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
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
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
              />
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {notice && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
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
              type="submit"
              disabled={loading || !role}
              className="w-full rounded-full bg-slate-950 px-4 py-3 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Opening your workspace…' : mode === 'sign-in' ? 'Sign in' : 'Register'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-5 w-full text-sm font-semibold text-green-700 hover:text-green-800"
          >
            {mode === 'sign-in' ? 'New here? Register now' : 'Already registered? Sign in'}
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">
            Protected by Supabase authentication. Your session persists across visits.
          </p>
        </section>
      </div>
    </main>
  );
}
