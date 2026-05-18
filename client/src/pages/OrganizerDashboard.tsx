import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function OrganizerDashboard() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1000px] px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-2xl space-y-10">
          <div className="eyebrow lift-in">Organizer · Field Manual</div>

          <h1
            className="font-display text-[clamp(56px,9vw,120px)] leading-[0.92] tracking-[-0.015em] lift-in delay-1"
          >
            Run a canvass<br />
            <span
              className="italic"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
            >
              that actually
            </span>{' '}
            ships.
          </h1>

          <p className="text-lg text-[var(--color-ink-soft)] max-w-xl leading-relaxed lift-in delay-2">
            Set up a session, drop in your voter list, share a join code with
            your team. CanvasMate hands every volunteer a list and a group
            before they leave the staging area.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start lift-in delay-3">
            <Link to="/session/new" className="btn-primary">
              New canvass session
              <span aria-hidden className="font-mono text-sm opacity-70">→</span>
            </Link>
            <p className="text-sm font-mono text-[var(--color-muted)] sm:py-3">
              Step 1 of 3
            </p>
          </div>

          <div className="hairline-soft border-t pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 lift-in delay-4">
            <Step n="01" title="Create" body="Name your session and paste your list numbers." />
            <Step n="02" title="Activate" body="Share a join code or QR with your volunteers." />
            <Step n="03" title="Assign" body="Drag canvassers onto routes. Lock when ready." />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-xs text-[var(--color-signal)] tracking-widest">
        {n}
      </div>
      <div className="font-display text-2xl tracking-tight">{title}</div>
      <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">{body}</p>
    </div>
  );
}
