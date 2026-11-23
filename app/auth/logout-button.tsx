'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/auth/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="auth-logout" disabled={busy} onClick={async () => {
    setBusy(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace('/auth/sign-in');
    router.refresh();
  }}>{busy ? 'Keluar…' : 'Keluar'}</button>;
}
