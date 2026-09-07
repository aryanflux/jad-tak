import Link from 'next/link';
import CitizenIntakeForm from '../../components/CitizenIntakeForm';

export default function ComplaintIntakePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
      >
        ← Back to module hub
      </Link>

      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">
          Module 1 · Citizen intake
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Lodge a complaint
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Tell us what happened, where it happened and how you would like your
          report to be shared. You can add photos and location from your device.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-8">
        <CitizenIntakeForm userId={17} />
      </section>
    </main>
  );
}
