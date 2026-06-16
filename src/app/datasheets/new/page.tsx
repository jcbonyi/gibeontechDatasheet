'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { createDefaultFormData, DatasheetFormData } from '@/types/datasheet';

export default function NewDatasheetPage() {
  const router = useRouter();

  const handleSave = async (formData: DatasheetFormData, status: 'draft' | 'submitted') => {
    const res = await fetch('/api/datasheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save');
    if (status === 'submitted') {
      router.push(`/datasheets/${data.datasheet.id}`);
    } else {
      router.replace(`/datasheets/${data.datasheet.id}`);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-6">
          <h1 className="page-title">New Datasheet</h1>
          <p className="page-subtitle">Capture motor claim assessment data</p>
        </div>
        <DatasheetForm
          initialData={createDefaultFormData()}
          onSave={handleSave}
        />
      </AppShell>
    </AuthGuard>
  );
}
