'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role) return;

    const normalizedEmail = email.trim().toLowerCase();
    const registeredRoles = JSON.parse(
      window.localStorage.getItem('jadtak-registered-roles') ?? '{}'
    ) as Record<string, Role>;
    const registeredRole = registeredRoles[normalizedEmail];

    if (mode === 'sign-up' && registeredRole) {
      setError(
        registeredRole === role
          ? 'This email is already registered. Switch to Sign in.'
          : `This email is already registered as ${registeredRole}. One email can only use one role.`
      );
      return;
    }

    if (mode === 'sign-in' && registeredRole && registeredRole !== role) {
      setError(`This email is registered as ${registeredRole}. Select that role to continue.`);
      return;
    }

    registeredRoles[normalizedEmail] = role;
    window.localStorage.setItem('jadtak-registered-roles', JSON.stringify(registeredRoles));
    setError(null);
    setLoading(true);
    window.localStorage.setItem('jadtak-role', role);
    window.localStorage.setItem(
      'jadtak-session',
      JSON.stringify({ email: normalizedEmail, role })
    );
    window.setTimeout(() => router.push(ROUTES[role]), 350);
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
                {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
              </h2>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
              Secure
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Choose your role to open a workspace tailored to your responsibilities.
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
            <button
              type="submit"
              disabled={loading || !role}
              className="w-full rounded-full bg-slate-950 px-4 py-3 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Opening your workspace…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-5 w-full text-sm font-semibold text-green-700 hover:text-green-800"
          >
            {mode === 'sign-in' ? 'New here? Create an account' : 'Already registered? Sign in'}
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">
            Prototype gateway · your selected role is saved for this browser session
          </p>
        </section>
      </div>
    </main>
  );
}
