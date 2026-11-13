import type { Vec3 } from '../core/events';
import { createSeededRandom } from '../utils/random';
import { dbToGain, sliderToGain } from './mix';
import { SOUND_IDS, renderSound, type SoundId } from './synth';

/** Resting level of the ambience bus. */
export const AMBIENCE_DB = -24;

/** Default level of each one-shot, in decibels. */
const SOUND_DB: Record<Exclude<SoundId, 'ambience'>, number> = {
  footstep: -14,
  knock: -6,
  flickerBuzz: -18,
  powerSurge: -8,
  sting: -4,
};

export interface PlayOptions {
  /** World position; when given the sound is placed in 3D (headphones recommended). */
  position?: Vec3;
  gainDb?: number;
  /** Playback speed; 1.1 is 10 % faster and higher. */
  rate?: number;
}

/**
 * Web Audio output. Signal path: source -> (3D panner) -> SFX or ambience bus -> master -> limiter.
 * Nothing exists before resume(), which must be called from a click: browsers block audio until then.
 */
export class AudioEngine {
  readonly played: Record<string, number> = {};
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private masterSlider = 1;

  get contextState(): string {
    return this.context?.state ?? 'none';
  }

  async resume(): Promise<void> {
    if (!this.context) this.build();
    try {
      await this.context?.resume();
    } catch {
      // Autoplay still blocked: the game stays silent until a later click.
    }
  }

  suspend(): void {
    void this.context?.suspend().catch(() => undefined);
  }

  setListener(position: Vec3, yaw: number): void {
    const listener = this.context?.listener;
    if (!listener) return;
    const fx = Math.cos(yaw);
    const fz = Math.sin(yaw);
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = fx;
      listener.forwardY.value = 0;
      listener.forwardZ.value = fz;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  play(id: Exclude<SoundId, 'ambience'>, opts: PlayOptions = {}): void {
    const context = this.context;
    const buffer = this.buffers.get(id);
    if (!context || !this.sfxBus || !buffer || context.state !== 'running') return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = opts.rate ?? 1;
    const gain = context.createGain();
    gain.gain.value = dbToGain(opts.gainDb ?? SOUND_DB[id]);
    source.connect(gain);

    if (opts.position) {
      const panner = context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.rolloffFactor = 1.5;
      panner.positionX.value = opts.position.x;
      panner.positionY.value = opts.position.y;
      panner.positionZ.value = opts.position.z;
      gain.connect(panner).connect(this.sfxBus);
    } else {
      gain.connect(this.sfxBus);
    }
    source.start();
    this.played[id] = (this.played[id] ?? 0) + 1;
  }

  startAmbience(): void {
    const context = this.context;
    const buffer = this.buffers.get('ambience');
    if (!context || !this.ambienceBus || !buffer || this.ambienceSource) return;
    this.ambienceSource = context.createBufferSource();
    this.ambienceSource.buffer = buffer;
    this.ambienceSource.loop = true;
    this.ambienceSource.connect(this.ambienceBus);
    this.ambienceSource.start();
    this.played.ambience = 1;
  }

  /** Glides the ambience bus to a new level over `seconds`. */
  duckAmbience(toDb: number, seconds: number): void {
    if (!this.context || !this.ambienceBus) return;
    const now = this.context.currentTime;
    const gain = this.ambienceBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(dbToGain(toDb), now + Math.max(seconds, 0.01));
  }

  setMasterVolume(slider01: number): void {
    this.masterSlider = slider01;
    if (this.master) this.master.gain.value = sliderToGain(slider01);
  }

  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private build(): void {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    this.context = context;

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    limiter.connect(context.destination);

    this.master = context.createGain();
    this.master.gain.value = sliderToGain(this.masterSlider);
    this.master.connect(limiter);
    this.sfxBus = context.createGain();
    this.sfxBus.connect(this.master);
    this.ambienceBus = context.createGain();
    this.ambienceBus.gain.value = dbToGain(AMBIENCE_DB);
    this.ambienceBus.connect(this.master);

    // Fixed seed: the sounds are the same every session.
    const rng = createSeededRandom(20261113);
    for (const id of SOUND_IDS) {
      const samples = renderSound(id, context.sampleRate, rng);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(id, buffer);
    }
  }
}
