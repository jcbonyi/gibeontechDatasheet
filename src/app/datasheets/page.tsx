'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetRegister } from '@/components/DatasheetRegister';

export default function DatasheetsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <DatasheetRegister />
      </AppShell>
    </AuthGuard>
  );
}
