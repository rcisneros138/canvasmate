import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AssignmentBoard from './AssignmentBoard';
import SessionQR from '../components/SessionQR';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const loadSession = useCallback(() => {
    if (!id) return;
    fetch(`/api/sessions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then(setSession)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function handleActivate() {
    const res = await fetch(`/api/sessions/${id}/activate`, { method: 'POST' });
    if (res.ok) {
      setShowQR(true);
      loadSession();
    }
  }

  async function handleLock() {
    const res = await fetch(`/api/sessions/${id}/lock`, { method: 'POST' });
    if (res.ok) {
      loadSession();
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading session...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-6 pt-4 flex-wrap">
        {session.status === 'setup' && (
          <button
            onClick={handleActivate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold"
          >
            Activate Session
          </button>
        )}

        {session.status === 'active' && (
          <>
            <button
              onClick={() => setShowQR(!showQR)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              {showQR ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            <button
              onClick={handleLock}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold"
            >
              Lock Assignments
            </button>
          </>
        )}

        <span className="text-sm text-gray-500">
          Status: <span className="font-medium capitalize">{session.status}</span>
        </span>
        <span className="text-sm text-gray-500">
          Canvassers: <span className="font-medium">{session.canvassers.length}</span>
        </span>
      </div>

      {showQR && session.status === 'active' && (
        <SessionQR sessionId={session.id} baseUrl={window.location.origin} />
      )}

      {session.status === 'setup' && (
        <div className="px-6 py-12 text-center text-gray-500">
          <p className="text-lg">Session is in setup mode.</p>
          <p className="text-sm mt-2">Click "Activate Session" to start accepting check-ins and show the QR code.</p>
        </div>
      )}

      {session.status === 'locked' && (
        <div className="px-6 py-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 font-bold">Assignments are locked</p>
            <p className="text-green-600 text-sm mt-1">Canvassers can see their list numbers. Signal groups have been created.</p>
          </div>
        </div>
      )}

      {(session.status === 'active' || session.status === 'locked') && (
        <AssignmentBoard session={session} />
      )}
    </div>
  );
}
