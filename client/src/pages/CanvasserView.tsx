import { QRCodeSVG } from 'qrcode.react';

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
    <div className="flex flex-col items-center space-y-3">
      <QRCodeSVG value={link} size={200} level="M" />
      <a href={link} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold">
        Join Signal Group
      </a>
      <p className="text-xs text-gray-400">Scan QR code or tap the button</p>
    </div>
  );
}

export default function CanvasserView({ assignment, signalLink }: Props) {
  if (!assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">&#9203;</div>
          <p className="text-xl text-gray-600">Waiting for assignment...</p>
          <p className="text-sm text-gray-400 mt-2">Your organizer is setting up groups</p>
        </div>
        {signalLink && <SignalJoin link={signalLink} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6">
      <div className="text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">Your list number</p>
        <p className="text-6xl font-bold text-blue-600 mt-2">{assignment.listNumber}</p>
        <button
          onClick={() => navigator.clipboard.writeText(assignment.listNumber)}
          className="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm"
        >
          Copy to clipboard
        </button>
      </div>

      <div className="text-center">
        <p className="font-bold text-lg">
          {assignment.groupName}
          {assignment.isLead && (
            <span className="inline-block ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
              Group lead
            </span>
          )}
        </p>
        <div className="mt-2 space-y-1">
          {assignment.members.map((m) => (
            <p key={m} className="text-gray-600">{m}</p>
          ))}
        </div>
      </div>

      {signalLink && <SignalJoin link={signalLink} />}
    </div>
  );
}
