'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { PageHeader } from '@/components/PageHeader';
import { createDefaultFormData, DatasheetFormData, type DatasheetStatus } from '@/types/datasheet';
import { useAuth } from '@/context/AuthContext';

import { fetchJson } from '@/lib/fetchJson';

export default function NewDatasheetPage() {
  const router = useRouter();
  const { user } = useAuth();

  const initialData = createDefaultFormData(user?.name);

  const handleSave = async (formData: DatasheetFormData, status: DatasheetStatus) => {
    const { ok, data } = await fetchJson<{ message?: string; datasheet: { id: number } }>(
      '/api/datasheets',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, status }),
      },
    );
    if (!ok) throw new Error(data.message || 'Failed to save');
    router.replace(`/datasheets/${data.datasheet.id}`);
  };

  return (
    <AuthGuard>
      <AppShell>
        <PageHeader title="New Datasheet" subtitle="Capture motor claim assessment data" />
        <DatasheetForm initialData={initialData} onSave={handleSave} />
      </AppShell>
    </AuthGuard>
  );
}
