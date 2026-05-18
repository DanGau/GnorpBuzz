import type { Game } from '../game/Game';

// A persistent escape hatch for retesting the game. Wipes save state and
// returns the colony to its starting condition. Two-step confirm (the
// button asks "Sure?" on first click) so a stray click doesn't nuke a
// long-running session.
export class ResetButton {
  readonly el: HTMLButtonElement;
  private armed = false;
  private armedResetTimer: number | null = null;

  constructor(private game: Game) {
    this.el = document.createElement('button');
    this.el.className = 'reset-btn panel';
    this.el.type = 'button';
    this.el.title = 'Reset the game to a fresh colony';
    this.el.textContent = '↻ Reset';
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.armed) {
        this.arm();
        return;
      }
      this.disarm();
      this.game.resetGame();
    });
  }

  // Show "Sure?" for a few seconds, then revert if the player doesn't
  // click again. Prevents an accidentally armed button from sitting hot
  // forever.
  private arm(): void {
    this.armed = true;
    this.el.classList.add('armed');
    this.el.textContent = '↻ Sure?';
    if (this.armedResetTimer !== null) window.clearTimeout(this.armedResetTimer);
    this.armedResetTimer = window.setTimeout(() => this.disarm(), 2500);
  }

  private disarm(): void {
    this.armed = false;
    this.el.classList.remove('armed');
    this.el.textContent = '↻ Reset';
    if (this.armedResetTimer !== null) {
      window.clearTimeout(this.armedResetTimer);
      this.armedResetTimer = null;
    }
  }

  update(): void {
    // Always visible; no state-driven hide.
  }
}
