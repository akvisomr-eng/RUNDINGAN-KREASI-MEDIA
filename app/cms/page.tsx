import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import CmsWorkspace from './workspace';
import './cms.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CMS Workspace | Rundingan Kreasi Media',
  robots: { index: false, follow: false },
};

export default async function CmsPage() {
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');

  const [canRead, canCreate, canAudit] = await Promise.all([
    hasPermission(data.user.id, 'cms.posts.read'),
    hasPermission(data.user.id, 'cms.posts.create'),
    hasPermission(data.user.id, 'cms.seo.audit'),
  ]);

  if (!canRead) {
    return (
      <main className="cms-shell">
        <section className="cms-panel" style={{ maxWidth: 680, margin: '12vh auto' }}>
          <p className="cms-kicker">403 / AKSES TERBATAS</p>
          <h1>Akses CMS belum diberikan.</h1>
          <p>Hubungi administrator untuk memperoleh peran editor, administrator, atau owner.</p>
          <a href="/workspace">Kembali ke workspace ↗</a>
        </section>
      </main>
    );
  }

  return <CmsWorkspace userName={data.user.name || data.user.email || 'Editor'} canCreate={canCreate} canAudit={canAudit} />;
}
