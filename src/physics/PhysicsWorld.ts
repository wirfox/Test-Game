import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/events';
import type { BoxDef } from '../world/roomDefinition';

let rapierReady: Promise<void> | null = null;

/** Owns the Rapier world. Level geometry is primitive colliders only, never visual meshes. */
export class PhysicsWorld {
  private constructor(readonly world: RAPIER.World) {}

  static async create(): Promise<PhysicsWorld> {
    rapierReady ??= RAPIER.init();
    await rapierReady;
    return new PhysicsWorld(new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
  }

  addFixedBox(box: BoxDef): void {
    const desc = RAPIER.ColliderDesc.cuboid(box.size.x / 2, box.size.y / 2, box.size.z / 2).setTranslation(
      box.center.x,
      box.center.y,
      box.center.z,
    );
    this.world.createCollider(desc);
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  /** Nearest hit on fixed level geometry along a ray, or null. The direction does not need to be normalized. */
  castRay(from: Vec3, dir: Vec3, maxDist: number): { distance: number } | null {
    const length = Math.hypot(dir.x, dir.y, dir.z);
    if (length === 0) return null;
    const ray = new RAPIER.Ray(from, { x: dir.x / length, y: dir.y / length, z: dir.z / length });
    // Level geometry only: the ray often starts inside the player's own capsule.
    const hit = this.world.castRay(ray, maxDist, true, RAPIER.QueryFilterFlags.ONLY_FIXED);
    return hit ? { distance: hit.timeOfImpact } : null;
  }

  dispose(): void {
    this.world.free();
  }
}
