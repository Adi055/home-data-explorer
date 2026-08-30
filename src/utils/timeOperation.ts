// Small timing helper shared by every operation the Footer reports on
// (initial load now; sort/filter/group later).
export function timeOperation<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}
