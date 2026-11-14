export function readingProgress(top: number, height: number, viewport: number, offset = 96): number {
  const travel = height - viewport + offset;
  if (travel <= 0) return top + height <= viewport ? 1 : 0;
  return Math.min(1, Math.max(0, (offset - top) / travel));
}
