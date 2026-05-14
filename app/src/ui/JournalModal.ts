import type { Game } from '../game/Game';
import { ARTIFACTS } from '../sim/state';

// When an artifact is uncovered we light up a modal: reverent name (large),
// the real-name subtitle (the joke), then Ada's field-note text.
export class JournalModal {
  readonly el: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private subtitleEl: HTMLDivElement;
  private textEl: HTMLParagraphElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'journal-modal';
    this.el.innerHTML = `
      <div class="card">
        <h2 class="title">Artifact Uncovered</h2>
        <div class="subtitle" style="opacity:0.6; font-style:italic; margin-bottom:12px;"></div>
        <p class="text"></p>
        <div class="signature">— Ada, Scientist Bee</div>
        <button>Continue</button>
      </div>
    `;
    this.titleEl = this.el.querySelector('.title')!;
    this.subtitleEl = this.el.querySelector('.subtitle')!;
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
    const spec = ARTIFACTS.find((a) => a.id === entry.id);
    this.titleEl.textContent = spec ? spec.reverentName : 'Artifact Uncovered';
    this.subtitleEl.textContent = spec ? `(${spec.realName})` : '';
    this.textEl.textContent = `“${entry.text}”`;
    this.el.style.display = '';
  }
}
