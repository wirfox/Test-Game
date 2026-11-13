export const FIXED_DT = 1 / 60;

// Absorbs floating-point error so three 1/180 s frames add up to one step.
const EPSILON = 1e-9;

/**
 * Runs a simulation callback at a constant 60 Hz regardless of frame rate.
 * A long frame (background tab, breakpoint) is capped so it cannot cause a spiral
 * of catch-up steps; the time beyond the cap is dropped, not carried over.
 */
export class FixedStep {
  private accumulator = 0;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly maxStepsPerFrame = 6,
  ) {}

  /** Feeds one frame of real time. Returns the interpolation alpha in [0, 1). */
  advance(frameDeltaSeconds: number): number {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds <= 0) return this.alpha();

    this.accumulator += frameDeltaSeconds;
    let steps = 0;
    while (this.accumulator >= FIXED_DT - EPSILON && steps < this.maxStepsPerFrame) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (this.accumulator >= FIXED_DT - EPSILON) this.accumulator = 0;
    return this.alpha();
  }

  /** Runs simulated time synchronously, leaving the accumulator untouched (test hook). */
  runExactly(seconds: number): void {
    const steps = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < steps; i += 1) this.step(FIXED_DT);
  }

  private alpha(): number {
    return Math.min(Math.max(this.accumulator / FIXED_DT, 0), 1 - EPSILON);
  }
}
