import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import AppShell from '../components/AppShell';

export interface Assignment {
  listNumber: string;
  groupName: string;
  members: string[];
  isLead?: boolean;
}

interface Props {
  assignment: Assignment | null;
  signalLink?: string;
}

function SignalJoin({ link }: { link: string }) {
  return (
    <div className="card p-6 flex flex-col items-center gap-4">
      <div className="eyebrow !text-[var(--color-muted)]">Group chat</div>
      <div className="p-2 bg-[var(--color-paper)]">
        <QRCodeSVG value={link} size={184} level="M" fgColor="#19170f" bgColor="transparent" />
      </div>
      <a href={link} className="btn-primary w-full">
        Join Signal Group
      </a>
      <p className="text-xs font-mono tracking-wider text-[var(--color-muted)] uppercase">
        Scan or tap
      </p>
    </div>
  );
}

export default function CanvasserView({ assignment, signalLink }: Props) {
  const [copied, setCopied] = useState(false);

  if (!assignment) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-24 space-y-10">
          <header className="space-y-2 lift-in">
            <div className="eyebrow">Standing by</div>
            <h1 className="font-display text-[clamp(44px,7vw,64px)] leading-[0.95] tracking-[-0.01em]">
              Waiting for assignment…
            </h1>
            <p className="text-[var(--color-ink-soft)]">
              Your organizer is sorting groups. This page will update
              automatically.
            </p>
          </header>

          <div className="card p-6 flex items-center gap-4 lift-in delay-2">
            <span className="inline-block h-3 w-3 rounded-full bg-[var(--color-signal)] animate-pulse" />
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Status
              </div>
              <div className="text-sm">Connected — listening for updates</div>
            </div>
          </div>

          {signalLink && <div className="lift-in delay-3"><SignalJoin link={signalLink} /></div>}
        </div>
      </AppShell>
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(assignment!.listNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md px-6 py-10 sm:py-16 space-y-8">
        <section className="space-y-3 lift-in">
          <div className="eyebrow">Your list number</div>
          <div className="card p-6 text-center space-y-4">
            <div
              className="font-display text-[clamp(72px,18vw,128px)] leading-none tracking-tight"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 20, "WONK" 1' }}
            >
              {assignment.listNumber}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary w-full"
            >
              {copied ? 'Copied ✓' : 'Copy to clipboard'}
            </button>
          </div>
        </section>

        <section className="space-y-3 lift-in delay-2">
          <div className="eyebrow !text-[var(--color-ink-soft)]">Your group</div>
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display text-2xl tracking-tight">
                {assignment.groupName}
              </div>
              {assignment.isLead && (
                <span className="chip chip-mark">Group lead</span>
              )}
            </div>
            <ul className="font-mono text-sm space-y-1">
              {assignment.members.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)]">·</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {signalLink && <div className="lift-in delay-3"><SignalJoin link={signalLink} /></div>}
      </div>
    </AppShell>
  );
}
