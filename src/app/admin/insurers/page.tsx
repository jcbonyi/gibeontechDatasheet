'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { canManageProductionAdmin } from '@/lib/productionPermissions';
import Link from 'next/link';

interface Insurer {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function AdminInsurersPage() {
  const { user } = useAuth();
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    fetch('/api/insurers')
      .then((r) => r.json())
      .then((d) => setInsurers(d.insurers || []));
  };

  useEffect(() => {
    load();
  }, []);

  if (!canManageProductionAdmin(user)) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-red-700">Admin access required.</p>
        </AppShell>
      </AuthGuard>
    );
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/insurers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact_person: contact, email, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || 'Failed');
      return;
    }
    setMessage('Insurer created');
    setName('');
    setContact('');
    setEmail('');
    setPhone('');
    load();
  };

  const toggle = async (ins: Insurer) => {
    await fetch(`/api/insurers/${ins.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ins, is_active: !ins.is_active }),
    });
    load();
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/production" className="text-brand-600">Production admin</Link>
          <span className="text-slate-300">/</span>
          <span>Insurers</span>
        </div>
        <h1 className="page-title">Insurers</h1>
        <p className="page-subtitle">Catalog for production entries</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={create} className="section-card space-y-3">
            <h2 className="font-semibold">New insurer</h2>
            <input className="form-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="form-input" placeholder="Contact person" value={contact} onChange={(e) => setContact(e.target.value)} />
            <input className="form-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="form-input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            <button type="submit" className="btn-primary">Create</button>
          </form>

          <div className="section-card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {insurers.map((i) => (
                  <tr key={i.id}>
                    <td className="font-semibold">{i.name}</td>
                    <td className="text-xs">{i.contact_person || i.email || '—'}</td>
                    <td>{i.is_active ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button type="button" className="text-xs font-medium text-brand-600" onClick={() => toggle(i)}>
                        {i.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
