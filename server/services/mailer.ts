export interface Mailer {
  sendMagicLink(args: { to: string; link: string }): Promise<void>;
}

function magicLinkEmail({ to, link }: { to: string; link: string }) {
  const subject = 'Your CanvasMate sign-in link';
  const text = [
    `Hi,`,
    ``,
    `Click the link below to sign in to CanvasMate. It expires in 15 minutes.`,
    ``,
    link,
    ``,
    `If you didn't request this, you can ignore this email.`,
  ].join('\n');

  const html = `
    <p>Hi,</p>
    <p>Click the link below to sign in to <strong>CanvasMate</strong>. It expires in 15 minutes.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#d33b27;color:#f4efe0;text-decoration:none;font-family:'IBM Plex Sans',system-ui,sans-serif;font-weight:600;border-radius:2px;">Sign in to CanvasMate</a></p>
    <p style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;color:#6b6552;word-break:break-all;">${link}</p>
    <p style="color:#6b6552;font-size:12px;">If you didn't request this, you can ignore this email.</p>
  `;

  return { to, subject, text, html };
}

class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async sendMagicLink(args: { to: string; link: string }): Promise<void> {
    const { to, subject, text, html } = magicLinkEmail(args);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, text, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${body}`);
    }
  }
}

class ConsoleMailer implements Mailer {
  async sendMagicLink(args: { to: string; link: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `\n  [mailer:dev] Magic link for ${args.to}\n  ${args.link}\n`,
    );
  }
}

export function createMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'CanvasMate <noreply@canvasmate.local>';
  if (apiKey) {
    return new ResendMailer(apiKey, from);
  }
  return new ConsoleMailer();
}
