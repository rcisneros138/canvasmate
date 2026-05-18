import { QRCodeSVG } from 'qrcode.react';

interface Props {
  sessionId: string;
  baseUrl: string;
}

export default function SessionQR({ sessionId, baseUrl }: Props) {
  const url = `${baseUrl}/join/${sessionId}`;

  return (
    <div className="px-6 py-8 flex justify-center">
      <div className="card p-6 sm:p-8 flex flex-col items-center gap-5 max-w-md w-full">
        <div className="eyebrow">Join code</div>
        <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[2px]">
          <QRCodeSVG value={url} size={240} level="M" fgColor="#19170f" bgColor="transparent" />
        </div>
        <p className="font-mono text-xs sm:text-sm text-[var(--color-ink-soft)] break-all text-center">
          {url}
        </p>
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted)]">
          Volunteers scan to check in
        </p>
      </div>
    </div>
  );
}
