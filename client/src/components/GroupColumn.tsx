import { useDroppable } from '@dnd-kit/core';

interface Props {
  id: string;
  listNumber: string;
  label?: string;
  children: React.ReactNode;
}

export default function GroupColumn({ id, listNumber, label, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isUnassigned = id === 'unassigned';

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[220px] flex-1 rounded-[2px] border transition-colors ${
        isOver
          ? 'border-[var(--color-signal)] bg-[color-mix(in_oklab,var(--color-mark)_20%,var(--color-paper))]'
          : isUnassigned
          ? 'border-[var(--color-rule)] bg-[var(--color-paper-2)] border-dashed'
          : 'border-[var(--color-rule)] bg-[color-mix(in_oklab,var(--color-paper)_92%,white)]'
      }`}
    >
      <div className="px-4 pt-4 pb-3 border-b border-[color-mix(in_oklab,var(--color-rule)_25%,transparent)]">
        <div
          className={`${
            isUnassigned
              ? 'font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]'
              : 'font-mono text-lg tracking-tight text-[var(--color-ink)]'
          }`}
        >
          {listNumber}
        </div>
        {label && (
          <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mt-0.5">
            {label}
          </div>
        )}
      </div>
      <div className="p-3 space-y-2 min-h-[60px]">{children}</div>
    </div>
  );
}
