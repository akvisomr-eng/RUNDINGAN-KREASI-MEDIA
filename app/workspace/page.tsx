import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const canReadCrm = await hasPermission(session.user.id, 'crm.parties.read');

  return (
    <main className="workspace-shell">
      <header className="workspace-top">
        <a className="brand" href="/"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></a>
        <span className="workspace-label">TEAM WORKSPACE / DEVELOPMENT</span>
      </header>
      <section className="workspace-content">
        <p className="auth-eyebrow">IDENTITAS TERVERIFIKASI</p>
        <h1>Halo, {session.user.name || session.user.email}.</h1>
        <p>Sesi masuk berhasil dibuat. Pilih ruang kerja sesuai hak akses yang diberikan administrator.</p>
        <div className="workspace-modules">
          <a className={canReadCrm ? 'workspace-module' : 'workspace-module is-locked'} href={canReadCrm ? '/workspace/crm' : '#akses'}>
            <span>01 / CUSTOMER RELATIONSHIP</span>
            <strong>CRM & Relasi Bisnis</strong>
            <small>{canReadCrm ? 'Buka data pelanggan dan pemasok ↗' : 'Menunggu penugasan izin CRM'}</small>
          </a>
          <div className="workspace-module is-locked" id="akses">
            <span>02 / ENTERPRISE CORE</span>
            <strong>Administrasi Perusahaan</strong>
            <small>Menunggu aktivasi peran administrator</small>
          </div>
        </div>
        <div className="workspace-status"><span className={canReadCrm ? 'is-active' : ''} /> {canReadCrm ? 'Autentikasi aktif · Izin CRM aktif' : 'Autentikasi aktif · Hak akses operasional belum diberikan'}</div>
        <a className="workspace-link" href="/">Kembali ke website publik ↗</a>
      </section>
    </main>
  );
}
