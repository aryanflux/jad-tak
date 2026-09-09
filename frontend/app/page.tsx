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
      window.localStorage.getItem('jhar-samadhan-registered-roles') ?? '{}'
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
    window.localStorage.setItem('jhar-samadhan-registered-roles', JSON.stringify(registeredRoles));
    setError(null);
    setLoading(true);
    window.localStorage.setItem('jhar-samadhan-role', role);
    window.localStorage.setItem(
      'jhar-samadhan-session',
      JSON.stringify({ email: normalizedEmail, role })
    );

    window.setTimeout(() => {
      router.push(ROUTES[role]);
    }, 350);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-8 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="px-1 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-700">
            SIH26 · Government of Jharkhand
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Jhar-Samadhaan
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            One civic ecosystem for reporting problems, discovering solutions, and turning
            community ideas into measurable action.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              Report issues
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              Collaborate
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              Track impact
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <h2 className="text-2xl font-bold text-slate-950">
            {mode === 'sign-in' ? 'Welcome back' : 'Join Jhar-Samadhaan'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Select your role to open the right workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              I am signing in as
              <select
                required
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="" disabled>
                  Choose your role
                </option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !role}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Opening your workspace…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-5 w-full text-sm font-semibold text-indigo-700 hover:text-indigo-900"
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
