import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AssignmentBoard from './AssignmentBoard';
import SessionQR from '../components/SessionQR';
import AppShell from '../components/AppShell';

type Status = 'setup' | 'active' | 'locked';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const [editingLink, setEditingLink] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadSession = useCallback(() => {
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then((s) => {
        setSession(s);
        setLinkInput(s.signal_invite_link || '');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function handleActivate() {
    const res = await fetch(`/api/sessions/${id}/activate`, { method: 'POST' });
    if (res.ok) {
      setShowQR(true);
      loadSession();
    }
  }

  async function handleLock() {
    const res = await fetch(`/api/sessions/${id}/lock`, { method: 'POST' });
    if (res.ok) loadSession();
  }

  async function saveLink(value: string | null) {
    setLinkError(null);
    if (typeof value === 'string' && !value.startsWith('https://signal.group/#')) {
      setLinkError('Link must start with https://signal.group/#');
      return;
    }
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalInviteLink: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSession((prev: any) => ({ ...prev, ...updated }));
      setEditingLink(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="card p-8 max-w-md text-center space-y-2">
            <div className="eyebrow">Error</div>
            <p className="font-display text-2xl text-[var(--color-signal)]">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-muted)]">
            Loading session…
          </p>
        </div>
      </AppShell>
    );
  }

  const status = session.status as Status;
  const hasLink = !!session.signal_invite_link && !editingLink;

  return (
    <AppShell right={<StatusChip status={status} />}>
      <div className="px-6 lg:px-10 py-8 space-y-8">
        <header className="flex items-end justify-between flex-wrap gap-6">
          <div className="space-y-2">
            <div className="eyebrow">Session</div>
            <h1 className="font-display text-[clamp(36px,5vw,56px)] leading-[0.95] tracking-tight">
              {session.name}
            </h1>
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
              <span>
                <span className="text-[var(--color-ink)]">
                  {session.canvassers.length}
                </span>{' '}
                canvassers
              </span>
              <span aria-hidden>·</span>
              <span>
                <span className="text-[var(--color-ink)]">
                  {session.lists.length}
                </span>{' '}
                lists
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {status === 'setup' && (
              <button onClick={handleActivate} className="btn-primary">
                Activate session
                <span aria-hidden className="font-mono text-sm opacity-70">→</span>
              </button>
            )}
            {status === 'active' && (
              <>
                <button
                  onClick={() => setShowQR((v) => !v)}
                  className="btn-secondary"
                >
                  {showQR ? 'Hide QR code' : 'Show QR code'}
                </button>
                <button
                  onClick={handleLock}
                  className="btn-primary"
                >
                  Lock assignments
                </button>
              </>
            )}
          </div>
        </header>

        <section className="card p-5 lg:p-6 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <label className="eyebrow !text-[var(--color-ink-soft)]">
              Signal group invite link
            </label>
            {hasLink && (
              <div className="flex items-center gap-4">
                <button onClick={() => setEditingLink(true)} className="btn-link">
                  Edit
                </button>
                <button
                  onClick={() => saveLink(null)}
                  className="btn-link !text-[var(--color-signal)]"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {hasLink ? (
            <p className="font-mono text-sm break-all text-[var(--color-ink-soft)]">
              {session.signal_invite_link}
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="https://signal.group/#..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                className="field flex-1"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveLink(linkInput)}
                  className="btn-primary !py-3"
                >
                  Save
                </button>
                {editingLink && (
                  <button
                    onClick={() => {
                      setEditingLink(false);
                      setLinkError(null);
                      setLinkInput(session.signal_invite_link || '');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          {linkError && (
            <p className="font-mono text-xs text-[var(--color-signal)]">{linkError}</p>
          )}
        </section>

        {showQR && status === 'active' && (
          <SessionQR sessionId={session.id} baseUrl={window.location.origin} />
        )}

        {status === 'setup' && (
          <div className="card p-10 text-center space-y-3">
            <div className="eyebrow !text-[var(--color-muted)]">Not yet active</div>
            <p className="font-display text-2xl tracking-tight">
              Session is in setup mode.
            </p>
            <p className="text-sm text-[var(--color-ink-soft)] max-w-md mx-auto">
              Click <span className="font-mono">Activate session</span> to start
              accepting check-ins and show the QR code.
            </p>
          </div>
        )}

        {status === 'locked' && (
          <div
            className="card p-5 flex items-center gap-4"
            style={{
              background:
                'color-mix(in oklab, var(--color-leaf) 14%, var(--color-paper))',
              borderColor:
                'color-mix(in oklab, var(--color-leaf) 45%, var(--color-rule))',
            }}
          >
            <span
              aria-hidden
              className="text-[var(--color-leaf)] font-display text-2xl"
            >
              ✓
            </span>
            <div>
              <p className="font-display text-xl">Assignments are locked</p>
              <p className="text-sm text-[var(--color-ink-soft)]">
                Canvassers can see their list numbers.
              </p>
            </div>
          </div>
        )}

        {(status === 'active' || status === 'locked') && (
          <AssignmentBoard session={session} />
        )}
      </div>
    </AppShell>
  );
}

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    setup: { label: 'Setup', cls: 'chip' },
    active: { label: 'Active', cls: 'chip chip-mark' },
    locked: { label: 'Locked', cls: 'chip chip-leaf' },
  };
  const { label, cls } = map[status];
  return <span className={cls}>{label}</span>;
}
