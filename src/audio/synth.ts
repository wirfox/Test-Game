/**
 * Every sound of the prototype, generated from maths: no audio files.
 * Pure functions: same sample rate and same random generator give the same samples.
 */

export const SOUND_IDS = ['ambience', 'footstep', 'knock', 'flickerBuzz', 'powerSurge', 'sting'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** Length of each sound in seconds. */
export const DURATION: Record<SoundId, number> = {
  ambience: 8,
  footstep: 0.09,
  knock: 0.6,
  flickerBuzz: 0.6,
  powerSurge: 1.9,
  sting: 1.2,
};

type Rng = () => number;
type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

const TAU = Math.PI * 2;
const noise = (rng: Rng) => rng() * 2 - 1;

/** Standard two-pole filter (RBJ cookbook), applied in place. */
function biquad(samples: Float32Array, sampleRate: number, kind: FilterKind, hz: number, q: number): void {
  const w = (TAU * hz) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number;
  let b1: number;
  let b2: number;
  if (kind === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (kind === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    samples[i] = y;
  }
}

function normalize(samples: Float32Array, targetPeak: number): Float32Array {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) max = Math.max(max, Math.abs(samples[i]));
  if (max > 0) {
    const scale = targetPeak / max;
    for (let i = 0; i < samples.length; i += 1) samples[i] *= scale;
  }
  return samples;
}

/** Short fades so a one-shot never starts or ends on a click. */
function fadeEdges(samples: Float32Array, sampleRate: number, inSeconds: number, outSeconds: number): Float32Array {
  const fadeIn = Math.min(samples.length, Math.round(inSeconds * sampleRate));
  const fadeOut = Math.min(samples.length, Math.round(outSeconds * sampleRate));
  for (let i = 0; i < fadeIn; i += 1) samples[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i += 1) samples[samples.length - 1 - i] *= i / fadeOut;
  return samples;
}

/** Deep, slowly breathing rumble that loops seamlessly. */
function ambience(sampleRate: number, rng: Rng): Float32Array {
  const length = Math.round(DURATION.ambience * sampleRate);
  const overlap = Math.round(0.5 * sampleRate);
  const raw = new Float32Array(length + overlap);
  let brown = 0;
  for (let i = 0; i < raw.length; i += 1) {
    brown = brown * 0.998 + noise(rng) * 0.05; // leaky integrator: brown noise without drift
    raw[i] = brown;
  }
  biquad(raw, sampleRate, 'lowpass', 180, 0.707);
  biquad(raw, sampleRate, 'lowpass', 180, 0.707);
  biquad(raw, sampleRate, 'highpass', 28, 0.707);

  // Crossfade the extra tail into the head so the end flows into the start.
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    if (i < overlap) {
      const t = i / overlap;
      out[i] = raw[i] * Math.sqrt(t) + raw[length + i] * Math.sqrt(1 - t);
    } else {
      out[i] = raw[i];
    }
    // One slow swell per loop, so the room seems to breathe.
    out[i] *= 0.75 + 0.25 * Math.sin((TAU * i) / length);
  }
  return normalize(out, 0.9);
}

/** Dull shoe-on-floor thud. */
function footstep(sampleRate: number, rng: Rng): Float32Array {
  const out = new Float32Array(Math.round(DURATION.footstep * sampleRate));
  for (let i = 0; i < out.length; i += 1) out[i] = noise(rng);
  biquad(out, sampleRate, 'bandpass', 520, 0.9);
  biquad(out, sampleRate, 'bandpass', 520, 0.9);
  for (let i = 0; i < out.length; i += 1) out[i] *= Math.exp(-i / sampleRate / 0.016);
  return fadeEdges(normalize(out, 0.9), sampleRate, 0.002, 0.01);
}

/** Three heavy knocks on a wall, as if from the other side. */
function knock(sampleRate: number, rng: Rng): Float32Array {
  const out = new Float32Array(Math.round(DURATION.knock * sampleRate));
  const starts = [0.02, 0.2, 0.38];
  for (const [index, start] of starts.entries()) {
    const strength = [1, 0.85, 0.95][index] * (0.95 + 0.05 * rng());
    let phase = 0;
    for (let i = Math.round(start * sampleRate); i < out.length; i += 1) {
      const t = i / sampleRate - start;
      const hz = 50 + 40 * Math.exp(-t / 0.03); // pitch drops from 90 to 50 Hz
      phase += (TAU * hz) / sampleRate;
      out[i] += Math.sin(phase) * Math.exp(-t / 0.04) * strength;
    }
  }
  return fadeEdges(normalize(out, 0.95), sampleRate, 0.002, 0.02);
}

/** Electrical buzz cutting in and out, for the failing flashlight. */
function flickerBuzz(sampleRate: number, rng: Rng): Float32Array {
  const length = Math.round(DURATION.flickerBuzz * sampleRate);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const square = Math.sin((TAU * 50 * i) / sampleRate) >= 0 ? 1 : -1;
    out[i] = square * 0.8 + noise(rng) * 0.2;
  }
  biquad(out, sampleRate, 'lowpass', 2400, 0.707);
  biquad(out, sampleRate, 'highpass', 90, 0.707);

  // Random on/off gate; every segment is long enough to be heard as a distinct cut.
  const gate = new Float32Array(length);
  let position = 0;
  let on = true;
  while (position < length) {
    const seconds = on ? 0.03 + rng() * 0.06 : 0.04 + rng() * 0.05;
    const end = Math.min(length, position + Math.round(seconds * sampleRate));
    if (on) gate.fill(1, position, end);
    position = end;
    on = !on;
  }
  const ramp = Math.round(0.0015 * sampleRate);
  let level = 0;
  for (let i = 0; i < length; i += 1) {
    level += Math.min(Math.max(gate[i] - level, -1 / ramp), 1 / ramp); // de-click the gate edges
    out[i] *= level;
  }
  return fadeEdges(normalize(out, 0.9), sampleRate, 0.002, 0.005);
}

/** Mains hum climbing for 1.5 s, then the breaker slams. */
function powerSurge(sampleRate: number, rng: Rng): Float32Array {
  const length = Math.round(DURATION.powerSurge * sampleRate);
  const out = new Float32Array(length);
  const slamAt = 1.5;
  const slam = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    if (t < slamAt) {
      const k = t / slamAt;
      phase += (TAU * (50 + 90 * k * k)) / sampleRate;
      const hum = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.3 * Math.sin(3 * phase) + 0.15 * Math.sin(5 * phase);
      out[i] = hum * 0.28 * k * k;
    } else {
      const d = t - slamAt;
      slam[i] = noise(rng) * Math.exp(-d / 0.05);
      out[i] = Math.sin(TAU * 55 * d) * Math.exp(-d / 0.09) * 0.9;
    }
  }
  biquad(slam, sampleRate, 'lowpass', 3500, 0.707);
  for (let i = 0; i < length; i += 1) out[i] += slam[i];
  return fadeEdges(normalize(out, 0.95), sampleRate, 0.005, 0.03);
}

/** The scare: a hiss rushing in, then a dissonant cluster of close notes. */
function sting(sampleRate: number, rng: Rng): Float32Array {
  const length = Math.round(DURATION.sting * sampleRate);
  const hitAt = 0.25;
  const hiss = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const env = t < hitAt ? (t / hitAt) ** 3 : Math.exp(-(t - hitAt) / 0.07);
    hiss[i] = noise(rng) * env;
  }
  biquad(hiss, sampleRate, 'highpass', 1500, 0.707);

  // Semitone and tritone clashes: no interval here sounds settled.
  const cluster = [233.1, 246.9, 277.2, 329.6, 349.2, 466.2];
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const d = i / sampleRate - hitAt;
    let tone = 0;
    if (d >= 0) {
      const attack = Math.min(1, d / 0.004);
      for (const [n, hz] of cluster.entries()) {
        tone += Math.sin(TAU * hz * d + n) * Math.exp(-d / (0.28 + 0.05 * n));
      }
      tone *= attack / cluster.length;
    }
    out[i] = tone + hiss[i] * 0.3;
  }
  return fadeEdges(normalize(out, 0.95), sampleRate, 0.002, 0.05);
}

const RENDERERS: Record<SoundId, (sampleRate: number, rng: Rng) => Float32Array> = {
  ambience,
  footstep,
  knock,
  flickerBuzz,
  powerSurge,
  sting,
};

export function renderSound(id: SoundId, sampleRate: number, rng: Rng): Float32Array {
  return RENDERERS[id](sampleRate, rng);
}
