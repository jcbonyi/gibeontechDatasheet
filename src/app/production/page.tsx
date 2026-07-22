'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ProductionGuard } from '@/components/ProductionGuard';
import { ProductionDashboard } from '@/components/ProductionDashboard';

export default function ProductionHomePage() {
  return (
    <AuthGuard>
      <ProductionGuard>
        <AppShell>
          <ProductionDashboard />
        </AppShell>
      </ProductionGuard>
    </AuthGuard>
  );
}
