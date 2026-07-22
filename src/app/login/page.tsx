'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Letterhead } from '@/components/Letterhead';
import { COMPANY } from '@/constants/brand';

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [isBootstrap, setIsBootstrap] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace('/analytics');
  }, [user, router]);

  useEffect(() => {
    fetch('/api/auth/bootstrap')
      .then((r) => r.json())
      .then((d) => setNeedsBootstrap(d.needsBootstrap))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isBootstrap) {
        const res = await fetch('/api/auth/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Bootstrap failed');
        window.location.href = '/analytics';
        return;
      }
      await login(email, password);
      router.replace('/analytics');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-brand-50/40 to-accent-50/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-6 shadow-xl shadow-brand-900/10 backdrop-blur-sm sm:p-8">
        <Letterhead variant="app" documentTitle={COMPANY.reportTitle} />
        <h1 className="mt-6 text-xl font-bold text-slate-900">
          {isBootstrap || needsBootstrap ? 'Create Admin Account' : 'Sign In'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {needsBootstrap
            ? 'Set up the first administrator account to get started.'
            : 'Sign in to manage assessment tasks, inspections, and reports.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {(isBootstrap || needsBootstrap) && (
            <div>
              <label className="form-label">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
            </div>
          )}
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              minLength={8}
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Please wait...' : isBootstrap || needsBootstrap ? 'Create Admin' : 'Sign In'}
          </button>
        </form>

        {!needsBootstrap && (
          <Link href="/forgot-password" className="mt-4 block text-center text-sm text-brand-600 hover:underline">
            Forgot password?
          </Link>
        )}

        {needsBootstrap && !isBootstrap && (
          <button
            type="button"
            onClick={() => setIsBootstrap(true)}
            className="mt-4 w-full text-center text-sm text-brand-600 hover:underline"
          >
            Set up admin account
          </button>
        )}
      </div>
    </div>
  );
}
