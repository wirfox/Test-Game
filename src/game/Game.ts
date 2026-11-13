import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { FIXED_DT, FixedStep } from '../core/FixedStep';
import { InputController, type InputIntent } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../ui/Hud';
import { detectMovementKeyLabels } from '../ui/keyLabels';
import { Screens } from '../ui/screens';
import { createSeededRandom } from '../utils/random';
import { DARKNESS, setupLighting } from '../world/lighting';
import { buildRoom } from '../world/RoomBuilder';
import { ROOM } from '../world/roomDefinition';
import type { GameDiagnostics, GameState, TestState } from './diagnostics';

const IDLE_INTENT: InputIntent = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  lookDX: 0,
  lookDY: 0,
  interactPressed: false,
  flashlightPressed: false,
};

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.05, 60);
  readonly bus = new EventBus<GameEvents>();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly loop = new Loop(
    (delta) => this.update(delta),
    () => this.render(),
  );
  private readonly fixedStep = new FixedStep((dt) => this.simulate(dt));
  private readonly input: InputController;
  private readonly player: PlayerController;
  private readonly screens: Screens;
  private readonly hud: Hud;
  private readonly debugTools: DebugTools;
  private readonly tuning: DebugTuning = {
    exposure: 1.0,
    maxDpr: 2,
    ambient: DARKNESS.ambientIntensity,
    fogDensity: DARKNESS.fogDensity,
  };
  private readonly room: { dispose(): void };
  private readonly lights: ReturnType<typeof setupLighting>;

  private state: GameState = 'title';
  private frame = 0;
  private elapsed = 0;
  private intent: InputIntent = IDLE_INTENT;
  private helpShown = false;
  // Route ALL gameplay randomness through this.rng (never Math.random).
  private rng = createSeededRandom(1);
  private pausedForScreenshot = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    // With the pointer locked the browser handles Escape itself and we get onLockLost instead.
    if (event.code === 'Escape' && this.state === 'playing') this.setState('paused');
  };

  /** Physics needs an async WebAssembly init, so the game is built through this factory. */
  static async create(canvas: HTMLCanvasElement): Promise<Game> {
    return new Game(canvas, await PhysicsWorld.create());
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly physics: PhysicsWorld,
  ) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;
    this.lights = setupLighting(this.scene);
    this.room = buildRoom(ROOM, this.scene, this.physics);
    // One step so the room colliders are visible to queries before the player first moves.
    this.physics.step(FIXED_DT);

    this.input = new InputController(canvas);
    this.input.onLockLost(() => {
      if (this.state === 'playing') this.setState('paused');
    });
    this.player = new PlayerController(this.physics, this.camera, this.bus);
    this.player.teleport(ROOM.spawn.position.x, ROOM.spawn.position.z, ROOM.spawn.yaw);

    const host = canvas.parentElement ?? document.body;
    this.hud = new Hud(host);
    this.screens = new Screens(host, (state) => void this.onScreenClicked(state));
    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      this.lights.ambient.intensity = this.tuning.ambient;
      this.lights.fog.density = this.tuning.fogDensity;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });

    window.addEventListener('keydown', this.onKeyDown);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.screens.show(this.state);
    this.installTestHooks();
    this.publishDiagnostics();
  }

  /** Seeded gameplay randomness; every system must draw from here. */
  random(): number {
    return this.rng();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener('keydown', this.onKeyDown);
    this.input.dispose();
    this.hud.dispose();
    this.debugTools.dispose();
    this.player.dispose();
    this.room.dispose();
    this.physics.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private async onScreenClicked(state: GameState): Promise<void> {
    if (state === 'title') {
      // Start right away: playing must not depend on the browser granting the mouse lock.
      this.setState('playing');
      void this.input.requestLock();
      return;
    }
    if (state === 'paused') {
      const locked = await this.input.requestLock();
      // Browsers refuse to re-lock for about a second after Escape. Where locking works,
      // stay paused until it succeeds, otherwise the player would resume without mouse look.
      if (locked || !this.input.everLocked) this.setState('playing');
    }
  }

  private setState(next: GameState): void {
    if (next === this.state) return;
    const from = this.state;
    this.state = next;
    this.input.releaseAll();
    this.intent = IDLE_INTENT;
    this.screens.show(next);
    // Menus need the cursor: a locked pointer would send their clicks to the canvas.
    if (next !== 'playing') this.input.releaseLock();
    if (next === 'playing' && !this.helpShown) {
      this.helpShown = true;
      void detectMovementKeyLabels().then((keys) =>
        this.hud.showHelp(`${keys} se déplacer · Maj courir · F lampe · E interagir`, 8),
      );
    }
    this.bus.emit('game:stateChanged', { from, to: next });
  }

  private update(delta: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.runFrame(delta);
    this.publishDiagnostics();
  }

  /** One rendered frame of game logic: read input, look, then as many fixed steps as are due. */
  private runFrame(delta: number): void {
    const intent = this.input.consume();
    if (this.state !== 'playing' || this.pausedForScreenshot) return;
    this.intent = intent;
    this.player.applyLook(intent.lookDX, intent.lookDY);
    this.player.interpolate(this.fixedStep.advance(delta));
  }

  /** One fixed 60 Hz simulation step. */
  private simulate(dt: number): void {
    this.elapsed += dt;
    this.player.fixedUpdate(this.intent, dt);
    this.physics.step(dt);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value) => {
        this.rng = createSeededRandom(value);
      },
      setState: (name: TestState) => {
        if (name === 'title' || name === 'playing') {
          this.elapsed = 0;
          this.player.teleport(ROOM.spawn.position.x, ROOM.spawn.position.z, ROOM.spawn.yaw);
          this.setState(name);
        } else {
          throw new Error(`Test state not available yet: ${name}`);
        }
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: () => {
        // Nothing animates on its own yet; the haunt presenter honors this in task 7.
      },
      hideDebugUi: (hidden) => this.debugTools.setHidden(hidden),
      advance: (seconds) => {
        this.intent = this.input.consume();
        this.player.applyLook(this.intent.lookDX, this.intent.lookDY);
        this.fixedStep.runExactly(seconds);
        this.player.interpolate(1);
        this.publishDiagnostics();
      },
      look: (dxPx, dyPx) => {
        this.player.applyLook(dxPx, dyPx);
        this.publishDiagnostics();
      },
      teleport: (x, z, yaw) => {
        this.player.teleport(x, z, yaw);
        this.publishDiagnostics();
      },
      simulateFrame: (deltaSeconds) => {
        this.runFrame(deltaSeconds);
        this.publishDiagnostics();
      },
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    const diagnostics: GameDiagnostics = {
      frame: this.frame,
      elapsed: this.elapsed,
      state: this.state,
      player: {
        position: this.player.position,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        speed: this.player.speed,
        grounded: this.player.grounded,
      },
      flashlight: { on: false, flickering: false },
      objective: { powerOn: false },
      haunt: { phase: 'calm', counts: {}, apparitionVisible: false },
      audio: { contextState: 'none', played: {} },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr),
      },
    };
    window.__THREE_GAME_DIAGNOSTICS__ = diagnostics;
  }
}
