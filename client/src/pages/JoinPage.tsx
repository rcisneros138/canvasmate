import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import CheckIn from './CheckIn';
import CanvasserView from './CanvasserView';
import { useWebSocket } from '../hooks/useWebSocket';

interface Props {
  /** Test-only seam: pre-populate the session token to skip CheckIn UI. */
  __testToken?: string;
}

export default function JoinPage({ __testToken }: Props = {}) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionToken, setSessionToken] = useState<string | null>(__testToken ?? null);
  const [assignment, setAssignment] = useState<any>(null);

  const refetch = useCallback(async () => {
    if (!sessionToken || !sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const session = await res.json();

    const canvasser = session.canvassers.find((c: any) => c.session_token === sessionToken);
    if (!canvasser || !canvasser.group_id) return;

    const group = session.groups.find((g: any) => g.id === canvasser.group_id);
    if (!group) return;

    const groupList = session.groupLists?.find((gl: any) => gl.group_id === group.id);
    const list = groupList ? session.lists.find((l: any) => l.id === groupList.list_id) : null;

    const members = session.canvassers
      .filter((c: any) => c.group_id === group.id)
      .map((c: any) => c.display_name);

    setAssignment({
      listNumber: list?.list_number || 'TBD',
      groupName: group.name,
      members,
      signalLink: group.signal_group_link || undefined,
    });
  }, [sessionToken, sessionId]);

  // Refetch once after check-in (covers the case where the org assigns
  // before the canvasser checks in).
  useEffect(() => { refetch(); }, [refetch]);

  // WebSocket: re-fetch on any assignment-relevant event.
  useWebSocket(sessionId ?? '', useCallback((msg) => {
    if (
      msg.type === 'group_created' ||
      msg.type === 'solo_assigned' ||
      msg.type === 'canvasser_unassigned' ||
      msg.type === 'session_locked'
    ) {
      refetch();
    }
  }, [refetch]));

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid session link</p>
      </div>
    );
  }

  if (!sessionToken) {
    return <CheckIn sessionId={sessionId} onCheckedIn={(token) => setSessionToken(token)} />;
  }

  return (
    <CanvasserView
      // Remount when an assignment first arrives so CanvasserView's internal
      // state picks up the new prop (it only reads `assignment` on mount).
      key={assignment ? 'assigned' : 'waiting'}
      sessionId={sessionId}
      sessionToken={sessionToken}
      assignment={assignment}
    />
  );
}
