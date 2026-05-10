import type { Game } from '../game/Game';

// Small "Launch" button anchored next to the assembled airplane. Visible
// only while the vessel is in 'ready' phase. Clicking sends the vessel.

export class LaunchButton {
  readonly el: HTMLDivElement;
  private button: HTMLButtonElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'launch-anchor hidden';
    this.el.innerHTML = `<button class="launch-btn" type="button">Launch</button>`;
    this.button = this.el.querySelector('.launch-btn')! as HTMLButtonElement;
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.launchVessel();
    });
    // Don't let clicks here propagate to the page background and deselect.
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const visible = this.game.state.vessel.phase === 'ready';
    this.el.classList.toggle('hidden', !visible);
  }
}
