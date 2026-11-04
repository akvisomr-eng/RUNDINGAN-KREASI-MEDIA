import Link from 'next/link';
import {redirect} from 'next/navigation';
import {auth} from '@/lib/auth/server';
import {hasPermission} from '@/lib/auth/permissions';
import {ModuleCatalog} from './module-catalog';
export const dynamic='force-dynamic';
export default async function ModulesPage(){
 const {data}=await auth.getSession();if(!data?.user)redirect('/auth/sign-in');
 const [read,manage]=await Promise.all([hasPermission(data.user.id,'modules.catalog.read'),hasPermission(data.user.id,'modules.catalog.manage')]);
 if(!read)return <main className="workspace-shell"><section className="ops-content"><p className="auth-eyebrow">403 / AKSES TERBATAS</p><h1>Katalog plugin tidak tersedia.</h1><Link className="workspace-link" href="/workspace/enterprise">Kembali ↗</Link></section></main>;
 return <main className="workspace-shell"><header className="workspace-top"><Link className="brand" href="/workspace/enterprise"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></Link><span className="workspace-label">ENTERPRISE CORE / PLUGIN CATALOG</span></header><section className="ops-content"><div className="ops-heading"><div><p className="auth-eyebrow">MODULAR BUSINESS PLATFORM</p><h1>Katalog modul & plugin</h1><p>Aktifkan modul sesuai kebutuhan kontrak klien. Semua modul menggunakan organisasi, autentikasi, audit, master data, dan database bersama.</p></div><Link className="enterprise-back" href="/workspace/enterprise">← Administrasi</Link></div><ModuleCatalog canManage={manage}/></section></main>;
}
