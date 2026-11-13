import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../src/utils/random';

describe('createSeededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b());
  });

  it('returns a different sequence for a different seed', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(20);
  });

  it('stays in [0, 1)', () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 10_000; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
