import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import CmsWorkspace from './workspace';
import './cms.css';

export const metadata = {
  title: 'CMS Workspace | Rundingan Kreasi Media',
  robots: { index: false, follow: false },
};

export default async function CmsPage() {
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  return <CmsWorkspace userName={data.user.name || data.user.email || 'Editor'} />;
}
