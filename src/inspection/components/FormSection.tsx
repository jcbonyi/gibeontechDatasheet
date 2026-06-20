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
    <section id={id} className="section-card scroll-mt-40">
      <div className="mb-6 flex items-start gap-4 border-b border-slate-100 pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-white shadow-sm ring-2 ring-accent-400/30">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
