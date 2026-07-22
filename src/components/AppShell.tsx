'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ClipboardList,
  Factory,
  FileBarChart2,
  LogOut,
  Plus,
  Smartphone,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Letterhead } from '@/components/Letterhead';
import { COMPANY } from '@/constants/brand';
import { canManageUsers } from '@/lib/permissions';
import { canManageProductionAdmin } from '@/lib/productionPermissions';
import { ROLE_LABELS } from '@/types/datasheet';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isHome = pathname === '/analytics' || pathname === '/';
  const isTasks =
    pathname === '/datasheets' ||
    (pathname.startsWith('/datasheets/') && !pathname.startsWith('/datasheets/new'));
  const isReports = pathname.startsWith('/reports');
  const isProduction = pathname.startsWith('/production');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="min-h-screen">
      <KeyboardShortcuts />
      <header className="no-print sticky top-0 z-30 border-b border-white/60 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/analytics"
              className="flex items-center gap-2 rounded-full border border-accent-200/80 bg-gradient-to-r from-accent-50 to-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <ClipboardList className="h-3.5 w-3.5 text-accent-600" />
              Assessment Tracker
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline">
                {user?.name} · {user ? ROLE_LABELS[user.role] : ''}
              </span>
              <Link
                href="/analytics"
                className={`nav-pill ${isHome ? 'nav-pill-active' : 'nav-pill-idle'}`}
                title="Alt+H"
              >
                <BarChart3 className="h-4 w-4" />
                Home
              </Link>
              <Link
                href="/datasheets"
                className={`nav-pill ${isTasks ? 'nav-pill-active' : 'nav-pill-idle'}`}
                title="Alt+T"
              >
                <ClipboardList className="h-4 w-4" />
                Tasks
              </Link>
              <Link
                href="/reports"
                className={`nav-pill ${isReports ? 'nav-pill-active' : 'nav-pill-idle'}`}
                title="Alt+R"
              >
                <FileBarChart2 className="h-4 w-4" />
                Reports
              </Link>
              <Link
                href="/production"
                className={`nav-pill ${isProduction ? 'nav-pill-active' : 'nav-pill-idle'}`}
              >
                <Factory className="h-4 w-4" />
                Production
              </Link>
              <Link href="/datasheets/new" className="nav-pill nav-pill-idle" title="Alt+N">
                <Plus className="h-4 w-4" />
                New
              </Link>
              <Link href="/mobile" className="nav-pill nav-pill-idle" title="Alt+M">
                <Smartphone className="h-4 w-4" />
                Field
              </Link>
              {user && canManageUsers(user) && (
                <Link
                  href="/admin/users"
                  className={`nav-pill ${isAdmin && pathname.includes('/users') ? 'nav-pill-active' : 'nav-pill-idle'}`}
                >
                  <Users className="h-4 w-4" />
                  Users
                </Link>
              )}
              {user && canManageProductionAdmin(user) && (
                <Link
                  href="/admin/production"
                  className={`nav-pill ${pathname.startsWith('/admin/production') || pathname.startsWith('/admin/insurers') ? 'nav-pill-active' : 'nav-pill-idle'}`}
                >
                  Prod admin
                </Link>
              )}
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
        <span className="mx-2 hidden sm:inline">·</span>
        <span className="mt-1 block sm:mt-0 sm:inline">
          Alt+H Home · Alt+T Tasks · Alt+N New · Alt+R Reports · Alt+M Field
        </span>
      </footer>
    </div>
  );
}
