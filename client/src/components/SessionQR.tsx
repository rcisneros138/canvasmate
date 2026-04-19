import { QRCodeSVG } from 'qrcode.react';

interface Props {
  sessionId: string;
  baseUrl: string;
}

export default function SessionQR({ sessionId, baseUrl }: Props) {
  const url = `${baseUrl}/join/${sessionId}`;

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <QRCodeSVG value={url} size={256} level="M" />
      <p className="text-sm text-gray-500 font-mono">{url}</p>
    </div>
  );
}
