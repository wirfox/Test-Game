import { describe, expect, it } from 'vitest';
import { dbToGain, sliderToGain } from '../../src/audio/mix';

describe('dbToGain', () => {
  it('maps decibels to linear amplitude', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 5);
    expect(dbToGain(-60)).toBeCloseTo(0.001, 6);
    expect(dbToGain(6)).toBeCloseTo(1.995, 3);
  });
});

describe('sliderToGain', () => {
  it('squares the slider so the audible change spreads over its whole travel', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25, 6);
  });
  it('clamps values outside [0, 1]', () => {
    expect(sliderToGain(-1)).toBe(0);
    expect(sliderToGain(3)).toBe(1);
    expect(sliderToGain(Number.NaN)).toBe(0);
  });
});
