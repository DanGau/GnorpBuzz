import type { Game } from '../game/Game';

export class JournalModal {
  readonly el: HTMLDivElement;
  private textEl: HTMLParagraphElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'journal-modal';
    this.el.innerHTML = `
      <div class="card">
        <h2>Field Journal — Entry I</h2>
        <p class="text"></p>
        <div class="signature">— Ada, Scientist Bee</div>
        <button>Continue</button>
      </div>
    `;
    this.textEl = this.el.querySelector('.text')!;
    const button = this.el.querySelector('button')!;
    button.addEventListener('click', () => this.game.dismissJournal());
    this.el.style.display = 'none';
  }

  update(): void {
    const pending = this.game.state.journal.pending;
    if (!pending) {
      this.el.style.display = 'none';
      return;
    }
    const entry = this.game.state.journal.entries[this.game.state.journal.entries.length - 1];
    if (!entry) return;
    this.textEl.textContent = `“${entry.text}”`;
    this.el.style.display = '';
  }
}
