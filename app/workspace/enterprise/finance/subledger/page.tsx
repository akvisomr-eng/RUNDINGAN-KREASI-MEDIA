import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import SubledgerWorkspace from './subledger-workspace';

export const dynamic='force-dynamic';
export default async function FinanceSubledgerPage(){
 const {data}=await auth.getSession();if(!data?.user)redirect('/auth/sign-in');
 const [ar,ap,cash]=await Promise.all([
  hasPermission(data.user.id,'finance.ar.read'),hasPermission(data.user.id,'finance.ap.read'),hasPermission(data.user.id,'finance.cash.read')
 ]);
 if(!ar&&!ap&&!cash)return <main className="workspace-shell"><section className="ops-content"><h1>Akses subledger tidak tersedia.</h1><Link href="/workspace/enterprise/finance">Kembali ke Finance ↗</Link></section></main>;
 return <SubledgerWorkspace permissions={{ar,ap,cash,manageAR:await hasPermission(data.user.id,'finance.ar.manage'),manageAP:await hasPermission(data.user.id,'finance.ap.manage'),manageCash:await hasPermission(data.user.id,'finance.cash.manage')}}/>;
}
