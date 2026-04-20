import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWebSocket } from '../hooks/useWebSocket';

interface Assignment {
  listNumber: string;
  groupName: string;
  members: string[];
  signalLink?: string;
}

interface Props {
  sessionId: string;
  sessionToken: string;
  assignment: Assignment | null;
}

export default function CanvasserView({ sessionId, sessionToken, assignment: initial }: Props) {
  const [assignment, setAssignment] = useState(initial);

  useWebSocket(sessionId, (data) => {
    if (data.type === 'assigned' && data.sessionToken === sessionToken) {
      setAssignment(data.assignment);
    }
    if (data.type === 'signal_group_created' && data.sessionToken === sessionToken) {
      setAssignment((prev) => prev ? { ...prev, signalLink: data.signalLink } : prev);
    }
  });

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">&#9203;</div>
          <p className="text-xl text-gray-600">Waiting for assignment...</p>
          <p className="text-sm text-gray-400 mt-2">Your organizer is setting up groups</p>
        </div>
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
        <p className="font-bold text-lg">{assignment.groupName}</p>
        <div className="mt-2 space-y-1">
          {assignment.members.map((m) => (
            <p key={m} className="text-gray-600">{m}</p>
          ))}
        </div>
      </div>

      {assignment.signalLink && (
        <div className="flex flex-col items-center space-y-3">
          <QRCodeSVG value={assignment.signalLink} size={200} level="M" />
          <a
            href={assignment.signalLink}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
          >
            Join Signal Group
          </a>
          <p className="text-xs text-gray-400">Scan QR code or tap the button</p>
        </div>
      )}
    </div>
  );
}
