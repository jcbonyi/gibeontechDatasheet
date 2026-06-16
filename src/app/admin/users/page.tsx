'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AdminGuard } from '@/components/AdminGuard';
import { AppShell } from '@/components/AppShell';
import { USER_ROLES } from '@/types/datasheet';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Assessor');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || 'Failed to create user');
      return;
    }
    setMessage('User created');
    setName('');
    setEmail('');
    setPassword('');
    load();
  };

  return (
    <AuthGuard>
      <AdminGuard>
      <AppShell>
        <h1 className="mb-6 text-2xl font-bold text-slate-900">User Management</h1>

        <div className="section-card mb-6">
          <h2 className="mb-4 font-semibold text-slate-800">Add User</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="form-input" required />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="form-input" required />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (min 8)" className="form-input" minLength={8} required />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary sm:col-span-2">Create User</button>
          </form>
          {error && <p className="form-error mt-2">{error}</p>}
          {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        </div>

        <div className="section-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{u.name}</td>
                  <td className="py-3 pr-4">{u.email}</td>
                  <td className="py-3 pr-4">{u.role}</td>
                  <td className="py-3">{u.is_active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShell>
      </AdminGuard>
    </AuthGuard>
  );
}
