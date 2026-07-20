'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <AnalyticsDashboard />
      </AppShell>
    </AuthGuard>
  );
}
