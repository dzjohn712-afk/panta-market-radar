/** Same-process guard only. A rejection is never retained after settlement. */
export function singleFlight<T>(
  flights: Map<string, Promise<unknown>>,
  key: string,
  build: () => Promise<T>,
): Promise<T> {
  const existing = flights.get(key);
  if (existing) return existing as Promise<T>;
  const pending = Promise.resolve().then(build).finally(() => {
    if (flights.get(key) === pending) flights.delete(key);
  });
  flights.set(key, pending);
  return pending;
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Invalid concurrency limit");
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]!);
    }
  }));
  return results;
}
