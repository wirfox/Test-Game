import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export const FLASHLIGHT = {
  color: 0xfff1d6,
  intensity: 40,
  angle: 0.45,
  penumbra: 0.5,
  distance: 18,
  decay: 2,
  shadowMapSize: 1024,
  /** How fast the beam catches up with the view (1/s). Lower feels heavier. */
  followRate: 14,
  /** Faint fill light standing in for light bouncing off nearby surfaces. */
  bounceIntensity: 0.12,
  bounceDistance: 4,
};

// Held at the right hip rather than at the eye, so shadows are visible to the player.
const HAND_OFFSET = new THREE.Vector3(0.16, -0.14, -0.05);
const FLICKER_RATE = 30;

/** Deterministic on/off-style flicker in [0, 1]: mostly full or nearly dark, changing 30 times a second. */
export function flickerFactor(elapsed: number): number {
  const slot = Math.floor(elapsed * FLICKER_RATE);
  const hash = Math.abs(Math.sin(slot * 127.1 + 311.7) * 43758.5453) % 1;
  return hash > 0.5 ? 1 : hash * 0.2;
}

export class Flashlight {
  private readonly light: THREE.SpotLight;
  private readonly bounce: THREE.PointLight;
  private readonly aim = new THREE.Quaternion();
  private readonly offset = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private switchedOn = true;
  private now = 0;
  private flickerUntil = -1;
  private killedUntil = -1;
  private aimInitialized = false;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly scene: THREE.Scene,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.light = new THREE.SpotLight(
      FLASHLIGHT.color,
      FLASHLIGHT.intensity,
      FLASHLIGHT.distance,
      FLASHLIGHT.angle,
      FLASHLIGHT.penumbra,
      FLASHLIGHT.decay,
    );
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(FLASHLIGHT.shadowMapSize, FLASHLIGHT.shadowMapSize);
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.camera.far = FLASHLIGHT.distance;
    this.light.shadow.bias = -0.0008;
    this.light.shadow.normalBias = 0.02;
    this.bounce = new THREE.PointLight(FLASHLIGHT.color, FLASHLIGHT.bounceIntensity, FLASHLIGHT.bounceDistance, 2);
    scene.add(this.light, this.light.target, this.bounce);
  }

  /** True when the beam is meant to be lit: switched on and not forced off by the haunt. */
  get on(): boolean {
    return this.switchedOn && this.now >= this.killedUntil;
  }

  get flickering(): boolean {
    return this.on && this.now < this.flickerUntil;
  }

  toggle(): void {
    this.switchedOn = !this.switchedOn;
    this.bus.emit('player:flashlightToggled', { on: this.switchedOn });
  }

  /** Unstable beam for `duration` simulated seconds. */
  flicker(duration: number): void {
    this.flickerUntil = Math.max(this.flickerUntil, this.now + duration);
  }

  /** Forces the beam off for `duration` simulated seconds, whatever the switch says. */
  kill(duration: number): void {
    this.killedUntil = Math.max(this.killedUntil, this.now + duration);
  }

  /** dt is real frame time (for the smooth follow); elapsed is simulated time (for effects). */
  update(dt: number, elapsed: number): void {
    this.now = elapsed;
    if (!this.aimInitialized) {
      this.aim.copy(this.camera.quaternion);
      this.aimInitialized = true;
    } else {
      this.aim.slerp(this.camera.quaternion, 1 - Math.exp(-FLASHLIGHT.followRate * dt));
    }

    this.offset.copy(HAND_OFFSET).applyQuaternion(this.camera.quaternion);
    this.light.position.copy(this.camera.position).add(this.offset);
    this.forward.set(0, 0, -1).applyQuaternion(this.aim);
    this.light.target.position.copy(this.light.position).add(this.forward);
    this.bounce.position.copy(this.camera.position).addScaledVector(this.forward, 0.6);

    const level = this.on ? (this.flickering ? flickerFactor(elapsed) : 1) : 0;
    this.light.intensity = FLASHLIGHT.intensity * level;
    this.bounce.intensity = FLASHLIGHT.bounceIntensity * level;
  }

  /** Snaps the beam onto the view, e.g. after a teleport. */
  snap(): void {
    this.aimInitialized = false;
  }

  dispose(): void {
    this.scene.remove(this.light, this.light.target, this.bounce);
    this.light.dispose();
    this.bounce.dispose();
  }
}
