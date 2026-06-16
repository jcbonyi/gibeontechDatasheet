'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== 'Admin') {
      router.replace('/datasheets');
    }
  }, [loading, user, router]);

  if (loading || !user) return null;
  if (user.role !== 'Admin') return null;
  return <>{children}</>;
}
