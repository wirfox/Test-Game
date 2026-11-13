import { describe, expect, it } from 'vitest';
import { movementKeyLabels } from '../../src/ui/keyLabels';

const layout = (keys: Record<string, string>) => ({ get: (code: string) => keys[code] });

describe('movementKeyLabels', () => {
  it('shows ZQSD on an AZERTY layout', () => {
    expect(movementKeyLabels(layout({ KeyW: 'z', KeyA: 'q', KeyS: 's', KeyD: 'd' }))).toBe('ZQSD');
  });

  it('shows WASD on a QWERTY layout', () => {
    expect(movementKeyLabels(layout({ KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }))).toBe('WASD');
  });

  it('falls back to both when the layout is unknown', () => {
    expect(movementKeyLabels()).toBe('ZQSD / WASD');
    expect(movementKeyLabels(layout({ KeyW: 'z' }))).toBe('ZQSD / WASD');
  });
});
