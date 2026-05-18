import { useState } from 'react';
import AppShell from '../components/AppShell';

interface Props {
  sessionId: string;
  onCheckedIn?: (token: string) => void;
}

export default function CheckIn({ sessionId, onCheckedIn }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [minivanId, setMinivanId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        displayName: name,
        phone: phone || undefined,
        minivanId: minivanId || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      onCheckedIn?.(data.sessionToken);
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md px-6 py-12 sm:py-20">
        <form onSubmit={handleSubmit} className="space-y-7">
          <header className="space-y-2">
            <div className="eyebrow lift-in">Volunteer</div>
            <h1 className="font-display text-[clamp(48px,8vw,72px)] leading-[0.95] tracking-[-0.01em] lift-in delay-1">
              Check in.
            </h1>
            <p className="text-[var(--color-ink-soft)] lift-in delay-2">
              Get your route and your group before you hit the doors.
            </p>
          </header>

          <div className="space-y-4 lift-in delay-3">
            <Field
              id="name"
              label="Your name"
              required
              placeholder="Your name"
              value={name}
              onChange={setName}
              autoFocus
            />
            <Field
              id="phone"
              type="tel"
              label="Phone"
              optional
              placeholder="Optional"
              value={phone}
              onChange={setPhone}
            />
            <Field
              id="minivan"
              label="MiniVAN ID"
              optional
              placeholder="Optional"
              value={minivanId}
              onChange={setMinivanId}
            />
          </div>

          <button
            type="submit"
            disabled={!name || loading}
            className="btn-primary w-full lift-in delay-4"
          >
            {loading ? 'Checking in…' : 'Check In'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  id,
  label,
  type = 'text',
  required,
  optional,
  placeholder,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between eyebrow !text-[var(--color-ink-soft)]"
      >
        <span>{label}</span>
        {optional && <span className="text-[var(--color-muted)]">optional</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="field"
      />
    </div>
  );
}
