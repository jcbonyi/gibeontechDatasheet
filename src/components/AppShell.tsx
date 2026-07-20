'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardList, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Letterhead } from '@/components/Letterhead';
import { COMPANY } from '@/constants/brand';
import { canManageUsers } from '@/lib/permissions';
import { ROLE_LABELS } from '@/types/datasheet';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isRegister = pathname === '/datasheets' || pathname.startsWith('/datasheets/');
  const isAnalytics = pathname.startsWith('/analytics');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-white/60 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/datasheets"
              className="flex items-center gap-2 rounded-full border border-accent-200/80 bg-gradient-to-r from-accent-50 to-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <ClipboardList className="h-3.5 w-3.5 text-accent-600" />
              Datasheet Capture
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline">
                {user?.name} · {user ? ROLE_LABELS[user.role] : ''}
              </span>
              {user && canManageUsers(user) && (
                <Link
                  href="/admin/users"
                  className={`nav-pill ${isAdmin ? 'nav-pill-active' : 'nav-pill-idle'}`}
                >
                  <Users className="h-4 w-4" />
                  Users
                </Link>
              )}
              <Link
                href="/analytics"
                className={`nav-pill ${isAnalytics ? 'nav-pill-active' : 'nav-pill-idle'}`}
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <Link
                href="/datasheets"
                className={`nav-pill ${isRegister && !isAnalytics ? 'nav-pill-active' : 'nav-pill-idle'}`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Register
              </Link>
              <button
                type="button"
                onClick={logout}
                className="nav-pill nav-pill-idle text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
          <Letterhead variant="app" documentTitle={COMPANY.reportTitle} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="no-print border-t border-brand-100/80 bg-white/70 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
        © {new Date().getFullYear()} {COMPANY.name}
      </footer>
    </div>
  );
}
