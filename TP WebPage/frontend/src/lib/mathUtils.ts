export function average(values: Array<number | null>): number | null {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return null;
  return Math.round(nonNull.reduce((sum, v) => sum + v, 0) / nonNull.length);
}
