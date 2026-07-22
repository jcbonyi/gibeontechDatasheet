'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ProductionGuard } from '@/components/ProductionGuard';
import { ProductionEntryForm, useProductionLookups } from '@/components/ProductionEntryForm';
import { PageHeader } from '@/components/PageHeader';

export default function NewProductionEntryPage() {
  const { insurers, users, vatRate } = useProductionLookups();

  return (
    <AuthGuard>
      <ProductionGuard>
        <AppShell>
          <PageHeader title="New production entry" subtitle="Record a valuation production job" />
          <ProductionEntryForm insurers={insurers} users={users} vatRate={vatRate} />
        </AppShell>
      </ProductionGuard>
    </AuthGuard>
  );
}
