import { ReactNode } from 'react';

interface FormSectionProps {
  id: string;
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ id, number, title, description, children }: FormSectionProps) {
  return (
    <section
      id={id}
      className="section-card scroll-mt-44 border-l-4 border-l-brand-500/80 pl-0 sm:pl-1"
    >
      <div className="mb-6 flex items-start gap-4 border-b border-slate-100 pb-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-white shadow-md shadow-brand-600/30 ring-2 ring-accent-400/40">
          {number}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
