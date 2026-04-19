import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CheckIn from './CheckIn';
import CanvasserView from './CanvasserView';

export default function JoinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid session link</p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <CheckIn
        sessionId={sessionId}
        onCheckedIn={(token) => setSessionToken(token)}
      />
    );
  }

  return (
    <CanvasserView
      sessionId={sessionId}
      sessionToken={sessionToken}
      assignment={null}
    />
  );
}
