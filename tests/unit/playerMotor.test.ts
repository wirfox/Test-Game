import { describe, expect, it } from 'vitest';
import { PLAYER, stepVelocity } from '../../src/player/PlayerMotor';

const REST = { x: 0, z: 0 };
const forward = { moveX: 0, moveZ: 1, sprint: false };
const none = { moveX: 0, moveZ: 0, sprint: false };

function run(intent: typeof forward, yaw: number, seconds: number, dt = 1 / 60, start = REST) {
  let v = start;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) v = stepVelocity(v, intent, yaw, dt);
  return v;
}

describe('stepVelocity', () => {
  it('reaches walk speed going forward along +x at yaw 0', () => {
    const v = run(forward, 0, 1);
    expect(v.x).toBeCloseTo(PLAYER.walkSpeed, 2);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('reaches sprint speed', () => {
    const v = run({ ...forward, sprint: true }, 0, 1);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(PLAYER.sprintSpeed, 2);
  });

  it('does not accelerate instantly', () => {
    const v = stepVelocity(REST, forward, 0, 1 / 60);
    expect(Math.hypot(v.x, v.z)).toBeLessThan(PLAYER.walkSpeed * 0.5);
    expect(Math.hypot(v.x, v.z)).toBeGreaterThan(0);
  });

  it('normalizes diagonal input', () => {
    const v = run({ moveX: 1, moveZ: 1, sprint: false }, 0, 1);
    expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(PLAYER.walkSpeed + 1e-6);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(PLAYER.walkSpeed, 2);
  });

  it('stops within 0.3 s without input', () => {
    const v = run(none, 0, 0.3, 1 / 60, { x: PLAYER.sprintSpeed, z: 0 });
    expect(Math.hypot(v.x, v.z)).toBeLessThan(0.05);
  });

  it('rotates with yaw: yaw PI/2 moves along +z, yaw PI along -x', () => {
    const quarter = run(forward, Math.PI / 2, 1);
    expect(quarter.x).toBeCloseTo(0, 5);
    expect(quarter.z).toBeCloseTo(PLAYER.walkSpeed, 2);
    expect(run(forward, Math.PI, 1).x).toBeCloseTo(-PLAYER.walkSpeed, 2);
  });

  it('strafes right toward +z when facing +x', () => {
    const v = run({ moveX: 1, moveZ: 0, sprint: false }, 0, 1);
    expect(v.z).toBeCloseTo(PLAYER.walkSpeed, 2);
    expect(v.x).toBeCloseTo(0, 5);
  });

  it('gives the same result at 60 Hz and 120 Hz', () => {
    const a = run(forward, 0.7, 0.1, 1 / 60);
    const b = run(forward, 0.7, 0.1, 1 / 120);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.02 * PLAYER.walkSpeed);
  });
});
