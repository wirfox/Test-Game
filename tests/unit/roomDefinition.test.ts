import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/core/events';
import { type BoxDef, ROOM, isInsideWalkable } from '../../src/world/roomDefinition';

const solid = (b: BoxDef) => b.kind === 'wall' || b.kind === 'prop';

function boxDistance(b: BoxDef, p: Vec3): number {
  const dx = Math.max(Math.abs(p.x - b.center.x) - b.size.x / 2, 0);
  const dy = Math.max(Math.abs(p.y - b.center.y) - b.size.y / 2, 0);
  const dz = Math.max(Math.abs(p.z - b.center.z) - b.size.z / 2, 0);
  return Math.hypot(dx, dy, dz);
}

/** Horizontal overlap between a box grown by `margin` and a point. */
function coversXZ(b: BoxDef, x: number, z: number, margin: number): boolean {
  return Math.abs(x - b.center.x) <= b.size.x / 2 + margin && Math.abs(z - b.center.z) <= b.size.z / 2 + margin;
}

function intersects(b: BoxDef, min: Vec3, max: Vec3): boolean {
  return (
    b.center.x - b.size.x / 2 < max.x &&
    b.center.x + b.size.x / 2 > min.x &&
    b.center.y - b.size.y / 2 < max.y &&
    b.center.y + b.size.y / 2 > min.y &&
    b.center.z - b.size.z / 2 < max.z &&
    b.center.z + b.size.z / 2 > min.z
  );
}

describe('ROOM', () => {
  it('places spawn, fuse box and apparition anchor on walkable floor', () => {
    expect(isInsideWalkable(ROOM, ROOM.spawn.position.x, ROOM.spawn.position.z)).toBe(true);
    expect(isInsideWalkable(ROOM, ROOM.fuseBox.x, ROOM.fuseBox.z)).toBe(true);
    const a = ROOM.apparitionAnchor.position;
    expect(isInsideWalkable(ROOM, a.x, a.z)).toBe(true);
  });

  it('keeps spawn and apparition anchor at least 0.4 m from any solid box', () => {
    for (const p of [ROOM.spawn.position, ROOM.apparitionAnchor.position]) {
      const blockers = ROOM.boxes.filter((b) => solid(b) && coversXZ(b, p.x, p.z, 0.4));
      expect(blockers.map((b) => b.id), `near ${JSON.stringify(p)}`).toEqual([]);
    }
  });

  it('leaves the corridor and its opening into the room unobstructed', () => {
    const min = { x: -7.6, y: 0.05, z: -0.4 };
    const max = { x: -3.5, y: 2.0, z: 0.4 };
    expect(ROOM.boxes.filter((b) => solid(b) && intersects(b, min, max)).map((b) => b.id)).toEqual([]);
  });

  it('closes the space: the opening is the only gap in the west wall', () => {
    // Just above the opening (lintel) and just beside it must be solid.
    const lintel = { x: -4.1, y: 2.3, z: 0 };
    const beside = { x: -4.1, y: 1.0, z: 0.6 };
    for (const p of [lintel, beside]) {
      expect(ROOM.boxes.some((b) => b.kind === 'wall' && boxDistance(b, p) === 0), JSON.stringify(p)).toBe(true);
    }
  });

  it('has unique box ids', () => {
    const ids = ROOM.boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts every knock anchor within 0.3 m of a wall', () => {
    expect(ROOM.knockAnchors.length).toBe(5);
    for (const anchor of ROOM.knockAnchors) {
      const nearest = Math.min(...ROOM.boxes.filter((b) => b.kind === 'wall').map((b) => boxDistance(b, anchor)));
      expect(nearest, JSON.stringify(anchor)).toBeLessThanOrEqual(0.3);
    }
  });

  it('lets a 0.3 m player stand in front of the fuse box', () => {
    const stand = { x: ROOM.fuseBox.x - 0.75, z: ROOM.fuseBox.z };
    expect(isInsideWalkable(ROOM, stand.x, stand.z)).toBe(true);
    expect(ROOM.boxes.filter((b) => solid(b) && coversXZ(b, stand.x, stand.z, 0.3)).map((b) => b.id)).toEqual([]);
  });
});

describe('isInsideWalkable', () => {
  it('accepts room and corridor floor, rejects outside', () => {
    expect(isInsideWalkable(ROOM, 0, 0)).toBe(true);
    expect(isInsideWalkable(ROOM, -6, 0)).toBe(true);
    expect(isInsideWalkable(ROOM, -6, 2)).toBe(false);
    expect(isInsideWalkable(ROOM, 5, 0)).toBe(false);
  });
});
