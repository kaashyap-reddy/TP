import { Fragment, memo } from 'react';
import { Batch } from '../../store/batchesStore';
import ProgressBar from '../ProgressBar';
import StatusBadge from '../StatusBadge';

interface BatchRowProps {
  batch: Batch;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onManage: () => void;
  onSelectTrainee: (traineeName: string) => void;
}

function BatchRow({ batch: b, isExpanded, isSelected, onToggleExpand, onToggleSelect, onManage, onSelectTrainee }: BatchRowProps) {
  return (
    <Fragment>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-6 py-4">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} aria-label={`Select ${b.name}`} />
        </td>
        <td className="px-6 py-4">
          <button
            onClick={onToggleExpand}
            aria-label={isExpanded ? `Collapse ${b.name}` : `Expand ${b.name}`}
            className={`w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isExpanded ? 'rotate-90' : ''}`}
          >
            ›
          </button>
        </td>
        <td className="px-6 py-4">
          <div className="font-bold text-gray-900 text-base">{b.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            {b.traineeCount} Trainees Enrolled <span className="text-gray-300 mx-1">•</span> Started {b.startMonth}
          </div>
        </td>
        <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">{b.program}</span></td>
        <td className="px-6 py-4 font-medium text-gray-700">{b.poc || '—'}</td>
        <td className="px-6 py-4 w-48">
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-gray-400 uppercase font-bold flex-shrink-0">Avg Score <span className="text-blue-600 text-xs normal-case font-bold ml-1">{b.avgScore !== null ? `${b.avgScore}%` : '—'}</span></div>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={b.completion} color="bg-green-500" size="sm" />
          </div>
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={b.status} />
        </td>
        <td className="px-6 py-4">
          <button onClick={onManage} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            Manage ▾
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-6 py-4 bg-slate-50 border-t border-b border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Enrolled Trainees ({b.members.length})</div>
            {b.members.length === 0 ? (
              <p className="text-sm text-gray-400">No trainees enrolled yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {b.members.map((m) => (
                  <button
                    key={m}
                    onClick={() => onSelectTrainee(m)}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default memo(BatchRow);
