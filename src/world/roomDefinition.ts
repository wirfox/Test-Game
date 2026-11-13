import type { Vec3 } from '../core/events';

export type BoxKind = 'wall' | 'floor' | 'ceiling' | 'prop';

/** One axis-aligned box: a visual mesh and a physics collider share this definition. */
export interface BoxDef {
  id: string;
  center: Vec3;
  size: Vec3;
  kind: BoxKind;
  /** Display color; props differ so they read as separate objects. */
  color?: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomDef {
  boxes: BoxDef[];
  /** yaw = 0 looks toward +x, yaw = PI toward -x. */
  spawn: { position: Vec3; yaw: number };
  fuseBox: Vec3;
  knockAnchors: Vec3[];
  apparitionAnchor: { position: Vec3; yaw: number };
  /** Interior floor areas, used by tests to prove the player never leaves the level. */
  walkable: Rect[];
}

// Metres, Y up, floor at y = 0.
const H = 2.6; // ceiling height
const T = 0.2; // wall thickness
const DOOR_H = 2.1;

const wall = (id: string, cx: number, cz: number, sx: number, sz: number): BoxDef => ({
  id,
  kind: 'wall',
  center: { x: cx, y: H / 2, z: cz },
  size: { x: sx, y: H, z: sz },
});

const prop = (id: string, c: [number, number, number], s: [number, number, number], color: number): BoxDef => ({
  id,
  kind: 'prop',
  center: { x: c[0], y: c[1], z: c[2] },
  size: { x: s[0], y: s[1], z: s[2] },
  color,
});

const slab = (id: string, kind: 'floor' | 'ceiling', cx: number, sx: number, sz: number): BoxDef => ({
  id,
  kind,
  center: { x: cx, y: kind === 'floor' ? -0.05 : H + 0.05, z: 0 },
  size: { x: sx, y: 0.1, z: sz },
});

export const ROOM: RoomDef = {
  boxes: [
    // Main room: interior x in [-4, 4], z in [-3, 3].
    slab('room-floor', 'floor', 0, 8 + 2 * T, 6 + 2 * T),
    slab('room-ceiling', 'ceiling', 0, 8 + 2 * T, 6 + 2 * T),
    wall('room-north', 0, 3 + T / 2, 8 + 2 * T, T),
    wall('room-south', 0, -3 - T / 2, 8 + 2 * T, T),
    wall('room-east', 4 + T / 2, 0, T, 6),
    // West wall, split around the 1 m wide, 2.1 m high opening to the corridor.
    wall('room-west-north', -4 - T / 2, 1.75, T, 2.5),
    wall('room-west-south', -4 - T / 2, -1.75, T, 2.5),
    {
      id: 'room-west-lintel',
      kind: 'wall',
      center: { x: -4 - T / 2, y: (DOOR_H + H) / 2, z: 0 },
      size: { x: T, y: H - DOOR_H, z: 1.0 },
    },
    // Entry corridor: interior x in [-8, -4], z in [-0.7, 0.7].
    slab('corridor-floor', 'floor', -6.2, 4.0, 1.4 + 2 * T),
    slab('corridor-ceiling', 'ceiling', -6.2, 4.0, 1.4 + 2 * T),
    wall('corridor-north', -6.2, 0.7 + T / 2, 4.0, T),
    wall('corridor-south', -6.2, -0.7 - T / 2, 4.0, T),
    wall('corridor-end', -8 - T / 2, 0, T, 1.4 + 2 * T),
    // Inner partition: hides the fuse box nook from the doorway.
    wall('partition', 1.5, -1.25, 0.15, 3.5),
    // Furniture.
    prop('sofa', [-1.5, 0.4, 1.8], [2.0, 0.8, 0.9], 0x3a2f2a),
    prop('table', [-0.5, 0.375, -1.2], [1.2, 0.75, 0.8], 0x4a3524),
    prop('wardrobe', [-3.3, 0.95, -2.7], [0.9, 1.9, 0.45], 0x2c2219),
    prop('shelf', [3.7, 0.9, 1.6], [0.4, 1.8, 1.2], 0x35291d),
  ],
  spawn: { position: { x: -7.3, y: 0, z: 0 }, yaw: 0 },
  fuseBox: { x: 3.95, y: 1.4, z: -2.0 },
  knockAnchors: [
    { x: -3.8, y: 1.2, z: 2.8 },
    { x: 3.8, y: 1.2, z: 2.8 },
    { x: -7.9, y: 1.2, z: 0 },
    { x: 0, y: 2.5, z: -2.9 },
    { x: 1.7, y: 1.2, z: -2.8 },
  ],
  apparitionAnchor: { position: { x: -3.2, y: 0, z: 0 }, yaw: 0 },
  walkable: [
    { minX: -4, maxX: 4, minZ: -3, maxZ: 3 },
    { minX: -8, maxX: -4, minZ: -0.7, maxZ: 0.7 },
  ],
};

export function isInsideWalkable(room: RoomDef, x: number, z: number): boolean {
  return room.walkable.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}
