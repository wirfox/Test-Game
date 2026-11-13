import GUI from 'lil-gui';

export interface DebugTuning {
  exposure: number;
  maxDpr: number;
  ambient: number;
  fogDensity: number;
}

/** Live tuning panel, only with ?debug in the URL. */
export class DebugTools {
  private gui: GUI | null = null;

  constructor(tuning: DebugTuning, onChange: () => void) {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    this.gui = new GUI({ title: 'Réglages' });
    this.gui.add(tuning, 'exposure', 0.4, 2, 0.01).onChange(onChange);
    this.gui.add(tuning, 'maxDpr', 1, 2, 0.25).onChange(onChange);
    this.gui.add(tuning, 'ambient', 0, 2, 0.005).name('lumière ambiante').onChange(onChange);
    this.gui.add(tuning, 'fogDensity', 0, 0.3, 0.005).name('brouillard').onChange(onChange);
  }

  setHidden(hidden: boolean): void {
    if (!this.gui) return;
    if (hidden) this.gui.hide();
    else this.gui.show();
  }

  dispose(): void {
    this.gui?.destroy();
    this.gui = null;
  }
}
