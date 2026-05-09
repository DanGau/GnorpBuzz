import { Application, Container, Graphics, Text, Ticker } from 'pixi.js';

export interface GameSnapshot {
  tick: number;
  elapsedMs: number;
  paused: boolean;
}

export class Game {
  readonly app: Application;
  readonly stage: Container;

  private tick = 0;
  private elapsedMs = 0;
  private paused = false;
  private skipRendering = false;
  private hello!: Graphics;
  private label!: Text;
  private boundUpdate = (ticker: Ticker) => this.update(ticker.deltaMS);

  constructor() {
    this.app = new Application();
    this.stage = new Container();
  }

  async init(mount: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: mount,
      background: 0x101418,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.stage);

    this.hello = new Graphics().rect(-60, -60, 120, 120).fill(0xffaa33);
    this.hello.x = this.app.renderer.width / 2;
    this.hello.y = this.app.renderer.height / 2;
    this.stage.addChild(this.hello);

    this.label = new Text({
      text: 'GnorpBuzz',
      style: { fill: 0xffffff, fontSize: 36, fontFamily: 'sans-serif' },
    });
    this.label.anchor.set(0.5);
    this.label.x = this.app.renderer.width / 2;
    this.label.y = this.app.renderer.height / 2 + 110;
    this.stage.addChild(this.label);

    this.app.ticker.add(this.boundUpdate);
  }

  private update(deltaMS: number): void {
    if (this.paused) return;
    this.tick += 1;
    this.elapsedMs += deltaMS;
    this.hello.rotation += (deltaMS / 1000) * 0.6;
  }

  // Step the simulation manually (used by debug.advanceTicks / stepAndRender for headless or
  // deterministic frame-stepping). Bypasses the paused flag so the agent can advance ticks
  // while the live ticker is paused.
  manualUpdate(deltaMS: number): void {
    this.tick += 1;
    this.elapsedMs += deltaMS;
    this.hello.rotation += (deltaMS / 1000) * 0.6;
  }

  pause(): void { this.paused = true; this.app.ticker.stop(); }
  resume(): void { this.paused = false; this.app.ticker.start(); }
  isPaused(): boolean { return this.paused; }

  snapshot(): GameSnapshot {
    return { tick: this.tick, elapsedMs: this.elapsedMs, paused: this.paused };
  }

  advanceTicks(n: number): GameSnapshot {
    const dt = 1000 / 60;
    for (let i = 0; i < n; i++) this.manualUpdate(dt);
    return this.snapshot();
  }

  render(): void {
    if (this.skipRendering) return;
    this.app.renderer.render(this.app.stage);
  }

  stepAndRender(n: number): GameSnapshot {
    const snap = this.advanceTicks(n);
    this.render();
    return snap;
  }

  attachDebugInterface(): void {
    const dbg = {
      snapshot: () => this.snapshot(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      isPaused: () => this.isPaused(),
      advanceTicks: (n: number) => this.advanceTicks(n),
      render: () => this.render(),
      stepAndRender: (n: number) => this.stepAndRender(n),
    };
    (window as unknown as { debug: typeof dbg }).debug = dbg;
  }
}
