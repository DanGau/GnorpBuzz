// Rolling per-system frame timing + object-count tracker. The Game's
// runSystems() wraps each system call with sample(name, fn) so we can
// answer "which system slowed down" without launching a profiler.
//
// All buffers are bounded ring buffers; nothing grows unboundedly.

const SAMPLE_WINDOW = 120; // ~2s @ 60fps — enough to smooth, short enough to spot regressions live

interface RingBuffer {
  data: Float32Array;
  head: number;
  count: number;
}

function newRing(): RingBuffer {
  return { data: new Float32Array(SAMPLE_WINDOW), head: 0, count: 0 };
}

function pushRing(r: RingBuffer, v: number): void {
  r.data[r.head] = v;
  r.head = (r.head + 1) % SAMPLE_WINDOW;
  if (r.count < SAMPLE_WINDOW) r.count++;
}

function stats(r: RingBuffer): { avg: number; p95: number; max: number } {
  if (r.count === 0) return { avg: 0, p95: 0, max: 0 };
  let sum = 0;
  const sorted = Array.from(r.data.subarray(0, r.count)).sort((a, b) => a - b);
  for (const v of sorted) sum += v;
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    avg: sum / sorted.length,
    p95: sorted[p95Idx],
    max: sorted[sorted.length - 1],
  };
}

export class PerfMonitor {
  private systems = new Map<string, RingBuffer>();
  private frameTime = newRing();
  private counts: Record<string, number> = {};

  // Time a single system call and record the ms it took. Use:
  //   perf.sample('rockDrops', () => rockDropsSystem(state, dt));
  sample<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    const result = fn();
    const dt = performance.now() - t0;
    let ring = this.systems.get(name);
    if (!ring) {
      ring = newRing();
      this.systems.set(name, ring);
    }
    pushRing(ring, dt);
    return result;
  }

  // Record total frame time (from the ticker). Frame time → FPS.
  recordFrame(deltaMs: number): void {
    pushRing(this.frameTime, deltaMs);
  }

  // Record an object count (drops, bees, particles, etc). Overwritten
  // each frame — we don't need history for these, just the current value.
  recordCount(name: string, value: number): void {
    this.counts[name] = value;
  }

  // Snapshot all stats for the overlay. Cheap enough to call every frame.
  snapshot(): {
    frame: { avg: number; p95: number; max: number; fps: number };
    systems: Array<{ name: string; avg: number; p95: number; max: number }>;
    counts: Record<string, number>;
  } {
    const frameStats = stats(this.frameTime);
    const sys = Array.from(this.systems.entries())
      .map(([name, ring]) => ({ name, ...stats(ring) }))
      .sort((a, b) => b.avg - a.avg);
    return {
      frame: { ...frameStats, fps: frameStats.avg > 0 ? 1000 / frameStats.avg : 0 },
      systems: sys,
      counts: { ...this.counts },
    };
  }
}
