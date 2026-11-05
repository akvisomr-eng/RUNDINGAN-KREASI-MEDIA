import type { Metadata } from 'next';
import './globals.css';
import './metro-fit.css';
import '@neondatabase/auth-ui/css';
import { Providers } from './providers';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Rundingan Kreasi Media | Ideas into meaningful experiences',
  description: 'Rundingan Kreasi Media — ekosistem media, podcast, edukasi, rental, produksi, creative, dan event.',
  applicationName: 'Rundingan Kreasi Media',
  alternates: { canonical: '/' },
  openGraph: { title: 'Rundingan Kreasi Media', description: 'Menghubungkan ide, cerita, dan pengalaman melalui media dan kreativitas.', type: 'website', url: '/' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Rundingan Kreasi Media',
      url: SITE_URL,
      description: 'Ekosistem media, podcast, edukasi, rental, produksi, creative, dan event.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Rundingan Kreasi Media',
      url: SITE_URL,
      inLanguage: 'id-ID',
    },
  ];

  return <html lang="id"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
    <Providers>{children}</Providers>
  </body></html>;
}
