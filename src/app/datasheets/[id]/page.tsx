'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { DatasheetFormData, createDefaultFormData } from '@/types/datasheet';

export default function EditDatasheetPage() {
  const params = useParams();
  const id = Number(params.id);
  const [formData, setFormData] = useState<DatasheetFormData | null>(null);
  const [serialNo, setSerialNo] = useState('');
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/datasheets/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        const defaults = createDefaultFormData();
        const loaded = (data.datasheet.form_data as DatasheetFormData) || defaults;
        setFormData({
          ...defaults,
          ...loaded,
          documents: { ...defaults.documents, ...loaded.documents },
        });
        setSerialNo(data.datasheet.serial_no);
        setStatus(data.datasheet.status);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: DatasheetFormData, newStatus: 'draft' | 'submitted') => {
    const res = await fetch(`/api/datasheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: data, status: newStatus }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to save');
    setStatus(result.datasheet.status);
  };

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Loading datasheet...</p>
      </AppShell>
    );
  }

  if (error || !formData) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{error || 'Datasheet not found'}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{serialNo || 'Datasheet'}</h1>
          <p className="page-subtitle">
            Status: <span className="font-medium capitalize text-brand-700">{status}</span>
          </p>
        </div>
      </div>
      <DatasheetForm
        initialData={formData}
        datasheetId={id}
        serialNo={serialNo}
        status={status}
        onSave={handleSave}
      />
    </AppShell>
  );
}
