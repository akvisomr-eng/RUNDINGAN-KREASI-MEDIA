import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { OperationsWorkspace } from '../operations';

export const dynamic = 'force-dynamic';

const modules: Record<string,{read:string;manage:string}> = {
  access: {read:'core.users.read',manage:'core.users.manage'},
  structure: {read:'core.business_units.read',manage:'core.business_units.manage'},
  governance: {read:'core.audit.read',manage:'core.audit.read'},
  finance: {read:'finance.accounts.read',manage:'finance.accounts.manage'},
  people: {read:'hr.employees.read',manage:'hr.employees.manage'},
  inventory: {read:'inventory.items.read',manage:'inventory.items.manage'},
  academy: {read:'academy.work.read',manage:'academy.work.manage'},
  creative: {read:'creative.work.read',manage:'creative.work.manage'},
  event: {read:'event.work.read',manage:'event.work.manage'},
  media: {read:'media.work.read',manage:'media.work.manage'},
  production: {read:'production.work.read',manage:'production.work.manage'},
};

export default async function EnterpriseModulePage({params}:{params:Promise<{module:string}>}) {
  const {module}=await params;
  const config=modules[module];
  if(!config)notFound();
  const {data}=await auth.getSession();
  if(!data?.user)redirect('/auth/sign-in');
  const allowed=await hasPermission(data.user.id,config.read);
  if(!allowed) {
    return <main className="workspace-shell"><section className="ops-content"><p className="auth-eyebrow">403 / AKSES TERBATAS</p><h1>Akses modul tidak tersedia.</h1><p>Hubungi Owner atau administrator untuk mendapatkan izin yang sesuai.</p><a className="workspace-link" href="/workspace/enterprise">Kembali ke administrasi ↗</a></section></main>;
  }
  const canManage=module==='structure' ? await Promise.all(['core.business_units.manage','core.departments.manage','core.locations.manage'].map(p=>hasPermission(data.user.id,p))).then(x=>x.some(Boolean)) : await hasPermission(data.user.id,config.manage);
  return <><div className="ops-content"><p className="ops-quick-links"><Link href="/workspace/enterprise/reports">Laporan operasional HRD & Inventaris ↗</Link></p></div><OperationsWorkspace module={module} canManage={canManage}/></>;
}
