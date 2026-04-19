import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useWebSocket } from '../hooks/useWebSocket';
import CanvasserCard from '../components/CanvasserCard';
import GroupColumn from '../components/GroupColumn';

interface Session {
  id: string;
  name: string;
  lists: { id: number; list_number: string; label?: string }[];
  groups: { id: number; name: string; listIds: number[]; canvasserIds: number[] }[];
  canvassers: { id: number; display_name: string; group_id: number | null }[];
}

interface Props {
  session: Session;
}

export default function AssignmentBoard({ session: initial }: Props) {
  const [canvassers, setCanvassers] = useState(initial.canvassers);
  const [groups, setGroups] = useState(initial.groups);

  const onMessage = useCallback((data: any) => {
    if (data.type === 'canvasser_joined') {
      setCanvassers((prev) => [...prev, data.canvasser]);
    }
  }, []);

  useWebSocket(initial.id, onMessage);

  const unassigned = canvassers.filter((c) => !c.group_id);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const canvasserId = parseInt(active.id.toString().replace('canvasser-', ''));
    const listId = parseInt(over.id.toString().replace('list-', ''));

    await fetch('/api/assignments/solo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: initial.id, canvasserId, listId }),
    });

    setCanvassers((prev) =>
      prev.map((c) => (c.id === canvasserId ? { ...c, group_id: -1 } : c))
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold mb-6">{initial.name}</h1>

        <div className="flex gap-6">
          {/* Unassigned column */}
          <div className="w-64 shrink-0">
            <h2 className="font-bold text-lg mb-3">Unassigned ({unassigned.length})</h2>
            <div className="space-y-2">
              {unassigned.map((c) => (
                <CanvasserCard key={c.id} id={c.id} name={c.display_name} />
              ))}
            </div>
          </div>

          {/* List columns */}
          <div className="flex gap-4 flex-1 overflow-x-auto">
            {initial.lists.map((list) => (
              <GroupColumn
                key={list.id}
                id={`list-${list.id}`}
                listNumber={list.list_number}
                label={list.label}
              >
                {canvassers
                  .filter((c) => c.group_id && c.group_id !== null)
                  .map((c) => (
                    <div key={c.id} className="p-2 bg-green-50 rounded text-sm">
                      {c.display_name}
                    </div>
                  ))}
              </GroupColumn>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
