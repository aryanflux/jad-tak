import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import ProfileSettingsMenu from '../components/ProfileSettingsMenu';

export const metadata: Metadata = {
  title: 'जड़Tak',
  description:
    'A community reporting and resolution platform bridging citizens, academia, and industry.',
  openGraph: {
    title: 'जड़Tak',
    description:
      'A community reporting and resolution platform bridging citizens, academia, and industry.',
  },
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
