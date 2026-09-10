'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabase/browser';

export default function ProfileSettingsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  if (pathname === '/' || pathname === '/auth') {
    return null;
  }

  const signOut = async (switchAccount = false) => {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/auth');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
      if (switchAccount) setOpen(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user?.email) throw new Error('No email address is linked to this account.');
      const { error } = await supabase.auth.resetPasswordForEmail(data.user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setMessage('Password reset instructions sent to your email.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send reset instructions.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={menuRef} className="fixed right-3 top-0 z-50 pt-[env(safe-area-inset-top)] sm:right-6">
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Open profile settings"
          onClick={() => setOpen((current) => !current)}
          className="mt-2 flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-md touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700" aria-hidden="true">
            ☺
          </span>
          <span className="hidden sm:inline">Account</span>
          <span aria-hidden="true" className="text-xs">⌄</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15"
          >
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium text-slate-700 touch-manipulation hover:bg-green-50 hover:text-green-800"
            >
              View Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void signOut(true)}
              className="flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm font-medium text-slate-700 touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-green-50 hover:text-green-800 disabled:opacity-50"
            >
              Switch Account
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void resetPassword()}
              className="flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm font-medium text-slate-700 touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-green-50 hover:text-green-800 disabled:opacity-50"
            >
              Reset Password
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void signOut()}
              className="flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-rose-700 touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-rose-50 disabled:opacity-50"
            >
              Sign Out
            </button>
            {message && (
              <p role="status" className="px-3 pb-1 pt-2 text-xs leading-relaxed text-slate-500">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
