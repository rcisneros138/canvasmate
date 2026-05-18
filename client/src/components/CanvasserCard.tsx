import { useDraggable } from '@dnd-kit/core';

interface Props {
  id: number;
  name: string;
  isLead?: boolean;
  groupId?: number | null;
  sessionId?: string;
}

export default function CanvasserCard({ id, name, isLead, groupId, sessionId }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvasser-${id}`,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  async function handleMakeLead(e: React.MouseEvent) {
    e.stopPropagation();
    if (groupId == null || !sessionId) return;
    const res = await fetch(`/api/assignments/groups/${groupId}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, canvasserId: id }),
    });
    if (!res.ok) {
      console.error(`Failed to set group lead: ${res.status} ${await res.text()}`);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group/card flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[2px] cursor-grab active:cursor-grabbing transition-[box-shadow,transform] ${
        isDragging
          ? 'shadow-none opacity-50'
          : 'shadow-[1px_1px_0_0_var(--color-rule)] hover:shadow-[2px_2px_0_0_var(--color-rule)] hover:-translate-y-px'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {isLead && (
          <span
            aria-label={`Group lead: ${name}`}
            title="Group lead"
            className="text-[var(--color-signal)] text-sm"
          >
            ★
          </span>
        )}
        <span className="truncate text-sm font-medium">{name}</span>
      </span>
      {groupId != null && !isLead && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleMakeLead}
          aria-label={`Make ${name} the lead`}
          className="opacity-0 group-hover/card:opacity-100 transition-opacity font-mono text-[10px] uppercase tracking-widest text-[var(--color-signal)] hover:underline shrink-0"
        >
          Make lead
        </button>
      )}
    </div>
  );
}
