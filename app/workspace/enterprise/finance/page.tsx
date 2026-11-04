import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import FinanceWorkspace from './finance-workspace';

export const dynamic='force-dynamic';
export default async function FinancePage(){
 const {data}=await auth.getSession();
 if(!data?.user)redirect('/auth/sign-in');
 const [read,manage,reports,approve,periods,dimensions,tax]=await Promise.all([
  hasPermission(data.user.id,'finance.accounts.read'),
  hasPermission(data.user.id,'finance.accounts.manage'),
  hasPermission(data.user.id,'finance.reports.read'),
  hasPermission(data.user.id,'finance.journals.approve'),
  hasPermission(data.user.id,'finance.periods.manage'),
  hasPermission(data.user.id,'finance.dimensions.manage'),
  hasPermission(data.user.id,'finance.tax.manage')
 ]);
 if(!read)return <main className="workspace-shell"><section className="ops-content"><p className="auth-eyebrow">403 / AKSES TERBATAS</p><h1>Akses keuangan tidak tersedia.</h1><p>Hubungi Owner untuk mendapatkan izin yang sesuai.</p><Link href="/workspace/enterprise">Kembali ke Enterprise ↗</Link></section></main>;
 return <FinanceWorkspace permissions={{read,manage,reports,approve,periods,dimensions,tax}}/>;
}
