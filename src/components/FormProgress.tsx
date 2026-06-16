'use client';

import { FORM_SECTIONS } from '@/types/datasheet';

interface FormProgressProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

export function FormProgress({ activeSection, onNavigate }: FormProgressProps) {
  return (
    <>
      <nav className="no-print sticky top-[4.5rem] z-20 mb-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur-sm lg:hidden">
        <div className="flex min-w-max gap-1">
          {FORM_SECTIONS.map((section) => {
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onNavigate(section.id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50'
                }`}
              >
                <span className="mr-1 opacity-70">{section.number}.</span>
                {section.title}
              </button>
            );
          })}
        </div>
      </nav>

      <nav className="no-print sticky top-28 hidden lg:block">
        <div className="rounded-2xl border border-brand-100/80 bg-white/95 p-4 shadow-md shadow-brand-900/5 backdrop-blur-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Sections
          </p>
          <ol className="space-y-1">
            {FORM_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-600 to-brand-700 font-medium text-white shadow-md shadow-brand-600/25'
                        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {section.number}
                    </span>
                    <span className="leading-tight">{section.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
