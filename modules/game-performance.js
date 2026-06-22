export function createPerformanceMonitor({ enabled = false, now = () => performance.now() } = {}) {
  const samples = new Map();

  function record(name, durationMs) {
    const current = samples.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    samples.set(name, current);
  }

  function measure(name, fn) {
    if (!enabled) return fn();
    const start = now();
    try {
      return fn();
    } finally {
      record(name, now() - start);
    }
  }

  function report() {
    return Array.from(samples.entries()).map(([name, sample]) => ({
      name,
      count: sample.count,
      totalMs: sample.totalMs,
      maxMs: sample.maxMs,
      averageMs: sample.count ? sample.totalMs / sample.count : 0,
    }));
  }

  function clear() {
    samples.clear();
  }

  return { enabled, measure, report, clear };
}
