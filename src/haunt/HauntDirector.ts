import type { EventBus } from '../core/EventBus';
import type { GameEvents, Vec3 } from '../core/events';
import type { HauntPhase } from '../game/diagnostics';
import type { RoomDef } from '../world/roomDefinition';

/** Every timing and distance of the haunting (seconds, metres, radians). Tune here. */
export const HAUNT = {
  /** Nothing happens at first: waiting is what builds the dread. */
  calmDuration: 40,
  knockInterval: [15, 25],
  flickerInterval: [30, 45],
  flickerDuration: 0.6,
  /** Knocks never come from closer than this... */
  knockMinDistance: 3,
  /** ...nor from inside this half-angle of the player's view (50 degrees). */
  viewHalfAngle: (50 * Math.PI) / 180,
  /** Wait before trying again when a knock or flicker cannot happen right now. */
  retryDelay: 2,
  /** The ceiling lamp glows for this long once power is restored (false relief). */
  surgeDuration: 1.5,
  /** Then everything goes dark, flashlight included, for this long. */
  surgeBlackout: 2.0,
  /** Looking within 12 degrees of the apparition counts as seeing it. */
  apparitionTriggerAngle: 0.21,
  apparitionGazeTime: 0.4,
  apparitionTriggerDistance: 2.5,
  /** If the player hides and never looks, it comes anyway. */
  apparitionPatience: 25,
  apparitionChestHeight: 1.5,
  lungeDistance: 1.0,
  lungeDuration: 0.18,
  endDelay: 3.0,
} as const;

/** What the director perceives each step. It never queries the world itself. */
export interface HauntInput {
  dt: number;
  /** Player eye position. */
  player: Vec3;
  yaw: number;
  pitch: number;
  flashlightOn: boolean;
  hasLineOfSight: (from: Vec3, to: Vec3) => boolean;
}

type FinaleStep = 'surge' | 'blackout' | 'waiting' | 'lunging' | 'vanished';
type HauntEventName = Extract<keyof GameEvents, `haunt:${string}`>;

/**
 * Decides what the haunting does and when. Pure logic: no rendering, no physics, no audio.
 * It only emits events; presenters turn them into light, sound and motion.
 *
 * calm -> unease (knocks, flickers) -> finale (surge, blackout, apparition) -> done
 */
export class HauntDirector {
  readonly counts: Record<string, number> = {};
  private phaseValue: HauntPhase = 'calm';
  private time = 0;
  private nextKnock = Infinity;
  private nextFlicker = Infinity;
  private finaleStep: FinaleStep = 'surge';
  private stepTime = 0;
  private gaze = 0;

  constructor(
    private readonly room: RoomDef,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: () => number,
  ) {}

  get phase(): HauntPhase {
    return this.phaseValue;
  }

  get apparitionVisible(): boolean {
    return this.phaseValue === 'finale' && (this.finaleStep === 'waiting' || this.finaleStep === 'lunging');
  }

  /** Called when the player restores power. Safe to call more than once. */
  triggerFinale(): void {
    if (this.phaseValue !== 'calm' && this.phaseValue !== 'unease') return;
    this.phaseValue = 'finale';
    this.finaleStep = 'surge';
    this.stepTime = 0;
    this.emit('haunt:powerSurge', {});
  }

  update(input: HauntInput): void {
    this.time += input.dt;
    if (this.phaseValue === 'calm') {
      if (this.time >= HAUNT.calmDuration) {
        this.phaseValue = 'unease';
        this.nextKnock = this.time + this.between(HAUNT.knockInterval);
        this.nextFlicker = this.time + this.between(HAUNT.flickerInterval);
      }
    } else if (this.phaseValue === 'unease') {
      this.updateUnease(input);
    } else if (this.phaseValue === 'finale') {
      this.updateFinale(input);
    }
  }

  private updateUnease(input: HauntInput): void {
    if (this.time >= this.nextKnock) {
      const anchor = this.pickKnockAnchor(input);
      if (anchor) {
        this.emit('haunt:knock', { position: anchor });
        this.nextKnock = this.time + this.between(HAUNT.knockInterval);
      } else {
        this.nextKnock = this.time + HAUNT.retryDelay;
      }
    }
    if (this.time >= this.nextFlicker) {
      if (input.flashlightOn) {
        this.emit('haunt:flicker', { duration: HAUNT.flickerDuration });
        this.nextFlicker = this.time + this.between(HAUNT.flickerInterval);
      } else {
        this.nextFlicker = this.time + HAUNT.retryDelay;
      }
    }
  }

  /** Farthest anchor that is neither close to the player nor inside their view: always "behind you". */
  private pickKnockAnchor(input: HauntInput): Vec3 | null {
    let best: Vec3 | null = null;
    let bestDistance = 0;
    for (const anchor of this.room.knockAnchors) {
      const dx = anchor.x - input.player.x;
      const dz = anchor.z - input.player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < HAUNT.knockMinDistance || distance <= bestDistance) continue;
      const facing = (dx * Math.cos(input.yaw) + dz * Math.sin(input.yaw)) / distance;
      if (facing > Math.cos(HAUNT.viewHalfAngle)) continue;
      best = anchor;
      bestDistance = distance;
    }
    return best;
  }

  private updateFinale(input: HauntInput): void {
    this.stepTime += input.dt;
    const anchor = this.room.apparitionAnchor.position;
    switch (this.finaleStep) {
      case 'surge':
        if (this.stepTime >= HAUNT.surgeDuration) {
          this.emit('haunt:blackout', { duration: HAUNT.surgeBlackout });
          this.nextStep('blackout');
        }
        break;
      case 'blackout':
        if (this.stepTime >= HAUNT.surgeBlackout) {
          this.emit('haunt:apparitionShown', { position: anchor });
          this.gaze = 0;
          this.nextStep('waiting');
        }
        break;
      case 'waiting':
        if (this.seesApparition(input)) this.gaze += input.dt;
        if (
          this.gaze >= HAUNT.apparitionGazeTime ||
          Math.hypot(anchor.x - input.player.x, anchor.z - input.player.z) < HAUNT.apparitionTriggerDistance ||
          this.stepTime >= HAUNT.apparitionPatience
        ) {
          this.emit('haunt:apparitionLunge', { toward: input.player });
          this.nextStep('lunging');
        }
        break;
      case 'lunging':
        if (this.stepTime >= HAUNT.lungeDuration) {
          this.emit('haunt:apparitionVanished', {});
          this.nextStep('vanished');
        }
        break;
      case 'vanished':
        if (this.stepTime >= HAUNT.endDelay) this.phaseValue = 'done';
        break;
    }
  }

  /** Cheap checks first (light, angle), the line-of-sight query last. */
  private seesApparition(input: HauntInput): boolean {
    if (!input.flashlightOn) return false;
    const anchor = this.room.apparitionAnchor.position;
    const chest = { x: anchor.x, y: anchor.y + HAUNT.apparitionChestHeight, z: anchor.z };
    const dx = chest.x - input.player.x;
    const dy = chest.y - input.player.y;
    const dz = chest.z - input.player.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance === 0) return true;
    const fx = Math.cos(input.pitch) * Math.cos(input.yaw);
    const fy = Math.sin(input.pitch);
    const fz = Math.cos(input.pitch) * Math.sin(input.yaw);
    if ((dx * fx + dy * fy + dz * fz) / distance < Math.cos(HAUNT.apparitionTriggerAngle)) return false;
    return input.hasLineOfSight(input.player, chest);
  }

  private nextStep(step: FinaleStep): void {
    this.finaleStep = step;
    this.stepTime = 0;
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.rng() * (max - min);
  }

  private emit<K extends HauntEventName>(name: K, payload: GameEvents[K]): void {
    const key = name.slice('haunt:'.length);
    this.counts[key] = (this.counts[key] ?? 0) + 1;
    this.bus.emit(name, payload);
  }
}
