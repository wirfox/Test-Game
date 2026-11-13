const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const FALLBACK = 'ZQSD / WASD';

export interface KeyLayout {
  get(code: string): string | undefined;
}

/** Letters printed on the movement keys for this keyboard layout, e.g. "ZQSD" on AZERTY. */
export function movementKeyLabels(layout?: KeyLayout): string {
  if (!layout) return FALLBACK;
  const letters = MOVE_CODES.map((code) => layout.get(code));
  if (letters.some((letter) => !letter)) return FALLBACK;
  return letters.join('').toUpperCase();
}

/** Asks the browser for the layout; resolves to the fallback where the API is missing. */
export async function detectMovementKeyLabels(): Promise<string> {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<KeyLayout> } }).keyboard;
    return movementKeyLabels(keyboard ? await keyboard.getLayoutMap() : undefined);
  } catch {
    return FALLBACK;
  }
}
