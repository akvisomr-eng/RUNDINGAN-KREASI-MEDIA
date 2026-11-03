import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { PartiesManager } from './parties-manager';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const allowed = await hasPermission(session.user.id, 'crm.parties.read');
  if (!allowed) {
    return (
      <main className="workspace-shell">
        <section className="workspace-content">
          <p className="auth-eyebrow">403 / AKSES TERBATAS</p>
          <h1>Ruang CRM belum dibuka.</h1>
          <p>Hubungi administrator untuk memperoleh izin CRM sesuai unit kerja.</p>
          <Link className="workspace-link" href="/workspace">Kembali ke workspace ↗</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-top">
        <a className="brand" href="/workspace"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></a>
        <span className="workspace-label">CRM / SHARED BUSINESS DIRECTORY</span>
      </header>
      <section className="crm-page-content">
        <div className="crm-page-title">
          <div><p className="auth-eyebrow">WORKSPACE / CRM / 01</p><h1>Relasi bisnis,<br /><em>terhubung.</em></h1></div>
          <Link href="/workspace">← Workspace</Link>
        </div>
        <PartiesManager />
      </section>
    </main>
  );
}
