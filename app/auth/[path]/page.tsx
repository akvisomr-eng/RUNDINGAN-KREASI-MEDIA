import { AuthView } from '@neondatabase/auth-ui';
import { authViewPaths } from '@neondatabase/auth-ui/server';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="auth-shell">
      <a className="auth-back" href="/">← Kembali ke Rundingan Kreasi Media</a>
      <section className="auth-panel">
        <p className="auth-eyebrow">RUNDINGAN KREASI MEDIA / TEAM PORTAL</p>
        <h1>Selamat datang<br /><em>kembali.</em></h1>
        <p className="auth-description">Masuk ke ruang kerja terpadu perusahaan.</p>
        <AuthView path={path} />
      </section>
    </main>
  );
}
