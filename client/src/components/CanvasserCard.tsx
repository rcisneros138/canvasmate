import { useDraggable } from '@dnd-kit/core';

interface Props {
  id: number;
  name: string;
}

export default function CanvasserCard({ id, name }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `canvasser-${id}` });

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 bg-white rounded-lg shadow border cursor-grab active:cursor-grabbing"
    >
      {name}
    </div>
  );
}
