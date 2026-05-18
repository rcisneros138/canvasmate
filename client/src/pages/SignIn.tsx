import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; theme?: string },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY: string | undefined = import.meta.env
  .VITE_TURNSTILE_SITE_KEY as string | undefined;

export default function SignIn() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [loading, user, next, navigate]);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSlot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (document.querySelector('script[data-turnstile]')) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = '1';
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || sent) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileSlot.current) {
        setTimeout(tryRender, 200);
        return;
      }
      window.turnstile.render(turnstileSlot.current, {
        sitekey: TURNSTILE_SITE_KEY!,
        callback: (token: string) => setTurnstileToken(token),
      });
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [sent]);

  const captchaReady = !TURNSTILE_SITE_KEY || !!turnstileToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          next,
          turnstile: turnstileToken ?? undefined,
        }),
      });
      if (res.status === 429) {
        setError('Too many sign-in attempts. Try again in a few minutes.');
        return;
      }
      if (!res.ok) {
        setError('Please enter a valid email.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-7">
            <header className="space-y-2">
              <div className="eyebrow lift-in">Sign in</div>
              <h1 className="font-display text-[clamp(44px,7vw,64px)] leading-[0.95] tracking-[-0.01em] lift-in delay-1">
                Get a sign-in link.
              </h1>
              <p className="text-[var(--color-ink-soft)] lift-in delay-2">
                We'll email you a one-time link. No password to remember.
              </p>
            </header>

            <div className="space-y-1.5 lift-in delay-3">
              <label
                htmlFor="email"
                className="eyebrow !text-[var(--color-ink-soft)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@yourcampaign.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="field"
              />
            </div>

            {error && (
              <p className="font-mono text-xs text-[var(--color-signal)]">
                {error}
              </p>
            )}

            {TURNSTILE_SITE_KEY && (
              <div ref={turnstileSlot} className="lift-in delay-3" />
            )}

            <button
              type="submit"
              disabled={!email.trim() || submitting || !captchaReady}
              className="btn-primary w-full lift-in delay-4"
            >
              {submitting ? 'Sending link…' : 'Send sign-in link'}
            </button>

            <p className="text-xs font-mono text-[var(--color-muted)] text-center lift-in delay-5">
              By signing in you agree to use CanvasMate for legitimate
              field-canvass work.
            </p>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="eyebrow lift-in">Check your email</div>
            <h1 className="font-display text-[clamp(44px,7vw,64px)] leading-[0.95] tracking-[-0.01em] lift-in delay-1">
              Link sent.
            </h1>
            <p className="text-[var(--color-ink-soft)] leading-relaxed lift-in delay-2">
              We just sent a sign-in link to{' '}
              <span className="font-mono text-[var(--color-ink)]">{email}</span>
              . It expires in 15 minutes. Open it on this device to continue.
            </p>
            <div className="card p-5 lift-in delay-3">
              <p className="text-sm text-[var(--color-ink-soft)]">
                Didn't get it?{' '}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="btn-link"
                >
                  Try a different email
                </button>
              </p>
            </div>
            <Link to="/" className="btn-link inline-block lift-in delay-4">
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
