import { describe, expect, it } from 'vitest';
import { FIXED_DT, FixedStep } from '../../src/core/FixedStep';

function counter() {
  let steps = 0;
  const stepper = new FixedStep(() => {
    steps += 1;
  });
  return { stepper, steps: () => steps };
}

describe('FixedStep', () => {
  it('runs one step for one 60 Hz frame', () => {
    const c = counter();
    c.stepper.advance(1 / 60);
    expect(c.steps()).toBe(1);
  });

  it('passes the fixed dt to the step callback', () => {
    const seen: number[] = [];
    new FixedStep((dt) => seen.push(dt)).advance(1 / 60);
    expect(seen).toEqual([FIXED_DT]);
  });

  it('caps a very long frame at 6 steps and drops the rest (tab in background)', () => {
    const c = counter();
    c.stepper.advance(0.5);
    expect(c.steps()).toBe(6);
    // No time debt carried over: the next normal frame runs exactly one step.
    c.stepper.advance(1 / 60);
    expect(c.steps()).toBe(7);
  });

  it('accumulates small frames until a full step is due', () => {
    const c = counter();
    c.stepper.advance(1 / 180);
    c.stepper.advance(1 / 180);
    expect(c.steps()).toBe(0);
    c.stepper.advance(1 / 180);
    expect(c.steps()).toBe(1);
  });

  it('returns an interpolation alpha in [0, 1)', () => {
    const c = counter();
    for (const delta of [0.001, 0.0166, 0.02, 0.0333, 0.5, 0.0001]) {
      const alpha = c.stepper.advance(delta);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('returns the leftover fraction as alpha', () => {
    const c = counter();
    expect(c.stepper.advance(FIXED_DT * 1.5)).toBeCloseTo(0.5, 5);
  });

  it('runExactly(2) runs 120 steps without touching the accumulator', () => {
    const c = counter();
    c.stepper.advance(FIXED_DT * 0.5);
    c.stepper.runExactly(2);
    expect(c.steps()).toBe(120);
    expect(c.stepper.advance(FIXED_DT * 0.5)).toBeLessThan(1);
    expect(c.steps()).toBe(121);
  });

  it('ignores negative and NaN frame deltas', () => {
    const c = counter();
    expect(c.stepper.advance(-1)).toBe(0);
    expect(c.stepper.advance(Number.NaN)).toBe(0);
    expect(c.steps()).toBe(0);
  });
});
