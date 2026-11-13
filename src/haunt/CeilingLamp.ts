import * as THREE from 'three';
import type { Vec3 } from '../core/events';

const PEAK_INTENSITY = 14;

/**
 * The room's ceiling lamp. Dead until power returns, then it glows brighter and brighter
 * (a moment of relief: the room is visible and empty) before it bursts.
 */
export class CeilingLamp {
  private readonly light: THREE.PointLight;
  private readonly bulb: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private surgeTime = 0;
  private surgeDuration = 0;
  private surging = false;

  constructor(private readonly scene: THREE.Scene, position: Vec3) {
    this.light = new THREE.PointLight(0xffd2a0, 0, 14, 2);
    this.light.position.set(position.x, position.y - 0.12, position.z);
    this.bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x15130f, emissive: 0xffd2a0, emissiveIntensity: 0 }),
    );
    this.bulb.position.set(position.x, position.y, position.z);
    scene.add(this.light, this.bulb);
  }

  get intensity(): number {
    return this.light.intensity;
  }

  surge(duration: number): void {
    this.surging = true;
    this.surgeTime = 0;
    this.surgeDuration = duration;
  }

  burst(): void {
    this.surging = false;
    this.apply(0);
  }

  update(dt: number): void {
    if (!this.surging) return;
    this.surgeTime = Math.min(this.surgeTime + dt, this.surgeDuration);
    const k = this.surgeTime / this.surgeDuration;
    // Unsteady climb: the filament struggles, then overloads.
    const wobble = 0.85 + 0.15 * Math.sin(this.surgeTime * 47) * Math.sin(this.surgeTime * 13);
    this.apply(k * k * wobble);
  }

  dispose(): void {
    this.scene.remove(this.light, this.bulb);
    this.bulb.geometry.dispose();
    this.bulb.material.dispose();
    this.light.dispose();
  }

  private apply(level: number): void {
    this.light.intensity = PEAK_INTENSITY * level;
    this.bulb.material.emissiveIntensity = 6 * level;
  }
}
