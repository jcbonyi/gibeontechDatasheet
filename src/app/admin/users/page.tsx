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
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');

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
    setRole(creatableRoles[0] || 'Assessor');
    load();
  };

  const handleUpdate = async (id: number, patch: Record<string, unknown>) => {
    setError('');
    setMessage('');
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Update failed');
        return false;
      }
      setMessage(
        patch.password
          ? 'Password updated'
          : patch.role
            ? 'Role updated'
            : 'Account details updated',
      );
      load();
      return true;
    } finally {
      setUpdatingId(null);
    }
  };

  const startEdit = (u: UserRow) => {
    setError('');
    setMessage('');
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword('');
    setEditPasswordConfirm('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
    setEditPasswordConfirm('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    setMessage('');

    const nextName = editName.trim();
    const nextEmail = editEmail.trim().toLowerCase();
    if (!nextName) {
      setError('Name is required');
      return;
    }
    if (!nextEmail) {
      setError('Email is required');
      return;
    }
    if (editPassword || editPasswordConfirm) {
      if (editPassword.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (editPassword !== editPasswordConfirm) {
        setError('Passwords do not match');
        return;
      }
    }

    const patch: Record<string, unknown> = {};
    if (nextName !== editing.name) patch.name = nextName;
    if (nextEmail !== editing.email) patch.email = nextEmail;
    if (editPassword) patch.password = editPassword;

    if (Object.keys(patch).length === 0) {
      setMessage('No changes to save');
      return;
    }

    const ok = await handleUpdate(editing.id, patch);
    if (ok) cancelEdit();
  };

  const roleOptionsFor = (currentRole: UserRole): UserRole[] => {
    const options = new Set<UserRole>(creatableRoles);
    // Keep current role visible even if it would not be creatable (edge cases).
    options.add(currentRole);
    return Array.from(options);
  };

  return (
    <AuthGuard>
      <UsersGuard>
        <AppShell>
          <h1 className="page-title">User Accounts</h1>
          <p className="page-subtitle">
            {actor?.role === 'Admin'
              ? 'Super user — manage all accounts and roles'
              : actor?.role === 'PrincipalOfficer'
                ? 'Manage officers, operations managers, and assessors'
                : 'Manage assessor accounts'}
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {editing ? (
              <form onSubmit={handleSaveEdit} className="section-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-800">Edit User</h2>
                  <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  Updating <span className="font-medium text-slate-700">{editing.name}</span>
                </p>
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="form-input"
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    className="form-input"
                    minLength={8}
                    placeholder="Required only when changing password"
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="form-error">{error}</p>}
                {message && <p className="text-sm text-emerald-600">{message}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={updatingId === editing.id}
                  >
                    {updatingId === editing.id ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
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
            )}

            <div className="section-card overflow-x-auto">
              <h2 className="mb-4 font-semibold text-slate-800">Existing Users</h2>
              {!editing && error && <p className="mb-3 form-error">{error}</p>}
              {!editing && message && <p className="mb-3 text-sm text-emerald-600">{message}</p>}
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
                  {users.map((u) => {
                    const canEdit = Boolean(u.canManage && u.id !== actor?.id);
                    const options = roleOptionsFor(u.role);
                    return (
                      <tr key={u.id} className={editing?.id === u.id ? 'bg-brand-50/40' : undefined}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          {canEdit ? (
                            <select
                              value={u.role}
                              disabled={updatingId === u.id}
                              className="form-input min-w-[10rem] py-1 text-sm"
                              aria-label={`Change role for ${u.name}`}
                              onChange={(e) => {
                                const nextRole = e.target.value as UserRole;
                                if (nextRole === u.role) return;
                                const label = ROLE_LABELS[nextRole];
                                if (
                                  !confirm(
                                    `Change ${u.name}'s role from ${ROLE_LABELS[u.role]} to ${label}?`,
                                  )
                                ) {
                                  e.target.value = u.role;
                                  return;
                                }
                                handleUpdate(u.id, { role: nextRole });
                              }}
                            >
                              {options.map((r) => (
                                <option key={r} value={r} disabled={!creatableRoles.includes(r) && r !== u.role}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            ROLE_LABELS[u.role]
                          )}
                        </td>
                        <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                        <td>
                          {canEdit ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="text-xs font-medium text-brand-600"
                                onClick={() => startEdit(u)}
                              >
                                Edit
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </AppShell>
      </UsersGuard>
    </AuthGuard>
  );
}
