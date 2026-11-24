import type { Metadata } from 'next';
import AiCompanionWidget from '../src/components/AiCompanionWidget';
import './globals.css';

export const metadata: Metadata = {
  title: 'WicaraSehat — SIMKLINIK Desktop & Portal Resmi Klinik Terapi Wicara',
  description:
    'Sistem Manajemen Klinik Terapi Wicara (RME Permenkes 24/2022, Standar Pelayanan Permenkes 81/2014, Bridging SATUSEHAT, Akreditasi Klinik & Pelindungan Data UU PDP).',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {children}
        <AiCompanionWidget />
      </body>
    </html>
  );
}
