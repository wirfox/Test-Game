import * as THREE from 'three';
import type { Vec3 } from '../core/events';

/**
 * Placeholder ghost built from primitives: a tall, narrow silhouette with arms that
 * hang too low and a tilted head. It stands perfectly still and always faces the player.
 * A Blender model replaces the meshes later; the methods stay the same.
 */
export class Apparition {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1, metalness: 0 });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private lunge: { from: THREE.Vector3; to: THREE.Vector3; duration: number; time: number } | null = null;

  constructor(private readonly scene: THREE.Scene) {
    const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, rollZ = 0, scale?: Vec3) => {
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rollZ;
      if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
      mesh.castShadow = true;
      this.geometries.push(geometry);
      this.group.add(mesh);
      return mesh;
    };
    // Local +x is the facing direction.
    add(new THREE.CylinderGeometry(0.15, 0.08, 1.5, 10), 0, 0.75, 0); // body, tapering to nothing
    add(new THREE.SphereGeometry(0.17, 10, 8), 0, 1.5, 0, 0, { x: 0.8, y: 0.55, z: 1.35 }); // shoulders
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 8), 0.02, 1.62, 0); // neck
    add(new THREE.SphereGeometry(0.12, 12, 10), 0.05, 1.8, 0.03, 0.3, { x: 0.9, y: 1.2, z: 0.85 }); // head, tilted
    add(new THREE.CylinderGeometry(0.035, 0.018, 1.2, 6), 0.03, 0.93, 0.24, 0); // arms reach the knees
    add(new THREE.CylinderGeometry(0.035, 0.018, 1.2, 6), 0.03, 0.93, -0.24, 0);
    this.group.name = 'apparition';
    this.group.visible = false;
    scene.add(this.group);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  show(position: Vec3): void {
    this.lunge = null;
    this.group.position.set(position.x, position.y, position.z);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
  }

  /** Rushes `distance` metres toward the target over `duration` seconds. */
  lungeToward(target: Vec3, distance: number, duration: number): void {
    const from = this.group.position.clone();
    const direction = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
    if (direction.lengthSq() > 0) direction.normalize();
    this.lunge = { from, to: from.clone().addScaledVector(direction, distance), duration, time: 0 };
  }

  hide(): void {
    this.lunge = null;
    this.group.visible = false;
  }

  update(dt: number, lookAt: Vec3): void {
    if (!this.group.visible) return;
    if (this.lunge) {
      this.lunge.time = Math.min(this.lunge.time + dt, this.lunge.duration);
      const k = this.lunge.time / this.lunge.duration;
      this.group.position.lerpVectors(this.lunge.from, this.lunge.to, k * k); // accelerating
      this.group.rotation.z = -0.35 * k; // leans into the rush
    }
    // Always squarely facing the player. rotation.y = -angle turns local +x toward the target.
    const dx = lookAt.x - this.group.position.x;
    const dz = lookAt.z - this.group.position.z;
    if (dx !== 0 || dz !== 0) this.group.rotation.y = -Math.atan2(dz, dx);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.geometries.forEach((geometry) => geometry.dispose());
    this.material.dispose();
  }
}
