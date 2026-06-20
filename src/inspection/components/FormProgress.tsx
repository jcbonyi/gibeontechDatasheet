'use client';

import { FORM_SECTIONS } from '../types/inspection';

interface FormProgressProps {
  activeSection: string;
  onNavigate: (id: string) => void;
  sectionPrefix?: string;
}

export function FormProgress({ activeSection, onNavigate, sectionPrefix = '' }: FormProgressProps) {
  return (
    <nav className="no-print sticky top-36 hidden lg:block">
      <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-500">Sections</p>
        <ol className="space-y-1">
          {FORM_SECTIONS.map((section) => {
            const sectionId = `${sectionPrefix}${section.id}`;
            const isActive = activeSection === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(section.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-50 font-medium text-brand-700 ring-1 ring-accent-300/40'
                      : 'text-slate-600 hover:bg-brand-50/50 hover:text-brand-800'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActive ? 'bg-brand-600 text-white ring-2 ring-accent-400/50' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {section.number}
                  </span>
                  {section.title}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
