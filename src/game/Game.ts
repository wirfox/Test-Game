import * as THREE from 'three';
import { bindAudio } from '../audio/audioBindings';
import { AudioEngine } from '../audio/AudioEngine';
import { EventBus } from '../core/EventBus';
import type { GameEvents, Vec3 } from '../core/events';
import { FIXED_DT, FixedStep } from '../core/FixedStep';
import { Apparition } from '../haunt/Apparition';
import { CeilingLamp } from '../haunt/CeilingLamp';
import { HauntDirector } from '../haunt/HauntDirector';
import { HauntPresenter } from '../haunt/HauntPresenter';
import { InputController, type InputIntent } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Flashlight } from '../player/Flashlight';
import { Interaction } from '../player/Interaction';
import { PlayerController } from '../player/PlayerController';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../ui/Hud';
import { detectMovementKeyLabels } from '../ui/keyLabels';
import { Screens } from '../ui/screens';
import { createSeededRandom } from '../utils/random';
import { FuseBox } from '../world/FuseBox';
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
  private readonly flashlight: Flashlight;
  private readonly fuseBox: FuseBox;
  private readonly interaction: Interaction;
  private readonly audio = new AudioEngine();
  private readonly unbindAudio: () => void;
  private readonly director: HauntDirector;
  private readonly apparition: Apparition;
  private readonly lamp: CeilingLamp;
  private readonly presenter: HauntPresenter;
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

    this.flashlight = new Flashlight(this.camera, this.scene, this.bus);
    this.fuseBox = new FuseBox(this.scene, ROOM.fuseBox, this.bus);
    this.interaction = new Interaction([this.fuseBox.interactable], (from, to) => this.hasLineOfSight(from, to));
    this.flashlight.update(0, 0);
    // Sound variation has its own generator so it can never disturb gameplay randomness.
    this.unbindAudio = bindAudio(this.bus, this.audio, createSeededRandom(99));

    // The director draws from this.rng through a closure so the seed() test hook still applies.
    this.director = new HauntDirector(ROOM, this.bus, () => this.rng());
    this.apparition = new Apparition(this.scene);
    this.lamp = new CeilingLamp(this.scene, { x: 0, y: 2.55, z: 0 });
    this.presenter = new HauntPresenter(this.bus, {
      flashlight: this.flashlight,
      apparition: this.apparition,
      lamp: this.lamp,
    });
    this.bus.on('interact:fuseBox', () => this.director.triggerFinale());

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
    this.presenter.dispose();
    this.apparition.dispose();
    this.lamp.dispose();
    this.unbindAudio();
    this.audio.dispose();
    this.flashlight.dispose();
    this.fuseBox.dispose();
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
    if (next !== 'playing') this.hud.showPrompt(null);
    // Called synchronously from the click, which is what lets the browser start audio.
    if (next === 'playing') void this.audio.resume().then(() => this.audio.startAmbience());
    if (next === 'paused') this.audio.suspend();
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
    this.handleInput(intent);
    this.player.interpolate(this.fixedStep.advance(delta));
    this.flashlight.update(delta, this.elapsed);
    this.presentHaunt(delta);
    this.audio.setListener(this.player.eyePosition, this.player.yaw);
  }

  /** Haunt visuals for this frame, plus the camera jolt layered on top of the player's view. */
  private presentHaunt(delta: number): void {
    this.presenter.update(delta, this.player.eyePosition);
    const shake = this.presenter.cameraShake();
    this.camera.rotation.x += shake.pitch;
    this.camera.rotation.z = shake.roll;
  }

  /** Per-frame input: looking, one-shot key presses, and the interaction prompt. */
  private handleInput(intent: InputIntent): void {
    this.intent = intent;
    this.player.applyLook(intent.lookDX, intent.lookDY);
    if (intent.flashlightPressed) this.flashlight.toggle();
    const focused = this.interaction.update(
      this.player.eyePosition,
      this.player.yaw,
      this.player.pitch,
      intent.interactPressed,
    );
    // Activating can disable the target, so ask again before showing its prompt.
    this.hud.showPrompt(focused?.enabled() ? focused.prompt : null);
  }

  /** True when no level geometry stands between the two points. */
  private hasLineOfSight(from: Vec3, to: Vec3): boolean {
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const distance = Math.hypot(dir.x, dir.y, dir.z);
    const hit = this.physics.castRay(from, dir, distance);
    return !hit || hit.distance >= distance - 0.06;
  }

  /** One fixed 60 Hz simulation step. */
  private simulate(dt: number): void {
    this.elapsed += dt;
    this.player.fixedUpdate(this.intent, dt);
    this.physics.step(dt);
    this.flashlight.setTime(this.elapsed);
    this.director.update({
      dt,
      player: this.player.eyePosition,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      flashlightOn: this.flashlight.on,
      hasLineOfSight: (from, to) => this.hasLineOfSight(from, to),
    });
    if (this.director.phase === 'done' && this.state === 'playing') this.setState('ended');
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
        } else if (name === 'finale') {
          // Standing at the fuse box with power just restored.
          this.setState('playing');
          this.player.teleport(ROOM.fuseBox.x - 0.75, ROOM.fuseBox.z, 0);
          this.flashlight.snap();
          this.fuseBox.interactable.activate();
          this.director.triggerFinale();
        } else {
          throw new Error(`Unknown test state: ${name}`);
        }
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled) => this.presenter.setReducedMotion(enabled),
      hideDebugUi: (hidden) => this.debugTools.setHidden(hidden),
      advance: (seconds) => {
        this.handleInput(this.input.consume());
        this.fixedStep.runExactly(seconds);
        this.player.interpolate(1);
        this.flashlight.update(seconds, this.elapsed);
        this.presentHaunt(seconds);
        this.publishDiagnostics();
      },
      look: (dxPx, dyPx) => {
        this.player.applyLook(dxPx, dyPx);
        this.publishDiagnostics();
      },
      teleport: (x, z, yaw) => {
        this.player.teleport(x, z, yaw);
        this.flashlight.snap();
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
      flashlight: { on: this.flashlight.on, flickering: this.flashlight.flickering },
      objective: { powerOn: this.fuseBox.powerOn },
      haunt: {
        phase: this.director.phase,
        counts: { ...this.director.counts },
        apparitionVisible: this.director.apparitionVisible,
      },
      audio: { contextState: this.audio.contextState, played: { ...this.audio.played } },
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
