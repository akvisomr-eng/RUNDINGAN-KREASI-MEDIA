import type { Metadata } from 'next';
import './globals.css';
import './metro-fit.css';
import '@neondatabase/auth-ui/css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Rundingan Kreasi Media | Ideas into meaningful experiences',
  description: 'Rundingan Kreasi Media — ekosistem media, podcast, edukasi, rental, produksi, creative, dan event.',
  applicationName: 'Rundingan Kreasi Media',
  openGraph: { title: 'Rundingan Kreasi Media', description: 'Menghubungkan ide, cerita, dan pengalaman melalui media dan kreativitas.', type: 'website' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><Providers>{children}</Providers></body></html>;
}
