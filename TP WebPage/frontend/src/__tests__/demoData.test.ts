import { describe, expect, it } from 'vitest';
import {
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  DEMO_BATCHES,
  DEMO_SESSIONS,
  DEMO_TRAINING_PLANS,
  nthWorkingDay
} from '../services/api/demoData';

describe('nthWorkingDay', () => {
  it('returns the start day itself for n=0 on a weekday', () => {
    // 2026-09-01 is a Tuesday
    const d = nthWorkingDay(new Date(2026, 8, 1), 0);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(1);
  });

  it('rolls a weekend start forward to Monday', () => {
    // 2026-09-05 is a Saturday → Monday 2026-09-07
    const d = nthWorkingDay(new Date(2026, 8, 5), 0);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(7);
  });

  it('skips weekends when counting offsets', () => {
    // Tuesday + 4 working days = next Monday (Wed, Thu, Fri, [skip Sat/Sun], Mon)
    const d = nthWorkingDay(new Date(2026, 8, 1), 4);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(7);
  });
});

describe('curriculum fixtures', () => {
  it('has exactly two training plans with 42 sessions each', () => {
    expect(DEMO_TRAINING_PLANS.map((p) => p.code).sort()).toEqual(['ba-btech', 'ba-mba']);
    for (const plan of DEMO_TRAINING_PLANS) {
      expect(plan.sessions).toHaveLength(42);
    }
  });

  it('skips assignments on orientation and wrap-up days', () => {
    for (const plan of DEMO_TRAINING_PLANS) {
      // 42 days cycling 14 topics → 3 orientation + 3 wrap-up days carry no assignment
      expect(plan.assignments).toHaveLength(36);
      const nonAssignmentDays = plan.sessions.filter((s) => /orientation|wrap-up/i.test(s.title));
      expect(nonAssignmentDays).toHaveLength(6);
      const assignedOffsets = new Set(plan.assignments.map((a) => a.dueDayOffset));
      for (const day of nonAssignmentDays) {
        expect(assignedOffsets.has(day.dayOffset)).toBe(false);
      }
    }
  });

  it('schedules generated batch sessions at the 14:30 local wall-clock slot', () => {
    const first = DEMO_SESSIONS[0];
    const at = new Date(first.scheduledAt);
    expect(at.getHours()).toBe(14);
    expect(at.getMinutes()).toBe(30);
    expect(first.durationMinutes).toBe(120);
  });

  it('gives every generated assignment a labeled sample instructions file', () => {
    for (const assignment of DEMO_ASSIGNMENTS) {
      expect(assignment.attachment?.originalFilename).toMatch(/\(Sample\)\.txt$/);
      expect(assignment.attachment?.mimeType).toBe('text/plain');
    }
  });
});

describe('attendance fixtures', () => {
  it('covers only completed sessions, one record per batch member', () => {
    const completedIds = new Set(DEMO_SESSIONS.filter((s) => s.status === 'Completed').map((s) => s.id));
    expect(DEMO_ATTENDANCE.length).toBeGreaterThan(0);
    for (const record of DEMO_ATTENDANCE) {
      expect(completedIds.has(record.sessionId)).toBe(true);
      expect(['Present', 'Absent']).toContain(record.status);
    }
    // per completed session of the two full batches: one record per member (5 each)
    const bySession = new Map<string, number>();
    for (const record of DEMO_ATTENDANCE) bySession.set(record.sessionId, (bySession.get(record.sessionId) ?? 0) + 1);
    for (const count of bySession.values()) expect(count).toBe(5);
  });

  it('is mostly Present so percentages look realistic', () => {
    const present = DEMO_ATTENDANCE.filter((r) => r.status === 'Present').length;
    const ratio = present / DEMO_ATTENDANCE.length;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1);
  });
});

describe('batch fixtures', () => {
  it('ends each full batch on the date of its last scheduled session', () => {
    for (const batchId of ['demo-batch-ba-btech', 'demo-batch-ba-mba']) {
      const batch = DEMO_BATCHES.find((b) => b.id === batchId)!;
      const batchSessions = DEMO_SESSIONS.filter((s) => s.batchId === batchId);
      const lastSession = batchSessions.map((s) => new Date(s.scheduledAt)).sort((a, b) => b.getTime() - a.getTime())[0];
      const endDate = new Date(batch.endDate!);
      expect(endDate.toDateString()).toBe(lastSession.toDateString());
    }
  });
});
