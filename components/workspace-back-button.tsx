'use client';

import { usePathname, useRouter } from 'next/navigation';

function getFallback(pathname: string) {
  if (pathname.startsWith('/workspace/enterprise/finance/subledger')) return '/workspace/enterprise/finance';
  if (pathname.startsWith('/workspace/enterprise/')) return '/workspace/enterprise';
  if (pathname.startsWith('/workspace/crm') || pathname.startsWith('/workspace/reports')) return '/workspace';
  return '/workspace';
}

export function WorkspaceBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || pathname === '/workspace') return null;

  function goBack() {
    const fallback = getFallback(pathname);
    const referrer = document.referrer;
    const sameOrigin = referrer && new URL(referrer).origin === window.location.origin;
    if (sameOrigin && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <div className="workspace-navigation">
      <button type="button" className="workspace-back-button" onClick={goBack} aria-label="Kembali ke menu sebelumnya">
        <span aria-hidden="true">←</span> Kembali
      </button>
    </div>
  );
}
