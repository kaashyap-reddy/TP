import type { AssignmentBatchRef } from '../types/assignment';

interface AssignmentBatchesCellProps {
  batches: AssignmentBatchRef[];
  /** Above this many batches, collapse to "N batches" (full names still in the title tooltip). */
  maxInline?: number;
}

/** Renders an assignment's assigned batch(es) for a table cell — one name, a joined list, or a collapsed "N batches" summary once there are too many to fit inline. */
export default function AssignmentBatchesCell({ batches, maxInline = 2 }: AssignmentBatchesCellProps) {
  if (!batches || batches.length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  const names = batches.map((b) => b.name).join(', ');
  const label = batches.length > maxInline ? `${batches.length} batches` : names;

  return (
    <span className="block truncate max-w-[220px]" title={names}>
      {label}
    </span>
  );
}
