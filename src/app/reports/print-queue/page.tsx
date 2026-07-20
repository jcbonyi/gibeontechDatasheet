'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { PrintQueue } from '@/components/PrintQueue';

export default function PrintQueuePage() {
  return (
    <AuthGuard>
      <AppShell>
        <PrintQueue />
      </AppShell>
    </AuthGuard>
  );
}
