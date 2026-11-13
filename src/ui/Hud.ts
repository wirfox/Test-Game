/** In-game text: a short-lived help line and an interaction prompt. */
export class Hud {
  private readonly help: HTMLElement;
  private readonly prompt: HTMLElement;
  private helpTimer: number | undefined;

  constructor(host: HTMLElement) {
    this.help = document.createElement('div');
    this.help.className = 'hud-help';
    this.help.hidden = true;
    this.prompt = document.createElement('div');
    this.prompt.className = 'hud-prompt';
    this.prompt.hidden = true;
    host.append(this.help, this.prompt);
  }

  showPrompt(text: string | null): void {
    this.prompt.hidden = text === null;
    if (text !== null && this.prompt.textContent !== text) this.prompt.textContent = text;
  }

  showHelp(text: string, seconds: number): void {
    this.help.textContent = text;
    this.help.hidden = false;
    window.clearTimeout(this.helpTimer);
    this.helpTimer = window.setTimeout(() => {
      this.help.hidden = true;
    }, seconds * 1000);
  }

  dispose(): void {
    window.clearTimeout(this.helpTimer);
    this.help.remove();
    this.prompt.remove();
  }
}
