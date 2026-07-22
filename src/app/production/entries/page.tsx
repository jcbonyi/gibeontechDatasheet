'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ProductionGuard } from '@/components/ProductionGuard';
import { ProductionRegister } from '@/components/ProductionRegister';

export default function ProductionEntriesPage() {
  return (
    <AuthGuard>
      <ProductionGuard>
        <AppShell>
          <ProductionRegister />
        </AppShell>
      </ProductionGuard>
    </AuthGuard>
  );
}
