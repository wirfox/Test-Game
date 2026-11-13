import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, Vec3 } from '../core/events';
import { INTERACT_RANGE, type Interactable } from '../player/Interaction';

const RED = 0xff2010;
const GREEN = 0x30ff50;

/** Wall-mounted fuse box on the east wall. Restoring power is the prototype's objective. */
export class FuseBox {
  readonly interactable: Interactable;
  private readonly group = new THREE.Group();
  private readonly led: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly glow: THREE.PointLight;
  private power = false;

  constructor(
    private readonly scene: THREE.Scene,
    position: Vec3,
    bus: EventBus<GameEvents>,
  ) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.6, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x6b6f72, roughness: 0.45, metalness: 0.8 }),
    );
    body.castShadow = true;
    body.receiveShadow = true;

    this.led = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: RED, emissiveIntensity: 4 }),
    );
    this.led.position.set(-0.055, 0.2, 0.12);

    // The LED is the only light in the dark room: a faint beacon that draws the player in.
    this.glow = new THREE.PointLight(RED, 0.04, 2.5, 2);
    this.glow.position.set(-0.12, 0.2, 0.12);

    this.group.add(body, this.led, this.glow);
    this.group.position.set(position.x, position.y, position.z);
    this.group.name = 'fuse-box';
    scene.add(this.group);

    this.interactable = {
      id: 'fuse-box',
      position,
      range: INTERACT_RANGE,
      prompt: 'E — Rétablir le courant',
      enabled: () => !this.power,
      activate: () => {
        if (this.power) return;
        this.power = true;
        this.led.material.emissive.setHex(GREEN);
        this.glow.color.setHex(GREEN);
        bus.emit('interact:fuseBox', {});
      },
    };
  }

  get powerOn(): boolean {
    return this.power;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose();
    });
  }
}
