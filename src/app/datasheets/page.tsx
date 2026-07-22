'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetRegister } from '@/components/DatasheetRegister';

export default function DatasheetsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <Suspense
          fallback={
            <div className="section-card text-sm text-slate-500">Loading task board…</div>
          }
        >
          <DatasheetRegister />
        </Suspense>
      </AppShell>
    </AuthGuard>
  );
}
