import { useDraggable } from '@dnd-kit/core';

interface Props {
  id: number;
  name: string;
  isLead?: boolean;
  groupId?: number | null;
  sessionId?: string;
}

export default function CanvasserCard({ id, name, isLead, groupId, sessionId }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `canvasser-${id}` });

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  async function handleMakeLead(e: React.MouseEvent) {
    e.stopPropagation();
    if (groupId == null || !sessionId) return;
    await fetch(`/api/assignments/groups/${groupId}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, canvasserId: id }),
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 bg-white rounded-lg shadow border cursor-grab active:cursor-grabbing flex items-center justify-between"
    >
      <span className="flex items-center gap-2">
        {isLead && (
          <span aria-label={`Group lead: ${name}`} title="Group lead">
            ★
          </span>
        )}
        {name}
      </span>
      {groupId != null && !isLead && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleMakeLead}
          className="text-xs text-blue-600 hover:underline ml-2"
          aria-label={`Make ${name} the lead`}
        >
          Make lead
        </button>
      )}
    </div>
  );
}
