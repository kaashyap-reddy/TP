import type { Session } from '../types/session';
import { parseTimeRange } from './sessionTime';

export interface TrainerConflict {
  session: Session;
  reason: 'overlap';
}

/** [start, end] as real timestamps (ms) -- returns null for invalid/missing date or time data
 * rather than throwing, since Demo Mode data can't be guaranteed clean. */
function sessionWindow(session: Session): [number, number] | null {
  const day = new Date(session.date);
  if (isNaN(day.getTime())) return null;
  const { start, end } = parseTimeRange(session.time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const base = day.getTime();
  return [base + start * 60 * 1000, base + end * 60 * 1000];
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * Practical demo-mode conflict detection (Phase 7): does the given trainer already have an
 * overlapping session -- as primary or co-trainer, in any batch, excluding the session(s) being
 * assigned right now? Deliberately simple: no timezone handling, no recurring-event logic, no
 * server-side scheduling engine -- just an in-memory overlap check against sessions already
 * loaded client-side.
 */
export function findTrainerConflicts(allSessions: Session[], trainerId: string, excludeSessionIds: string[], candidateWindows: Session[]): TrainerConflict[] {
  const otherAssigned = allSessions.filter(
    (s) =>
      !excludeSessionIds.includes(s.id) &&
      (s.status === 'Upcoming' || s.status === 'Live' || s.status === 'Rescheduled') &&
      (s.primaryTrainerId === trainerId || s.coTrainers.some((c) => c.id === trainerId))
  );

  const conflicts: TrainerConflict[] = [];
  for (const candidate of candidateWindows) {
    const candidateWindow = sessionWindow(candidate);
    if (!candidateWindow) continue;
    for (const other of otherAssigned) {
      const otherWindow = sessionWindow(other);
      if (!otherWindow) continue;
      if (overlaps(candidateWindow, otherWindow)) {
        conflicts.push({ session: other, reason: 'overlap' });
      }
    }
  }
  return conflicts;
}

export interface RosterConflict {
  trainerId: string;
  trainerName: string;
  sessionA: Session;
  sessionB: Session;
}

/** Scans every upcoming session for the same trainer double-booked on overlapping sessions --
 * across any batch, not just one. Used by the admin dashboard's Requires Attention panel. */
export function findAllTrainerConflicts(allSessions: Session[]): RosterConflict[] {
  const upcoming = allSessions.filter((s) => s.status === 'Upcoming' || s.status === 'Live' || s.status === 'Rescheduled');
  const byTrainer = new Map<string, { name: string; sessions: Session[] }>();

  for (const s of upcoming) {
    const participants: { id: string; name: string }[] = [];
    if (s.primaryTrainerId && s.primaryTrainerName) participants.push({ id: s.primaryTrainerId, name: s.primaryTrainerName });
    participants.push(...s.coTrainers);
    for (const p of participants) {
      const entry = byTrainer.get(p.id) ?? { name: p.name, sessions: [] };
      entry.sessions.push(s);
      byTrainer.set(p.id, entry);
    }
  }

  const results: RosterConflict[] = [];
  for (const [trainerId, { name, sessions: trainerSessions }] of byTrainer) {
    for (let i = 0; i < trainerSessions.length; i++) {
      const windowA = sessionWindow(trainerSessions[i]);
      if (!windowA) continue;
      for (let j = i + 1; j < trainerSessions.length; j++) {
        const windowB = sessionWindow(trainerSessions[j]);
        if (!windowB) continue;
        if (overlaps(windowA, windowB)) {
          results.push({ trainerId, trainerName: name, sessionA: trainerSessions[i], sessionB: trainerSessions[j] });
        }
      }
    }
  }
  return results;
}
