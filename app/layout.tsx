import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'CampusFix: Maintenance Reporting',
  description:
    'Report and track campus maintenance issues. Corroborate reports, monitor status, and keep the campus running.',
  openGraph: {
    title: 'CampusFix: University Operations Maintenance Reporting System',
    description:
      'Report and track campus maintenance issues. Corroborate reports, monitor status, and keep the campus running.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CampusFix: University Operations Maintenance Reporting System',
    description:
      'Report and track campus maintenance issues. Corroborate reports, monitor status, and keep the campus running.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${fontSans.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
