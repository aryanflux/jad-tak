import Link from 'next/link';
import CitizenIntakeForm from '../../components/CitizenIntakeForm';

export default function ComplaintIntakePage() {
  return (
    <main className="brand-shell brand-glow mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="text-sm font-semibold text-green-700 hover:text-green-900"
      >
        ← Back to workspace
      </Link>

      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
          Community intake
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Share a community issue
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Describe what happened, where it happened, and how you would like the
          report to be shared. You can add photos and location from your device.
        </p>
      </header>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-md sm:p-8">
        <CitizenIntakeForm userId={17} />
      </section>
    </main>
  );
}
