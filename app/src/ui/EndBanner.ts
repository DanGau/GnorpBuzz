import type { Game } from '../game/Game';

// Shown after the journal is dismissed — MVP end-of-prototype message.
export class EndBanner {
  readonly el: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'end-banner panel';
    this.el.innerHTML = `
      Thanks for trying the prototype!
      <small>The journey begins. <a href="#" style="color:#f5d166;">Reset</a> to play again.</small>
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
    const reviewed = this.game.state.vessel.phase === 'reviewed';
    this.el.style.display = reviewed ? '' : 'none';
  }
}
