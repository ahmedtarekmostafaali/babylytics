import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Babylytics — baby health tracking',
  description: 'Track feedings, stools, medications, growth and medical records with built-in OCR review.',
  icons: {
    icon: [
      { url: '/Logo.png', type: 'image/png' },
    ],
    apple: '/Logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
