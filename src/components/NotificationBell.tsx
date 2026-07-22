'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface Note {
  id: number;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  type: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);

  const load = useCallback(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary !px-3"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Notifications</p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                      n.read_at ? 'opacity-70' : 'bg-brand-50/50'
                    }`}
                    onClick={() => markRead(n.id)}
                  >
                    <p className="font-semibold text-slate-800">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                    <p className="text-[10px] text-slate-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
