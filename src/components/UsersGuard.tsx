'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canManageUsers } from '@/lib/permissions';

export function UsersGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !canManageUsers(user))) {
      router.replace('/datasheets');
    }
  }, [user, loading, router]);

  if (loading || !user || !canManageUsers(user)) return null;

  return <>{children}</>;
}
