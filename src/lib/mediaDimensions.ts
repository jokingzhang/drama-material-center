const commonRatios = [
  { width: 9, height: 21 },
  { width: 9, height: 16 },
  { width: 2, height: 3 },
  { width: 3, height: 4 },
  { width: 4, height: 5 },
  { width: 1, height: 1 },
  { width: 5, height: 4 },
  { width: 4, height: 3 },
  { width: 3, height: 2 },
  { width: 16, height: 9 },
  { width: 21, height: 9 },
] as const;

export function formatAspectRatio(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  const actual = width / height;
  const nearest = commonRatios
    .map((candidate) => ({ ...candidate, distance: Math.abs(Math.log(actual / (candidate.width / candidate.height))) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (nearest && nearest.distance <= 0.045) return `${nearest.width}:${nearest.height}`;
  return actual >= 1 ? `${actual.toFixed(2)}:1` : `1:${(1 / actual).toFixed(2)}`;
}
