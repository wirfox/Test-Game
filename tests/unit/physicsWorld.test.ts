import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld';

describe('PhysicsWorld', () => {
  it('hits a fixed box with a ray at the expected distance', async () => {
    const physics = await PhysicsWorld.create();
    physics.addFixedBox({ id: 'w', kind: 'wall', center: { x: 5, y: 1, z: 0 }, size: { x: 1, y: 2, z: 2 } });
    physics.step(1 / 60);
    const hit = physics.castRay({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 20);
    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(4.5, 3);
  });

  it('returns null when nothing is in range', async () => {
    const physics = await PhysicsWorld.create();
    physics.addFixedBox({ id: 'w', kind: 'wall', center: { x: 5, y: 1, z: 0 }, size: { x: 1, y: 2, z: 2 } });
    physics.step(1 / 60);
    expect(physics.castRay({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 3)).toBeNull();
    expect(physics.castRay({ x: 0, y: 1, z: 0 }, { x: -1, y: 0, z: 0 }, 20)).toBeNull();
  });

  it('normalizes the ray direction', async () => {
    const physics = await PhysicsWorld.create();
    physics.addFixedBox({ id: 'w', kind: 'wall', center: { x: 5, y: 1, z: 0 }, size: { x: 1, y: 2, z: 2 } });
    physics.step(1 / 60);
    expect(physics.castRay({ x: 0, y: 1, z: 0 }, { x: 10, y: 0, z: 0 }, 20)!.distance).toBeCloseTo(4.5, 3);
  });
});
