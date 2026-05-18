export interface TurnstileVerifier {
  verify(token: string | undefined, ip: string | undefined): Promise<boolean>;
  /** True when verification is actually enforced (i.e. a secret is set). */
  enabled: boolean;
}

class CloudflareTurnstile implements TurnstileVerifier {
  enabled = true;
  constructor(private secret: string) {}

  async verify(token: string | undefined, ip: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
      const body = new URLSearchParams({
        secret: this.secret,
        response: token,
      });
      if (ip) body.set('remoteip', ip);
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body },
      );
      const data = (await res.json()) as { success?: boolean };
      return Boolean(data.success);
    } catch (err) {
      console.error('[turnstile] verify failed', err);
      return false;
    }
  }
}

class DisabledTurnstile implements TurnstileVerifier {
  enabled = false;
  async verify(): Promise<boolean> {
    return true;
  }
}

export function createTurnstile(): TurnstileVerifier {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return new DisabledTurnstile();
  return new CloudflareTurnstile(secret);
}
