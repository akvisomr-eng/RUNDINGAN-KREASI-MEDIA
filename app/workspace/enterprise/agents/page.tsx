import Link from 'next/link';
import {redirect} from 'next/navigation';
import {auth} from '@/lib/auth/server';
import {hasPermission} from '@/lib/auth/permissions';
import {AgentConsole} from './agent-console';
export const dynamic='force-dynamic';
export default async function AgentsPage(){
 const {data}=await auth.getSession();if(!data?.user)redirect('/auth/sign-in');
 const [read,run]=await Promise.all([hasPermission(data.user.id,'agents.read'),hasPermission(data.user.id,'agents.run')]);
 if(!read)return <main className="workspace-shell"><section className="ops-content"><h1>Akses agen AI terbatas.</h1><Link className="workspace-link" href="/workspace/enterprise">Kembali ↗</Link></section></main>;
 return <main className="workspace-shell"><header className="workspace-top"><Link className="brand" href="/workspace/enterprise"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></Link><span className="workspace-label">ENTERPRISE CORE / MULTI-AGENT AI</span></header><section className="ops-content"><div className="ops-heading"><div><p className="auth-eyebrow">EMBEDDED DOMAIN INTELLIGENCE</p><h1>Multi-Agent AI Control</h1><p>Agen menjalankan pemeriksaan domain berbasis aturan dan pengetahuan lokal, mencatat temuan ke database bersama, dan tidak melakukan perubahan berisiko tanpa persetujuan.</p></div><Link className="enterprise-back" href="/workspace/enterprise">← Administrasi</Link></div><AgentConsole canRun={run}/></section></main>;
}
