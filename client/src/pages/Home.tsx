import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';
import SessionsList from './SessionsList';

/** Extract the join code from either a raw code or a full canvasmate URL. */
function parseJoinCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try URL form first
  try {
    const u = new URL(trimmed);
    const match = u.pathname.match(/\/join\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
  } catch {
    // not a URL, fall through
  }
  // Bare code: alnum / dash / underscore
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-[40vh] flex items-center justify-center">
          <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-muted)]">
            Loading…
          </p>
        </div>
      </AppShell>
    );
  }

  if (user) return <AuthedHome />;
  return <GuestHome />;
}

function GuestHome() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-12 lg:py-20 space-y-12">
        <header className="space-y-4 max-w-3xl">
          <div className="eyebrow lift-in">Field Manual for canvasses</div>
          <h1 className="font-display text-[clamp(52px,8vw,108px)] leading-[0.92] tracking-[-0.015em] lift-in delay-1">
            Plan and run a{' '}
            <span
              className="italic"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
            >
              real
            </span>{' '}
            canvass.
          </h1>
          <p className="text-lg text-[var(--color-ink-soft)] max-w-xl lift-in delay-2">
            CanvasMate hands every volunteer a list, a group, and a join code
            before they leave the staging area.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HostCard />
          <JoinCard />
        </div>
      </div>
    </AppShell>
  );
}

function HostCard() {
  return (
    <div className="card p-7 lg:p-9 space-y-5 lift-in delay-3">
      <div className="flex items-baseline justify-between">
        <div className="eyebrow">Host</div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
          For organizers
        </div>
      </div>
      <h2 className="font-display text-4xl tracking-tight">
        Host a canvass.
      </h2>
      <p className="text-[var(--color-ink-soft)] leading-relaxed">
        Plan a session, paste your list of voter numbers, and send your team
        a join code. You'll get a live board to assign volunteers to routes.
      </p>
      <Link
        to="/sign-in?next=/session/new"
        className="btn-primary"
      >
        Start a session
        <span aria-hidden className="font-mono text-sm opacity-70">→</span>
      </Link>
      <p className="text-xs font-mono text-[var(--color-muted)]">
        Sign in with an email link. No password.
      </p>
    </div>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = parseJoinCode(input);
    if (!code) {
      setError('That doesn\'t look like a valid code or link.');
      return;
    }
    navigate(`/join/${code}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-7 lg:p-9 space-y-5 lift-in delay-4"
    >
      <div className="flex items-baseline justify-between">
        <div className="eyebrow !text-[var(--color-ink-soft)]">Join</div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
          For volunteers
        </div>
      </div>
      <h2 className="font-display text-4xl tracking-tight">
        Join a canvass.
      </h2>
      <p className="text-[var(--color-ink-soft)] leading-relaxed">
        Got a code from your organizer? Drop it in here. You can also paste
        a join link — we'll figure out the rest.
      </p>

      <div className="space-y-1.5">
        <label
          htmlFor="join-code"
          className="eyebrow !text-[var(--color-ink-soft)]"
        >
          Session code or link
        </label>
        <input
          id="join-code"
          type="text"
          autoComplete="off"
          inputMode="text"
          placeholder="e.g. K7M4P2 or canvasmate.org/join/K7M4P2"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          className="field"
        />
        {error && (
          <p className="font-mono text-xs text-[var(--color-signal)]">
            {error}
          </p>
        )}
      </div>

      <button type="submit" disabled={!input.trim()} className="btn-primary">
        Continue
        <span aria-hidden className="font-mono text-sm opacity-70">→</span>
      </button>
    </form>
  );
}

function AuthedHome() {
  const { user, signOut } = useAuth();
  return (
    <AppShell
      right={
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)] hidden sm:inline">
            {user!.email}
          </span>
          <button onClick={() => void signOut()} className="btn-link">
            Sign out
          </button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-10 lg:py-14 space-y-10">
        <header className="flex items-end justify-between flex-wrap gap-6">
          <div className="space-y-2">
            <div className="eyebrow">Your sessions</div>
            <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[0.95] tracking-[-0.01em]">
              Run a canvass.
            </h1>
          </div>
          <Link to="/session/new" className="btn-primary">
            New session
            <span aria-hidden className="font-mono text-sm opacity-70">→</span>
          </Link>
        </header>

        <SessionsList />
      </div>
    </AppShell>
  );
}
