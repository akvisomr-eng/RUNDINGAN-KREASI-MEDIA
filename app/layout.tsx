import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rundingan Kreasi Media | Ideas into meaningful experiences',
  description: 'Ekosistem media, edukasi, rental, produksi, creative, dan event dalam satu kolaborasi.',
  applicationName: 'Rundingan Kreasi Media',
  openGraph: { title: 'Rundingan Kreasi Media', description: 'Menghubungkan ide, cerita, dan pengalaman melalui media dan kreativitas.', type: 'website' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
