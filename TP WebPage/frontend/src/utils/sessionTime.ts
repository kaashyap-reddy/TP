export function dateStrToIso(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function isoToDateStr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function minutesToLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function parseOneTime(s: string): number | null {
  const m = s.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

export function parseTimeRange(timeStr: string): { start: number; end: number } {
  const parts = timeStr.split('-').map((s) => s.trim());
  const start = (parts[0] ? parseOneTime(parts[0]) : null) ?? 9 * 60;
  const end = (parts[1] ? parseOneTime(parts[1]) : null) ?? start + 60;
  return { start, end };
}

export function formatTimeRange(start: number, end: number): string {
  return `${minutesToLabel(start)} - ${minutesToLabel(end)}`;
}
