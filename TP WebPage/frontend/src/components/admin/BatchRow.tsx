import { Fragment, memo } from 'react';
import { Batch } from '../../store/batchesStore';
import type { FacilitatorAssignment } from '../../store/facilitatorAssignmentsStore';
import ProgressBar from '../ProgressBar';
import StatusBadge from '../StatusBadge';

interface BatchRowProps {
  batch: Batch;
  /** This batch's active/upcoming team rows -- pre-filtered by the caller so this component stays presentational. */
  facilitatorTeam: FacilitatorAssignment[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onManage: () => void;
  onOpenProgram: () => void;
  onManageFacilitators: () => void;
  onManageFeedback: () => void;
  onSelectTrainee: (traineeName: string) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const MAX_VISIBLE_AVATARS = 3;

function BatchRow({ batch: b, facilitatorTeam, isExpanded, isSelected, onToggleExpand, onToggleSelect, onManage, onOpenProgram, onManageFacilitators, onManageFeedback, onSelectTrainee }: BatchRowProps) {
  const primary = facilitatorTeam.find((a) => a.isPrimaryCoordinator);
  const visible = facilitatorTeam.slice(0, MAX_VISIBLE_AVATARS);
  const extraCount = Math.max(0, facilitatorTeam.length - visible.length);

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
          <button onClick={onOpenProgram} className="font-bold text-gray-900 text-base hover:text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-left">
            {b.name}
          </button>
          <div className="text-xs text-gray-500 mt-1">
            {b.traineeCount} Trainees Enrolled <span className="text-gray-300 mx-1">•</span> Started {b.startMonth}
          </div>
        </td>
        <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">{b.program}</span></td>
        <td className="px-6 py-4 w-44">
          {facilitatorTeam.length === 0 ? (
            <div className="flex items-center gap-1 text-amber-700 text-xs font-bold">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              No coordinator
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 flex-shrink-0">
                {visible.map((a) => (
                  <span
                    key={a.id}
                    title={`${a.facilitatorName} — ${a.role}${a.status === 'Temporarily Unavailable' ? ' (unavailable)' : ''}`}
                    className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white ${
                      a.status === 'Temporarily Unavailable' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {initials(a.facilitatorName)}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">+{extraCount}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-800 truncate">{primary?.facilitatorName ?? 'No coordinator'}</div>
                <div className="text-[10px] text-gray-400">{facilitatorTeam.length} facilitator{facilitatorTeam.length === 1 ? '' : 's'}</div>
              </div>
            </div>
          )}
          <div className="flex flex-col items-start mt-1">
            <button onClick={onManageFacilitators} className="text-[11px] font-bold text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              Manage Facilitators
            </button>
            <button onClick={onManageFeedback} className="text-[11px] font-bold text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              Manage Feedback
            </button>
          </div>
        </td>
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
