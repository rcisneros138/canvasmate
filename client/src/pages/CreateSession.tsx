import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';

interface ParsedList {
  numbers: string[];
  duplicates: string[];
  blankLines: number;
}

function parseList(raw: string): ParsedList {
  if (!raw) return { numbers: [], duplicates: [], blankLines: 0 };
  const lines = raw.split(/\r?\n/);
  let blankLines = 0;
  const seen = new Map<string, number>();
  const numbers: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      blankLines++;
      continue;
    }
    seen.set(t, (seen.get(t) ?? 0) + 1);
    if (seen.get(t) === 1) numbers.push(t);
  }
  const duplicates: string[] = [];
  for (const [n, count] of seen) {
    if (count > 1) duplicates.push(n);
  }
  return { numbers, duplicates, blankLines };
}

function defaultSessionName(): string {
  const d = new Date();
  const day = d.toLocaleDateString(undefined, { weekday: 'long' });
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  return `${day} canvass — ${month} ${d.getDate()}`;
}

export default function CreateSession() {
  const [name, setName] = useState('');
  const [listInput, setListInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const parsed = useMemo(() => parseList(listInput), [listInput]);
  const suggestedName = useMemo(defaultSessionName, []);

  async function ingestFile(file: File) {
    const text = await file.text();
    setListInput(text);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const finalName = name.trim() || suggestedName;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          listNumbers: listInput,
          organizerId: 'temp',
        }),
      });
      const session = await res.json();
      navigate(`/session/${session.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const missing = !listInput.trim()
    ? 'Add list numbers to continue'
    : null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1180px] px-6 lg:px-10 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-10 lg:gap-16">
          {/* ---------- LEFT: form ---------- */}
          <form onSubmit={handleSubmit} className="space-y-10">
            <header className="space-y-3">
              <div className="eyebrow lift-in">Step 1 · Create session</div>
              <h1
                className="font-display text-[clamp(40px,6vw,68px)] leading-[0.95] tracking-[-0.01em] lift-in delay-1"
              >
                Plan your<br />
                <span className="italic" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}>
                  canvass.
                </span>
              </h1>
              <p className="text-[var(--color-ink-soft)] text-lg max-w-md lift-in delay-2">
                Name it. Drop in your list. Send volunteers a join code.
              </p>
            </header>

            {/* Session name */}
            <div className="space-y-2 lift-in delay-3">
              <label className="flex items-baseline justify-between">
                <span className="eyebrow !text-[var(--color-ink-soft)]">
                  Session name
                </span>
                {!name && (
                  <button
                    type="button"
                    onClick={() => setName(suggestedName)}
                    className="btn-link"
                  >
                    Use today's
                  </button>
                )}
              </label>
              <input
                type="text"
                placeholder={suggestedName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
                aria-label="Session name"
              />
            </div>

            {/* List numbers */}
            <div className="space-y-3 lift-in delay-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow !text-[var(--color-ink-soft)]">
                  Voter list numbers
                </span>
                <span
                  className={`chip ${parsed.numbers.length > 0 ? 'chip-mark' : ''}`}
                  aria-live="polite"
                >
                  {parsed.numbers.length} valid
                </span>
              </div>

              <div
                className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <textarea
                  placeholder={
                    'Paste list numbers, one per line.\nOr drag a .txt / .csv file anywhere in this box.'
                  }
                  value={listInput}
                  onChange={(e) => setListInput(e.target.value)}
                  rows={10}
                  aria-label="List numbers"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
                <span>
                  Pasted text or files both work — one number per line.
                </span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-link"
                >
                  Browse files
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="space-y-3 lift-in delay-5">
              <button
                type="submit"
                disabled={!listInput.trim() || submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Creating session…' : missing ?? 'Create session'}
                {!missing && !submitting && (
                  <span aria-hidden className="font-mono text-sm opacity-70">
                    →
                  </span>
                )}
              </button>
              <p className="text-xs text-[var(--color-muted)] font-mono">
                Step 2 · Activate the session and share a join code with your team.
              </p>
            </div>
          </form>

          {/* ---------- RIGHT: live preview ---------- */}
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <div className="card p-6 lg:p-7 space-y-6 lift-in delay-2">
              <div className="flex items-baseline justify-between">
                <div className="eyebrow">Preview</div>
                <div className="font-mono text-[11px] text-[var(--color-muted)] tracking-widest uppercase">
                  Live
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <div className="stamp text-[88px] sm:text-[112px]">
                  {parsed.numbers.length}
                </div>
                <div className="text-[var(--color-ink-soft)] pb-3">
                  <div className="font-mono text-xs uppercase tracking-widest">
                    Valid<br />numbers
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {parsed.duplicates.length > 0 && (
                  <div className="chip chip-signal w-full justify-start">
                    {parsed.duplicates.length} duplicate
                    {parsed.duplicates.length === 1 ? '' : 's'} removed
                  </div>
                )}
                {parsed.blankLines > 0 && (
                  <div className="chip w-full justify-start">
                    {parsed.blankLines} blank line
                    {parsed.blankLines === 1 ? '' : 's'} ignored
                  </div>
                )}
                {parsed.numbers.length === 0 && (
                  <div className="chip w-full justify-start">
                    Waiting for numbers
                  </div>
                )}
              </div>

              <div className="hairline-soft border-t pt-4">
                <div className="eyebrow !text-[var(--color-muted)] mb-3">
                  Sample
                </div>
                {parsed.numbers.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)] font-mono leading-relaxed">
                    Paste numbers in the box on the left to see them appear here.
                  </p>
                ) : (
                  <ol className="font-mono text-sm space-y-1.5">
                    {parsed.numbers.slice(0, 6).map((n, i) => (
                      <li
                        key={`${n}-${i}`}
                        className="flex items-baseline gap-3"
                      >
                        <span className="text-[var(--color-muted)] w-5 text-right">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[var(--color-ink)]">{n}</span>
                      </li>
                    ))}
                    {parsed.numbers.length > 6 && (
                      <li className="text-[var(--color-muted)] pt-1 pl-8">
                        + {parsed.numbers.length - 6} more
                      </li>
                    )}
                  </ol>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
