import { AuthForm } from '../auth-form';

export const dynamic = 'force-dynamic';

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <AuthForm path={path} />;
}
