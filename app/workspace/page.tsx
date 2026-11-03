import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  return (
    <main className="workspace-shell">
      <header className="workspace-top">
        <a className="brand" href="/"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></a>
        <span className="workspace-label">TEAM WORKSPACE / DEVELOPMENT</span>
      </header>
      <section className="workspace-content">
        <p className="auth-eyebrow">IDENTITAS TERVERIFIKASI</p>
        <h1>Halo, {session.user.name || session.user.email}.</h1>
        <p>Sesi masuk berhasil dibuat. Ruang kerja operasional sedang disiapkan dan belum menampilkan data perusahaan sebelum penugasan peran serta pemeriksaan izin selesai.</p>
        <div className="workspace-status"><span /> Autentikasi aktif · Hak akses operasional belum diberikan</div>
        <a className="workspace-link" href="/">Kembali ke website publik ↗</a>
      </section>
    </main>
  );
}
