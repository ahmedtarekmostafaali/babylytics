import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Babylytics — baby health tracking',
  description: 'Track feedings, stools, medications, growth and medical records with built-in OCR review.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-full">{children}</body>
    </html>
  );
}
