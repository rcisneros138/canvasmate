import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CheckIn from './CheckIn';
import CanvasserView from './CanvasserView';

export default function JoinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);

  // Poll for assignment after check-in
  useEffect(() => {
    if (!sessionToken || !sessionId) return;

    const poll = async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) return;
      const session = await res.json();

      // Find this canvasser by token
      const canvasser = session.canvassers.find((c: any) => c.session_token === sessionToken);
      if (!canvasser || !canvasser.group_id) return;

      // Find the group and its signal link
      const group = session.groups.find((g: any) => g.id === canvasser.group_id);
      if (!group) return;

      // Find the list via groupLists
      const groupList = session.groupLists?.find((gl: any) => gl.group_id === group.id);
      const list = groupList ? session.lists.find((l: any) => l.id === groupList.list_id) : null;

      // Find group members
      const members = session.canvassers
        .filter((c: any) => c.group_id === group.id)
        .map((c: any) => c.display_name);

      setAssignment({
        listNumber: list?.list_number || 'TBD',
        groupName: group.name,
        members,
        signalLink: group.signal_group_link || undefined,
      });
    };

    // Poll immediately, then every 3 seconds
    poll();
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [sessionToken, sessionId]);

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
      assignment={assignment}
    />
  );
}
