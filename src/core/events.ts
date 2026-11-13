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
  'haunt:apparitionShown': { position: Vec3 };
  'haunt:apparitionVanished': Record<string, never>;
}
