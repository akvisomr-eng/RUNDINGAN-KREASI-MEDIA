'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/auth/client';

const titles: Record<string, { title: string; description: string }> = {
  'sign-in': { title: 'Selamat datang kembali.', description: 'Masuk ke ruang kerja terpadu perusahaan.' },
  'sign-up': { title: 'Buat akun tim.', description: 'Pendaftaran akun tidak otomatis memberikan izin modul.' },
  'forgot-password': { title: 'Atur ulang sandi.', description: 'Kami akan mengirimkan tautan pemulihan ke email Anda.' },
  'update-password': { title: 'Sandi baru.', description: 'Gunakan sandi kuat yang belum pernah dipakai.' },
  callback: { title: 'Memverifikasi sesi.', description: 'Mohon tunggu, kami sedang mengonfirmasi akses Anda.' },
};
const safeNext = (value: string | null) => value?.startsWith('/') && !value.startsWith('//') ? value : '/workspace';

export function AuthForm({ path }: { path: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const meta = titles[path];

  useEffect(() => {
    if (path !== 'callback') return;
    let active = true;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) setError(exchangeError.message); return; }
      }
      const callbackError = url.searchParams.get('error_description') || url.searchParams.get('error');
      if (callbackError) { if (active) setError(callbackError); return; }
      const destination = safeNext(url.searchParams.get('next'));
      if (active) router.replace(destination);
    })();
    return () => { active = false; };
  }, [path, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    const supabase = createSupabaseBrowserClient();
    try {
      if (path === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(safeNext(search.get('next'))); router.refresh();
      } else if (path === 'sign-up') {
        const name = String(values.get('full_name') || '').trim();
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) { router.replace('/workspace'); router.refresh(); }
        else setMessage('Akun dibuat. Periksa email untuk mengonfirmasi alamat Anda sebelum masuk.');
      } else if (path === 'forgot-password') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        });
        if (authError) throw authError;
        setMessage('Jika email terdaftar, tautan pemulihan akan segera dikirim.');
      } else if (path === 'update-password') {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage('Sandi berhasil diperbarui. Anda akan diarahkan ke workspace.');
        window.setTimeout(() => { router.replace('/workspace'); router.refresh(); }, 800);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Autentikasi gagal. Silakan coba lagi.');
    } finally { setBusy(false); }
  }

  if (!meta) return <main className="auth-shell"><section className="auth-panel"><h1>Halaman autentikasi tidak ditemukan.</h1><Link href="/auth/sign-in">Masuk ke portal ↗</Link></section></main>;

  return <main className="auth-shell">
    <Link className="auth-back" href="/">← Kembali ke Rundingan Kreasi Media</Link>
    <section className="auth-panel">
      <p className="auth-eyebrow">RUNDINGAN KREASI MEDIA / TEAM PORTAL</p>
      <h1>{meta.title}</h1>
      <p className="auth-description">{meta.description}</p>
      {error ? <p className="auth-feedback error" role="alert">{error}</p> : null}
      {message ? <p className="auth-feedback" role="status">{message}</p> : null}
      {path === 'callback' ? <p className="auth-description">{error ? 'Tautan tidak valid atau kedaluwarsa.' : 'Mengonfirmasi tautan aman…'}</p> : null}
      {path !== 'callback' ? <form className="auth-form" onSubmit={submit}>
        {path === 'sign-up' ? <label>Nama lengkap<input name="full_name" autoComplete="name" maxLength={160} required /></label> : null}
        {path !== 'update-password' ? <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label> : null}
        {path === 'sign-in' || path === 'sign-up' || path === 'update-password' ? <label>{path === 'update-password' ? 'Sandi baru' : 'Sandi'}<input name="password" type="password" autoComplete={path === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} required /></label> : null}
        {path === 'sign-in' || path === 'sign-up' || path === 'update-password' ? <button disabled={busy}>{busy ? 'Memproses…' : path === 'sign-in' ? 'Masuk' : path === 'sign-up' ? 'Daftar akun' : 'Perbarui sandi'}</button> : null}
        {path === 'forgot-password' ? <button disabled={busy}>{busy ? 'Mengirim…' : 'Kirim tautan pemulihan'}</button> : null}
      </form> : null}
      {path === 'sign-in' ? <div className="auth-links"><Link href="/auth/forgot-password">Lupa sandi?</Link><span>Belum punya akun? <Link href="/auth/sign-up">Daftar</Link></span></div> : null}
      {path === 'sign-up' ? <div className="auth-links"><span>Sudah punya akun? <Link href="/auth/sign-in">Masuk</Link></span></div> : null}
      {path === 'forgot-password' || path === 'update-password' ? <div className="auth-links"><Link href="/auth/sign-in">Kembali ke masuk</Link></div> : null}
    </section>
  </main>;
}
