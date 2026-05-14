import type { Game } from '../game/Game';

// Shown when the colony has tethered to the legendary mylar balloon and
// arrived at the sky flower.
export class EndBanner {
  readonly el: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'end-banner panel';
    this.el.innerHTML = `
      The colony has reached the flower.
      <small>We're staying. <a href="#" style="color:#f5d166;">Reset</a> to play again.</small>
    `;
    this.el.style.display = 'none';
    const link = this.el.querySelector('a')!;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this.game.resetGame();
      window.location.reload();
    });
  }

  update(): void {
    const arrived = this.game.state.ascent.phase === 'arrived';
    this.el.style.display = arrived ? '' : 'none';
  }
}
