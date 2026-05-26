// Plain HTML overlay for the PerfMonitor. F3 to toggle. Lives outside
// the Pixi canvas so it can't interact with hit-testing or take frame
// budget to render.

import type { PerfMonitor } from './PerfMonitor';

export class PerfOverlay {
  private el: HTMLDivElement;
  private visible = false;
  private monitor: PerfMonitor;
  private rafId: number | null = null;

  constructor(monitor: PerfMonitor) {
    this.monitor = monitor;
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:8px',
      'padding:8px 10px',
      'background:rgba(0,0,0,0.78)',
      'color:#cfe8ff',
      'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace',
      'border:1px solid #2a4a66',
      'border-radius:4px',
      'pointer-events:none',
      'white-space:pre',
      'z-index:9999',
      'display:none',
      'min-width:220px',
    ].join(';');
    document.body.appendChild(this.el);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
    if (this.visible && this.rafId === null) this.tick();
    if (!this.visible && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.visible) {
      this.rafId = null;
      return;
    }
    this.render();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const s = this.monitor.snapshot();
    const fps = s.frame.fps.toFixed(1).padStart(5);
    const frame = `${s.frame.avg.toFixed(1)}/${s.frame.p95.toFixed(1)}/${s.frame.max.toFixed(1)}`;
    const lines: string[] = [];
    lines.push(`FPS ${fps}   frame ${frame} ms (avg/p95/max)`);
    lines.push('');
    if (Object.keys(s.counts).length > 0) {
      const countParts = Object.entries(s.counts)
        .map(([k, v]) => `${k}:${v}`)
        .join('  ');
      lines.push(countParts);
      lines.push('');
    }
    lines.push('system            avg   p95   max  (ms)');
    for (const sys of s.systems) {
      const name = sys.name.padEnd(16).slice(0, 16);
      const avg = sys.avg.toFixed(2).padStart(5);
      const p95 = sys.p95.toFixed(2).padStart(5);
      const max = sys.max.toFixed(2).padStart(5);
      lines.push(`${name}  ${avg} ${p95} ${max}`);
    }
    this.el.textContent = lines.join('\n');
  }
}
