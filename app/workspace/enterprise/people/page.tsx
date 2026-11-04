import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { OperationsWorkspace } from '../operations';
import { AdvancedOperations } from '../advanced-operations';
export const dynamic='force-dynamic';
export default async function PeopleOperationsPage(){
 const {data}=await auth.getSession();if(!data?.user)redirect('/auth/sign-in');
 const allowed=await hasPermission(data.user.id,'hr.employees.read');
 if(!allowed)return <main className="workspace-shell"><section className="ops-content"><p className="auth-eyebrow">403 / HR ACCESS</p><h1>Akses HRD tidak tersedia.</h1><p>Hubungi Owner atau administrator.</p></section></main>;
 const canManage=await hasPermission(data.user.id,'hr.employees.manage');
 return <><OperationsWorkspace module="people" canManage={canManage}/><AdvancedOperations module="people"/></>;
}
