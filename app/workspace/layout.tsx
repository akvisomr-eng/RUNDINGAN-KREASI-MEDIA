import type { ReactNode } from 'react';
import { WorkspaceBackButton } from '@/components/workspace-back-button';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspaceBackButton />
      {children}
    </>
  );
}
