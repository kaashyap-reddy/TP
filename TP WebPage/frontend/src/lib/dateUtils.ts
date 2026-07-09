export function isRecentlyUpdated(dateStr: string, withinDays = 7): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}
