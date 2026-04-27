import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useWebSocket } from '../hooks/useWebSocket';
import CanvasserCard from '../components/CanvasserCard';
import GroupColumn from '../components/GroupColumn';

interface Session {
  id: string;
  name: string;
  lists: { id: number; list_number: string; label?: string }[];
  groups: { id: number; name: string; group_lead_canvasser_id?: number | null }[];
  canvassers: { id: number; display_name: string; group_id: number | null }[];
  groupLists: { group_id: number; list_id: number }[];
}

interface Props {
  session: Session;
}

function buildCanvasserListMap(
  canvassers: Session['canvassers'],
  groupLists: Session['groupLists']
): Map<number, number> {
  // Map group_id -> list_id
  const groupToList = new Map<number, number>();
  for (const gl of groupLists) {
    groupToList.set(gl.group_id, gl.list_id);
  }
  // Map canvasser_id -> list_id
  const map = new Map<number, number>();
  for (const c of canvassers) {
    if (c.group_id) {
      const listId = groupToList.get(c.group_id);
      if (listId) map.set(c.id, listId);
    }
  }
  return map;
}

export default function AssignmentBoard({ session: initial }: Props) {
  const [canvassers, setCanvassers] = useState(initial.canvassers);
  const [groups, setGroups] = useState(initial.groups);
  const [, setGroupLists] = useState(initial.groupLists || []);
  // canvasserId -> listId
  const [assignments, setAssignments] = useState<Map<number, number>>(
    () => buildCanvasserListMap(initial.canvassers, initial.groupLists || [])
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const onMessage = useCallback((data: any) => {
    if (data.type === 'canvasser_joined') {
      setCanvassers((prev) => [...prev, data.canvasser]);
    }
    if (data.type === 'solo_assigned') {
      setCanvassers((prev) =>
        prev.map((c) => (c.id === data.canvasserId ? { ...c, group_id: data.groupId } : c))
      );
      if (data.groupId != null && data.listId != null) {
        setGroupLists((prev) => {
          if (prev.some((gl) => gl.group_id === data.groupId)) return prev;
          return [...prev, { group_id: data.groupId, list_id: data.listId }];
        });
        setGroups((prev) => {
          if (prev.some((g) => g.id === data.groupId)) return prev;
          return [...prev, { id: data.groupId, name: 'Solo', group_lead_canvasser_id: null }];
        });
      }
    }
    if (data.type === 'canvasser_unassigned') {
      setCanvassers((prev) =>
        prev.map((c) => (c.id === data.canvasserId ? { ...c, group_id: null } : c))
      );
    }
    if (data.type === 'group_created') {
      const ids: number[] = data.group?.canvasserIds ?? [];
      setCanvassers((prev) =>
        prev.map((c) => (ids.includes(c.id) ? { ...c, group_id: data.group.id } : c))
      );
      setGroups((prev) => {
        if (prev.some((g) => g.id === data.group.id)) return prev;
        return [
          ...prev,
          { id: data.group.id, name: data.group.name, group_lead_canvasser_id: null },
        ];
      });
    }
    if (data.type === 'group_lead_set') {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === data.groupId ? { ...g, group_lead_canvasser_id: data.canvasserId } : g
        )
      );
    }
  }, []);

  useWebSocket(initial.id, onMessage);

  const unassigned = canvassers.filter((c) => !assignments.has(c.id));

  function handleDragStart(event: DragStartEvent) {
    const id = parseInt(event.active.id.toString().replace('canvasser-', ''));
    setDraggingId(id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const canvasserId = parseInt(active.id.toString().replace('canvasser-', ''));
    const targetId = over.id.toString();

    if (targetId === 'unassigned') {
      // Unassign canvasser
      await fetch('/api/assignments/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: initial.id, canvasserId }),
      });
      setAssignments((prev) => {
        const next = new Map(prev);
        next.delete(canvasserId);
        return next;
      });
    } else {
      const listId = parseInt(targetId.replace('list-', ''));
      // Assign canvasser to list
      await fetch('/api/assignments/solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: initial.id, canvasserId, listId }),
      });
      setAssignments((prev) => {
        const next = new Map(prev);
        next.set(canvasserId, listId);
        return next;
      });
    }
  }

  const draggingCanvasser = draggingId ? canvassers.find((c) => c.id === draggingId) : null;

  function renderCard(c: Session['canvassers'][number]) {
    const group = c.group_id != null ? groups.find((g) => g.id === c.group_id) : undefined;
    const isLead = !!group && group.group_lead_canvasser_id === c.id;
    return (
      <CanvasserCard
        key={c.id}
        id={c.id}
        name={c.display_name}
        isLead={isLead}
        groupId={c.group_id}
        sessionId={initial.id}
      />
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold mb-6">{initial.name}</h1>

        <div className="flex gap-6">
          {/* Unassigned column — droppable */}
          <GroupColumn id="unassigned" listNumber="Unassigned" label={`${unassigned.length} canvassers`}>
            {unassigned.map(renderCard)}
          </GroupColumn>

          {/* List columns */}
          <div className="flex gap-4 flex-1 overflow-x-auto">
            {initial.lists.map((list) => {
              const assigned = canvassers.filter((c) => assignments.get(c.id) === list.id);
              return (
                <GroupColumn
                  key={list.id}
                  id={`list-${list.id}`}
                  listNumber={list.list_number}
                  label={list.label}
                >
                  {assigned.map(renderCard)}
                </GroupColumn>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay>
        {draggingCanvasser && (
          <div className="p-3 bg-white rounded-lg shadow-lg border-2 border-blue-500 cursor-grabbing">
            {draggingCanvasser.display_name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
