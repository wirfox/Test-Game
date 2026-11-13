import { describe, expect, it, vi } from 'vitest';
import { Interaction, canInteract, type Interactable } from '../../src/player/Interaction';

const eye = { x: 0, y: 1.5, z: 0 };
const RANGE = 1.8;

describe('canInteract', () => {
  it('accepts a target 1.5 m straight ahead', () => {
    expect(canInteract(eye, 0, 0, { x: 1.5, y: 1.5, z: 0 }, RANGE)).toBe(true);
  });
  it('rejects a target beyond range', () => {
    expect(canInteract(eye, 0, 0, { x: 2.0, y: 1.5, z: 0 }, RANGE)).toBe(false);
  });
  it('rejects a target 45 degrees to the side', () => {
    const d = 1.5 / Math.SQRT2;
    expect(canInteract(eye, 0, 0, { x: d, y: 1.5, z: d }, RANGE)).toBe(false);
  });
  it('rejects a target behind', () => {
    expect(canInteract(eye, 0, 0, { x: -1.5, y: 1.5, z: 0 }, RANGE)).toBe(false);
  });
  it('follows yaw: facing +z (yaw PI/2) sees a target on +z', () => {
    expect(canInteract(eye, Math.PI / 2, 0, { x: 0, y: 1.5, z: 1.5 }, RANGE)).toBe(true);
  });
  it('follows pitch: looking up sees a target above, level view does not', () => {
    const above = { x: 1, y: 1.5 + 1, z: 0 };
    expect(canInteract(eye, 0, Math.PI / 4, above, RANGE)).toBe(true);
    expect(canInteract(eye, 0, 0, above, RANGE)).toBe(false);
  });
});

function target(overrides: Partial<Interactable> = {}): Interactable {
  return {
    id: 'box',
    position: { x: 1.5, y: 1.5, z: 0 },
    range: RANGE,
    prompt: 'E — Test',
    enabled: () => true,
    activate: vi.fn(),
    ...overrides,
  };
}

describe('Interaction', () => {
  it('focuses a visible target and activates it on press', () => {
    const t = target();
    const interaction = new Interaction([t], () => true);
    expect(interaction.update(eye, 0, 0, false)?.id).toBe('box');
    expect(t.activate).not.toHaveBeenCalled();
    interaction.update(eye, 0, 0, true);
    expect(t.activate).toHaveBeenCalledTimes(1);
  });

  it('ignores a target hidden behind a wall', () => {
    const t = target();
    const interaction = new Interaction([t], () => false);
    expect(interaction.update(eye, 0, 0, true)).toBeNull();
    expect(t.activate).not.toHaveBeenCalled();
  });

  it('ignores a disabled target', () => {
    const t = target({ enabled: () => false });
    expect(new Interaction([t], () => true).update(eye, 0, 0, true)).toBeNull();
    expect(t.activate).not.toHaveBeenCalled();
  });

  it('picks the target closest to the view centre', () => {
    const off = target({ id: 'off', position: { x: 1.5, y: 1.5, z: 0.3 } });
    const centre = target({ id: 'centre', position: { x: 1.6, y: 1.5, z: 0 } });
    expect(new Interaction([off, centre], () => true).update(eye, 0, 0, false)?.id).toBe('centre');
  });
});
