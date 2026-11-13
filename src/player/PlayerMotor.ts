import type { InputIntent } from '../core/InputController';

/** Tunable player constants (metres, seconds, radians). */
export const PLAYER = {
  walkSpeed: 1.7,
  sprintSpeed: 2.9,
  accel: 12,
  eyeHeight: 1.62,
  radius: 0.3,
  halfHeight: 0.55,
  lookSensitivity: 0.002,
  pitchLimit: 1.48,
  strideLength: 0.7,
};

/**
 * Pure horizontal velocity update. yaw = 0 faces +x; "right" is then +z.
 * The velocity moves toward the wanted velocity at a constant rate, so the result
 * does not depend on how the time is sliced into steps.
 */
export function stepVelocity(
  current: { x: number; z: number },
  intent: Pick<InputIntent, 'moveX' | 'moveZ' | 'sprint'>,
  yaw: number,
  dt: number,
): { x: number; z: number } {
  let { moveX, moveZ } = intent;
  const length = Math.hypot(moveX, moveZ);
  if (length > 1) {
    moveX /= length;
    moveZ /= length;
  }
  const speed = intent.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const targetX = (cos * moveZ - sin * moveX) * speed;
  const targetZ = (sin * moveZ + cos * moveX) * speed;

  const dx = targetX - current.x;
  const dz = targetZ - current.z;
  const gap = Math.hypot(dx, dz);
  const maxChange = PLAYER.accel * dt;
  if (gap <= maxChange) return { x: targetX, z: targetZ };
  return { x: current.x + (dx / gap) * maxChange, z: current.z + (dz / gap) * maxChange };
}
