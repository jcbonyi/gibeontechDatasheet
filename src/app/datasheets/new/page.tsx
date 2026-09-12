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

  const initialData = createDefaultFormData(
    user?.role === 'Assessor' ? user.name : '',
  );

  const handleSave = async (formData: DatasheetFormData, status: DatasheetStatus) => {
    const claimNo = formData.basicInfo?.claimNo?.trim() || '';
    const regNo = formData.basicInfo?.regNo?.trim() || '';
    const insurer = formData.basicInfo?.clientInsurer?.trim() || '';

    if (claimNo || regNo) {
      const params = new URLSearchParams();
      if (claimNo) params.set('claimNo', claimNo);
      if (regNo) params.set('regNo', regNo);
      if (insurer) params.set('insurer', insurer);
      const check = await fetchJson<{
        matches?: { serial_no: string; status: string }[];
        message?: string;
      }>(`/api/datasheets/duplicates?${params}`);
      const matches = check.data.matches || [];
      if (check.ok && matches.length > 0) {
        const list = matches
          .slice(0, 8)
          .map((m) => `• ${m.serial_no} (${m.status})`)
          .join('\n');
        const proceed = window.confirm(
          `Possible duplicate${matches.length === 1 ? '' : 's'} already open:\n\n${list}${
            matches.length > 8 ? `\n…and ${matches.length - 8} more` : ''
          }\n\nCreate this instruction anyway?`,
        );
        if (!proceed) return;
      }
    }

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
        <PageHeader
          title="New instruction"
          subtitle="Open a motor assessment, inspection, or re-inspection task"
        />
        <DatasheetForm initialData={initialData} onSave={handleSave} status="instructed" />
      </AppShell>
    </AuthGuard>
  );
}
