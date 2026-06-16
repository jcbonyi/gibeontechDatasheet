'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { Letterhead } from '@/components/Letterhead';
import { COMPANY } from '@/constants/brand';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname.startsWith('/datasheets');

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-white/60 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full border border-accent-200/80 bg-gradient-to-r from-accent-50 to-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
              <ClipboardList className="h-3.5 w-3.5 text-accent-600" />
              Datasheet Capture
            </div>

            <Link
              href="/datasheets"
              className={`nav-pill ${isRegister ? 'nav-pill-active' : 'nav-pill-idle'}`}
            >
              Register
            </Link>
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
