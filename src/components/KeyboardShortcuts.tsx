'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Global keyboard shortcuts for the assessment tracker. */
export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (!(e.altKey || e.metaKey)) return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/datasheets/new');
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        router.push('/datasheets');
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        router.push('/analytics');
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        router.push('/reports');
      }
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        router.push('/mobile');
      }
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        router.push('/reports/print-queue');
      }
      if (e.key.toLowerCase() === '/' || e.key === '/') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('[data-shortcut="search"]');
        el?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
