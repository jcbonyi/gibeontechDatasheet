'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { COMPANY } from '@/constants/brand';

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [mode, setMode] = useState<'request' | 'reset'>(tokenFromUrl ? 'reset' : 'request');

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setMessage(data.message || 'Request submitted');
    if (data.resetUrl) {
      setResetUrl(data.resetUrl);
      const t = new URL(data.resetUrl).searchParams.get('token');
      if (t) setToken(t);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setMessage(data.message || (res.ok ? 'Password updated' : 'Failed'));
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md section-card">
        <h1 className="text-xl font-bold text-brand-800">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-500">{COMPANY.name}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'request' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('request')}
          >
            Request link
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'reset' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('reset')}
          >
            Set new password
          </button>
        </div>

        {mode === 'request' ? (
          <form onSubmit={requestReset} className="mt-4 space-y-3">
            <input
              type="email"
              className="form-input"
              placeholder="Your account email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary w-full">
              Send reset link
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-4 space-y-3">
            <input
              className="form-input"
              placeholder="Reset token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              className="form-input"
              placeholder="New password (min 8)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button type="submit" className="btn-primary w-full">
              Update password
            </button>
          </form>
        )}

        {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
        {resetUrl && (
          <p className="mt-2 break-all text-xs text-brand-700">
            Dev reset URL: <a href={resetUrl}>{resetUrl}</a>
          </p>
        )}

        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600">
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
