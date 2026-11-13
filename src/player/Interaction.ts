import type { Vec3 } from '../core/events';

export const INTERACT_RANGE = 1.8;
const CONE_HALF_ANGLE = (20 * Math.PI) / 180;

/** Something the player can use by looking at it and pressing the interact key. */
export interface Interactable {
  id: string;
  position: Vec3;
  range: number;
  /** Text shown while the player can use it. */
  prompt: string;
  enabled(): boolean;
  activate(): void;
}

/** Angle in radians between the view direction and the direction to the target. */
function viewAngle(eye: Vec3, yaw: number, pitch: number, target: Vec3): number {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance === 0) return 0;
  // yaw 0 faces +x; positive pitch looks up.
  const fx = Math.cos(pitch) * Math.cos(yaw);
  const fy = Math.sin(pitch);
  const fz = Math.cos(pitch) * Math.sin(yaw);
  const dot = (dx * fx + dy * fy + dz * fz) / distance;
  return Math.acos(Math.min(Math.max(dot, -1), 1));
}

/** True when the target is within range and inside a 20 degree cone around the view direction. */
export function canInteract(eye: Vec3, yaw: number, pitch: number, target: Vec3, range: number): boolean {
  const distance = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
  return distance <= range && viewAngle(eye, yaw, pitch, target) <= CONE_HALF_ANGLE;
}

export class Interaction {
  constructor(
    private readonly targets: Interactable[],
    private readonly hasLineOfSight: (from: Vec3, to: Vec3) => boolean,
  ) {}

  /** Returns the target the player is aiming at, activating it when `pressed` is true. */
  update(eye: Vec3, yaw: number, pitch: number, pressed: boolean): Interactable | null {
    let focused: Interactable | null = null;
    let bestAngle = Infinity;
    for (const target of this.targets) {
      if (!target.enabled()) continue;
      if (!canInteract(eye, yaw, pitch, target.position, target.range)) continue;
      const angle = viewAngle(eye, yaw, pitch, target.position);
      if (angle >= bestAngle) continue;
      if (!this.hasLineOfSight(eye, target.position)) continue;
      focused = target;
      bestAngle = angle;
    }
    if (focused && pressed) focused.activate();
    return focused;
  }
}
