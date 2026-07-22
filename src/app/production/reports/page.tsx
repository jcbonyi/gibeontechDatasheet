'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ProductionGuard } from '@/components/ProductionGuard';
import { ProductionReportsHub } from '@/components/ProductionReportsHub';

export default function ProductionReportsPage() {
  return (
    <AuthGuard>
      <ProductionGuard>
        <AppShell>
          <ProductionReportsHub />
        </AppShell>
      </ProductionGuard>
    </AuthGuard>
  );
}
