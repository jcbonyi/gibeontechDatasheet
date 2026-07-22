'use client';

import { useAuth } from '@/context/AuthContext';
import { canAccessProduction } from '@/lib/productionPermissions';

export function ProductionGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="section-card text-sm text-slate-500">Checking access…</div>;
  }
  if (!canAccessProduction(user)) {
    return (
      <div className="section-card text-sm text-red-700">
        You do not have access to Production Management.
      </div>
    );
  }
  return <>{children}</>;
}
