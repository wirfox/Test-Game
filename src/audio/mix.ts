/** Decibels to linear amplitude: -6 dB is about half, -20 dB is a tenth. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Volume slider (0..1) to gain. Squared, so the audible change spreads over the whole travel. */
export function sliderToGain(slider01: number): number {
  if (!Number.isFinite(slider01)) return 0;
  const clamped = Math.min(Math.max(slider01, 0), 1);
  return clamped * clamped;
}
