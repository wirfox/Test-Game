import type { GameState } from '../game/diagnostics';

export type Vec3 = { x: number; y: number; z: number };

/** Every event that can cross a module boundary. Presenters react to these. */
export interface GameEvents {
  'game:stateChanged': { from: GameState; to: GameState };
  'player:footstep': { position: Vec3; sprinting: boolean };
  'player:flashlightToggled': { on: boolean };
  'interact:fuseBox': Record<string, never>;
  'haunt:knock': { position: Vec3 };
  'haunt:flicker': { duration: number };
  'haunt:powerSurge': Record<string, never>;
  /** The ceiling lamp bursts; the flashlight dies for `duration` seconds. */
  'haunt:blackout': { duration: number };
  'haunt:apparitionShown': { position: Vec3 };
  /** The apparition rushes at the player; `toward` is where the player stood. */
  'haunt:apparitionLunge': { toward: Vec3 };
  'haunt:apparitionVanished': Record<string, never>;
}
