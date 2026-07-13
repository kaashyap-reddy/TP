import type { FeedbackEntry } from '../types/feedback';

interface FeedbackCardProps {
  entry: FeedbackEntry;
  isNew?: boolean;
  batchName?: string;
}

/** One feedback entry, direction-aware ("X → Y") — shared by Admin/Facilitator/Trainee feedback views. */
export default function FeedbackCard({ entry, isNew, batchName }: FeedbackCardProps) {
  const [from, to] = entry.direction === 'TraineeToFacilitator' ? [entry.trainee, entry.facilitator] : [entry.facilitator, entry.trainee];

  return (
    <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="font-bold text-gray-800 text-sm truncate">
          {from} <span className="text-gray-400 font-normal">→</span> {to}
          {isNew && <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded uppercase align-middle">New</span>}
        </span>
        <span className="text-green-600 font-bold text-sm flex-shrink-0">{entry.rating}/5</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">{entry.category}</span>
        {batchName && <span>{batchName}</span>}
        <span>{entry.date}</span>
      </div>
      {entry.comment && <p className="text-sm text-gray-600">{entry.comment}</p>}
    </div>
  );
}
