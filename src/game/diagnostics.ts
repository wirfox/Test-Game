export type GameState = 'title' | 'playing' | 'paused' | 'ended';
export type HauntPhase = 'calm' | 'unease' | 'finale' | 'done';
export type TestState = 'title' | 'playing' | 'finale';

export interface Vec3Snapshot {
  x: number;
  y: number;
  z: number;
}

/** Published every frame on window.__THREE_GAME_DIAGNOSTICS__ for tests and debugging. */
export interface GameDiagnostics {
  frame: number;
  /** Simulated seconds spent in the 'playing' state. */
  elapsed: number;
  state: GameState;
  player: { position: Vec3Snapshot; yaw: number; pitch: number; speed: number; grounded: boolean };
  flashlight: { on: boolean; flickering: boolean };
  objective: { powerOn: boolean };
  haunt: { phase: HauntPhase; counts: Record<string, number>; apparitionVisible: boolean };
  audio: { contextState: string; played: Record<string, number> };
  renderer: { calls: number; triangles: number; geometries: number; textures: number };
  canvas: { clientWidth: number; clientHeight: number; width: number; height: number; dpr: number };
}

/** Exposed on window.__THREE_GAME_TEST_HOOKS__; every hook does real work or throws. */
export interface GameTestHooks {
  seed(value: number): void;
  setState(name: TestState): { state: TestState };
  setPausedForScreenshot(paused: boolean): void;
  setReducedMotion(enabled: boolean): void;
  hideDebugUi(hidden: boolean): void;
  /** Runs simulation steps synchronously. */
  advance(seconds: number): void;
  look(dxPx: number, dyPx: number): void;
  teleport(x: number, z: number, yaw: number): void;
  /** Feeds one real frame of the given length through the normal update path. */
  simulateFrame(deltaSeconds: number): void;
}
