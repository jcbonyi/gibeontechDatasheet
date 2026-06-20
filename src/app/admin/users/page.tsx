'use client';

import { useEffect, useState } from 'react';
import { UsersGuard } from '@/components/UsersGuard';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ROLE_LABELS, UserRole } from '@/types/datasheet';
import { useAuth } from '@/context/AuthContext';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  canManage?: boolean;
}

export default function AdminUsersPage() {
  const { user: actor } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [creatableRoles, setCreatableRoles] = useState<UserRole[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Assessor');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setCreatableRoles(d.creatableRoles || []);
        if (d.creatableRoles?.length && !d.creatableRoles.includes(role)) {
          setRole(d.creatableRoles[0]);
        }
      });
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
    setRole('Assessor');
    load();
  };

  const handleUpdate = async (id: number, patch: Record<string, unknown>) => {
    setError('');
    setMessage('');
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || 'Update failed');
      return;
    }
    setMessage('User updated');
    load();
  };

  return (
    <AuthGuard>
      <UsersGuard>
        <AppShell>
          <h1 className="page-title">User Accounts</h1>
          <p className="page-subtitle">
            {actor?.role === 'Admin'
              ? 'Super user — manage all accounts'
              : actor?.role === 'PrincipalOfficer'
                ? 'Manage officers, operations managers, and assessors'
                : 'Manage assessor accounts'}
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleCreate} className="section-card space-y-4">
              <h2 className="font-semibold text-slate-800">New User</h2>
              <div>
                <label className="form-label">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" required />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" minLength={8} required />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="form-input">
                  {creatableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {error && <p className="form-error">{error}</p>}
              {message && <p className="text-sm text-emerald-600">{message}</p>}
              <button type="submit" className="btn-primary">Create User</button>
            </form>

            <div className="section-card overflow-x-auto">
              <h2 className="mb-4 font-semibold text-slate-800">Existing Users</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        {u.canManage && u.id !== actor?.id ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-brand-600"
                              onClick={() => {
                                const newPassword = prompt('Enter new password (min 8 chars)');
                                if (newPassword) handleUpdate(u.id, { password: newPassword });
                              }}
                            >
                              Reset password
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-amber-700"
                              onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AppShell>
      </UsersGuard>
    </AuthGuard>
  );
}
