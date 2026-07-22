'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { ProductionGuard } from '@/components/ProductionGuard';
import { ProductionEntryForm, useProductionLookups } from '@/components/ProductionEntryForm';
import { PageHeader } from '@/components/PageHeader';
import type { ProductionStatus } from '@/lib/productionConfig';

export default function EditProductionEntryPage() {
  const params = useParams();
  const id = Number(params.id);
  const { insurers, users, vatRate } = useProductionLookups();
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/production/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load');
        setInitial(data.entry);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <AuthGuard>
      <ProductionGuard>
        <AppShell>
          <PageHeader
            title="Edit production entry"
            subtitle={initial ? String(initial.registration_number || '') : 'Loading…'}
          />
          {error && <p className="form-error mb-4">{error}</p>}
          {initial && (
            <ProductionEntryForm
              entryId={id}
              insurers={insurers}
              users={users}
              vatRate={vatRate}
              initial={{
                production_date: String(initial.production_date).slice(0, 10),
                insurer_id: Number(initial.insurer_id),
                registration_number: String(initial.registration_number || ''),
                assignment: initial.assignment != null ? String(initial.assignment) : '',
                amount: Number(initial.amount),
                done_by_user_id: (initial.done_by_user_id as number | null) ?? null,
                seen_by_user_id: (initial.seen_by_user_id as number | null) ?? null,
                instructed_by_user_id: (initial.instructed_by_user_id as number | null) ?? null,
                remarks: String(initial.remarks || ''),
                status: initial.status as ProductionStatus,
              }}
            />
          )}
        </AppShell>
      </ProductionGuard>
    </AuthGuard>
  );
}
