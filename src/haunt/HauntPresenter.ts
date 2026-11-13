import type { EventBus } from '../core/EventBus';
import type { GameEvents, Vec3 } from '../core/events';
import { HAUNT } from './HauntDirector';

/** The things the haunting can act on. Interfaces, so the presenter is testable without WebGL. */
export interface HauntStage {
  flashlight: { flicker(duration: number): void; kill(duration: number): void };
  apparition: {
    show(position: Vec3): void;
    lungeToward(target: Vec3, distance: number, duration: number): void;
    hide(): void;
    update(dt: number, lookAt: Vec3): void;
  };
  lamp: { surge(duration: number): void; burst(): void; update(dt: number): void };
}

const SHAKE_DURATION = 0.25;
const SHAKE_AMPLITUDE = 0.035; // radians

/** Turns the director's decisions into light and motion. Holds no game rules. */
export class HauntPresenter {
  private readonly offs: Array<() => void>;
  private shakeTime = Infinity;
  private reducedMotion = false;

  constructor(bus: EventBus<GameEvents>, private readonly stage: HauntStage) {
    this.offs = [
      bus.on('haunt:flicker', ({ duration }) => stage.flashlight.flicker(duration)),
      bus.on('haunt:powerSurge', () => stage.lamp.surge(HAUNT.surgeDuration)),
      bus.on('haunt:blackout', ({ duration }) => {
        stage.lamp.burst();
        stage.flashlight.kill(duration);
      }),
      bus.on('haunt:apparitionShown', ({ position }) => stage.apparition.show(position)),
      bus.on('haunt:apparitionLunge', ({ toward }) => {
        stage.apparition.lungeToward(toward, HAUNT.lungeDistance, HAUNT.lungeDuration);
        this.shakeTime = 0;
      }),
      bus.on('haunt:apparitionVanished', () => stage.apparition.hide()),
    ];
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  update(dt: number, playerEye: Vec3): void {
    this.shakeTime += dt;
    this.stage.lamp.update(dt);
    this.stage.apparition.update(dt, playerEye);
  }

  /** Small camera jolt to add on top of the player's view while the scare lands. */
  cameraShake(): { pitch: number; roll: number } {
    if (this.reducedMotion || this.shakeTime >= SHAKE_DURATION) return { pitch: 0, roll: 0 };
    const strength = SHAKE_AMPLITUDE * (1 - this.shakeTime / SHAKE_DURATION);
    return {
      pitch: strength * Math.sin(this.shakeTime * 90),
      roll: strength * Math.sin(this.shakeTime * 71 + 1.3),
    };
  }

  dispose(): void {
    this.offs.forEach((off) => off());
  }
}
