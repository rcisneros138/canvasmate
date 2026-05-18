import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface SessionRow {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'locked';
  created_at: string;
  expires_at: string;
  signal_invite_link: string | null;
}

const STATUS_LABELS: Record<SessionRow['status'], string> = {
  setup: 'Setup',
  active: 'Active',
  locked: 'Locked',
};

const STATUS_CHIP: Record<SessionRow['status'], string> = {
  setup: 'chip',
  active: 'chip chip-mark',
  locked: 'chip chip-leaf',
};

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SessionsList() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    fetch('/api/sessions', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((data) => setSessions(data.sessions ?? []));
  }, []);

  if (sessions === null) {
    return (
      <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-muted)]">
        Loading…
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="eyebrow !text-[var(--color-muted)]">No sessions yet</div>
        <p className="font-display text-2xl tracking-tight">
          Plan your first canvass.
        </p>
        <p className="text-sm text-[var(--color-ink-soft)] max-w-md mx-auto">
          When you create a session it'll show up here so you can pick up
          where you left off.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link
            to={`/session/${s.id}`}
            className="card block p-5 hover:bg-[color-mix(in_oklab,var(--color-paper-2)_50%,white)] transition-colors"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-display text-2xl tracking-tight">
                  {s.name}
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  {relativeDate(s.created_at)}
                </span>
              </div>
              <span className={STATUS_CHIP[s.status]}>{STATUS_LABELS[s.status]}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
