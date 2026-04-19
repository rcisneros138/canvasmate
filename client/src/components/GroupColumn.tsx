import { useDroppable } from '@dnd-kit/core';

interface Props {
  id: string;
  listNumber: string;
  label?: string;
  children: React.ReactNode;
}

export default function GroupColumn({ id, listNumber, label, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] p-4 rounded-lg border-2 border-dashed ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
    >
      <div className="font-bold text-lg">{listNumber}</div>
      {label && <div className="text-sm text-gray-500">{label}</div>}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}
