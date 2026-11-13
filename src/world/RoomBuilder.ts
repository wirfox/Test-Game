import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { BoxKind, RoomDef } from './roomDefinition';

const SURFACE: Record<Exclude<BoxKind, 'prop'>, { color: number; roughness: number }> = {
  wall: { color: 0x8a8272, roughness: 0.9 },
  floor: { color: 0x33261c, roughness: 0.8 },
  ceiling: { color: 0x6f6a60, roughness: 0.95 },
};

/** Builds one mesh and one fixed collider per box of the room definition. */
export function buildRoom(room: RoomDef, scene: THREE.Scene, physics: PhysicsWorld): { dispose(): void } {
  const group = new THREE.Group();
  group.name = 'room';
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  const materialFor = (kind: BoxKind, color?: number): THREE.MeshStandardMaterial => {
    const surface = kind === 'prop' ? { color: color ?? 0x3a2f2a, roughness: 0.7 } : SURFACE[kind];
    const key = `${surface.color}:${surface.roughness}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: surface.color, roughness: surface.roughness, metalness: 0 });
      materials.set(key, material);
    }
    return material;
  };

  for (const box of room.boxes) {
    const mesh = new THREE.Mesh(unitBox, materialFor(box.kind, box.color));
    mesh.name = box.id;
    mesh.position.set(box.center.x, box.center.y, box.center.z);
    mesh.scale.set(box.size.x, box.size.y, box.size.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    physics.addFixedBox(box);
  }

  scene.add(group);
  return {
    dispose() {
      scene.remove(group);
      unitBox.dispose();
      for (const material of materials.values()) material.dispose();
    },
  };
}
