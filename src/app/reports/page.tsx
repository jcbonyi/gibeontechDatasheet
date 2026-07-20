'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ReportsHub } from '@/components/ReportsHub';

export default function ReportsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ReportsHub />
      </AppShell>
    </AuthGuard>
  );
}
