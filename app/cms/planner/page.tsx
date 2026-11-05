import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import SeoPlannerWorkspace from './workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SEO Content Planner | Rundingan Kreasi Media', robots: { index: false, follow: false } };

export default async function SeoPlannerPage() {
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const [canRead, canCreate, canUpdate] = await Promise.all([
    hasPermission(data.user.id, 'cms.posts.read'),
    hasPermission(data.user.id, 'cms.posts.create'),
    hasPermission(data.user.id, 'cms.posts.update'),
  ]);
  if (!canRead) return <main className="cms-shell"><section className="cms-panel" style={{ maxWidth: 680, margin: '12vh auto' }}><p className="cms-kicker">403 / AKSES TERBATAS</p><h1>SEO Planner belum dapat diakses.</h1><p>Halaman ini memerlukan izin cms.posts.read.</p><a href="/cms">Kembali ke CMS ↗</a></section></main>;
  return <SeoPlannerWorkspace userName={data.user.name || data.user.email || 'Editor'} canCreate={canCreate} canUpdate={canUpdate} />;
}
