import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import ProfileSettingsMenu from '../components/ProfileSettingsMenu';

export const metadata: Metadata = {
  title: 'जड़Tak',
  description:
    'A modern platform for community reports, collaboration, and measurable resolution.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 pb-[env(safe-area-inset-bottom)] text-slate-900 antialiased">
        {children}
        <ProfileSettingsMenu />
      </body>
    </html>
  );
}
