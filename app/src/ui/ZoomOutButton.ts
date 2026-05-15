import type { Game } from '../game/Game';

// A persistent escape hatch from the zoomed-in hive view. Shown only while
// the camera is focused on the hive; clicking it (or pressing Esc, or
// clicking empty space) returns to the wide overview.
export class ZoomOutButton {
  readonly el: HTMLButtonElement;

  constructor(private game: Game) {
    this.el = document.createElement('button');
    this.el.className = 'zoom-out-btn panel hidden';
    this.el.type = 'button';
    this.el.textContent = '⤢ Overview';
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.clearSelection();
    });
  }

  update(): void {
    this.el.classList.toggle('hidden', !this.game.isZoomedIn);
  }
}
