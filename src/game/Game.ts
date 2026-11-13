import * as THREE from 'three';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Screens } from '../ui/screens';
import { createSeededRandom } from '../utils/random';
import type { GameDiagnostics, GameState, TestState } from './diagnostics';

const SIM_DT = 1 / 60;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(65, 1, 0.05, 60);
  private readonly loop = new Loop(
    (delta) => this.update(delta),
    () => this.render(),
  );
  private readonly screens: Screens;
  private readonly debugTools: DebugTools;
  private readonly tuning: DebugTuning = { exposure: 1.0, maxDpr: 2 };

  private state: GameState = 'title';
  private frame = 0;
  private elapsed = 0;
  // Route ALL gameplay randomness through this.rng (never Math.random).
  private rng = createSeededRandom(1);
  private pausedForScreenshot = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    // Temporary pause key; pointer-lock loss takes over in task 4.
    if (event.code === 'Escape' && this.state === 'playing') this.setState('paused');
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;
    this.scene.background = new THREE.Color(0x000000);

    const host = canvas.parentElement ?? document.body;
    this.screens = new Screens(host, () => this.setState('playing'));
    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
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
    this.debugTools.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private setState(next: GameState): void {
    if (next === this.state) return;
    this.state = next;
    this.screens.show(next);
  }

  private update(delta: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    if (this.state === 'playing' && !this.pausedForScreenshot) this.simulate(delta);
    this.publishDiagnostics();
  }

  /** One simulation step. Task 2 moves this behind a fixed timestep. */
  private simulate(dt: number): void {
    this.elapsed += dt;
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
        const steps = Math.round(seconds / SIM_DT);
        for (let i = 0; i < steps; i += 1) this.simulate(SIM_DT);
        this.publishDiagnostics();
      },
      look: () => {
        throw new Error('look() needs the player (task 4).');
      },
      teleport: () => {
        throw new Error('teleport() needs the player (task 4).');
      },
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    const diagnostics: GameDiagnostics = {
      frame: this.frame,
      elapsed: this.elapsed,
      state: this.state,
      player: { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0, grounded: false },
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
