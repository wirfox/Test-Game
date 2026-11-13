import type { GameState } from '../game/diagnostics';

const TEXT: Record<Exclude<GameState, 'playing'>, { title: string; hint: string }> = {
  title: { title: 'Chasseur de fantôme', hint: 'Cliquer pour commencer' },
  paused: { title: 'Pause', hint: 'Cliquer pour reprendre' },
  ended: { title: 'Fin du prototype', hint: '' },
};

/** Full-screen overlays for the non-playing states. */
export class Screens {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly restart: HTMLButtonElement;

  constructor(
    host: HTMLElement,
    private readonly onActivate: (state: GameState) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'screen';
    this.title = document.createElement('h1');
    this.hint = document.createElement('p');
    this.restart = document.createElement('button');
    this.restart.type = 'button';
    this.restart.textContent = 'Rejouer';
    this.restart.addEventListener('click', (event) => {
      event.stopPropagation();
      window.location.reload();
    });
    this.root.append(this.title, this.hint, this.restart);
    this.root.addEventListener('click', () => {
      const state = this.root.dataset.state as GameState | undefined;
      if (state === 'title' || state === 'paused') this.onActivate(state);
    });
    host.append(this.root);
  }

  show(state: GameState): void {
    if (state === 'playing') {
      this.root.hidden = true;
      return;
    }
    const text = TEXT[state];
    this.root.hidden = false;
    this.root.dataset.state = state;
    this.title.textContent = text.title;
    this.hint.textContent = text.hint;
    this.hint.hidden = text.hint === '';
    this.restart.hidden = state !== 'ended';
  }
}
