'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Problem {
  id: number;
  title: string;
  description: string;
  status: string;
  category: string;
  location: string | null;
  photoUrl: string | null;
  upvotes: number;
  createdAt: string;
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [voted, setVoted] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadProblems = async () => {
      try {
        const response = await fetch('/api/problems', { cache: 'no-store' });
        const payload = (await response.json()) as { problems?: Problem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Could not load ongoing problems.');
        setProblems(payload.problems ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load ongoing problems.');
      } finally {
        setLoading(false);
      }
    };
    void loadProblems();
  }, []);

  const upvote = async (problemId: number) => {
    if (voting !== null || voted.has(problemId)) return;
    setVoting(problemId);
    setProblems((current) =>
      current.map((problem) =>
        problem.id === problemId ? { ...problem, upvotes: problem.upvotes + 1 } : problem,
      ),
    );
    try {
      const response = await fetch(`/api/problems/${problemId}/upvote`, {
        method: 'POST',
      });
      const payload = (await response.json()) as { upvotes?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not record your upvote.');
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId && typeof payload.upvotes === 'number'
            ? { ...problem, upvotes: payload.upvotes }
            : problem,
        ),
      );
      setVoted((current) => new Set(current).add(problemId));
    } catch (voteError) {
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId ? { ...problem, upvotes: Math.max(0, problem.upvotes - 1) } : problem,
        ),
      );
      setError(voteError instanceof Error ? voteError.message : 'Could not record your upvote.');
    } finally {
      setVoting(null);
    }
  };

  return (
    <main className="brand-shell brand-glow min-h-screen px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-semibold text-green-700 hover:text-green-900">
          ← Back to workspace
        </Link>
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-700">Community pulse</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Ongoing problems</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Support issues that still need attention. Problem details are read-only.
          </p>
        </header>

        {error && <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mt-8 text-sm text-slate-500">Loading ongoing problems…</p>}
        {!loading && !error && problems.length === 0 && (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No unresolved problems are currently listed.
          </p>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem) => (
            <article key={problem.id} className="surface-card overflow-hidden transition hover:-translate-y-1 hover:shadow-md">
              {problem.photoUrl ? (
                <img src={problem.photoUrl} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-green-50 text-3xl" aria-hidden="true">⌂</div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">{problem.category}</span>
                  <span className="text-xs font-medium capitalize text-slate-500">{problem.status.replaceAll('_', ' ')}</span>
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-900">{problem.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{problem.description}</p>
                <p className="mt-3 truncate text-xs text-slate-500">📍 {problem.location || 'Location not provided'}</p>
                <button
                  type="button"
                  onClick={() => void upvote(problem.id)}
                  disabled={voting !== null || voted.has(problem.id)}
                  className={`mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    voted.has(problem.id)
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-950 text-white hover:bg-green-700'
                  } disabled:cursor-not-allowed disabled:opacity-80`}
                >
                  <span className="text-lg" aria-hidden="true">{voted.has(problem.id) ? '♥' : '♡'}</span>
                  {voted.has(problem.id) ? 'Upvoted' : 'Upvote'} · {problem.upvotes}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
