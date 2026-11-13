import { describe, expect, it } from 'vitest';
import { DURATION, SOUND_IDS, renderSound, type SoundId } from '../../src/audio/synth';
import { createSeededRandom } from '../../src/utils/random';
import { bandShare, envelope, peak, rms } from './dsp';

const SR = 48_000;
const render = (id: SoundId, seed = 1) => renderSound(id, SR, createSeededRandom(seed));
const ONE_SHOTS = SOUND_IDS.filter((id) => id !== 'ambience');

describe.each(SOUND_IDS)('renderSound(%s)', (id) => {
  const samples = render(id);

  it('has the documented duration (within 5 %)', () => {
    expect(samples.length / SR).toBeGreaterThan(DURATION[id] * 0.95);
    expect(samples.length / SR).toBeLessThan(DURATION[id] * 1.05);
  });

  it('holds only finite values within [-1, 1]', () => {
    expect(samples.every((v) => Number.isFinite(v))).toBe(true);
    expect(peak(samples)).toBeLessThanOrEqual(1);
  });

  it('is audible (RMS above 0.005)', () => {
    expect(rms(samples)).toBeGreaterThan(0.005);
  });

  it('is identical for the same seed', () => {
    expect(render(id, 1)).toEqual(samples);
  });
});

describe('renderSound character', () => {
  it('differs between seeds for the noise-based sounds', () => {
    for (const id of ['ambience', 'footstep', 'flickerBuzz'] as const) {
      expect(render(id, 1)).not.toEqual(render(id, 2));
    }
  });

  it('ambience loops without a click', () => {
    const a = render('ambience');
    expect(Math.abs(a[0] - a[a.length - 1])).toBeLessThan(0.02);
  });

  it('ambience is a low rumble: 85 % of its energy sits below 250 Hz', () => {
    expect(bandShare(render('ambience'), SR, 0, 250)).toBeGreaterThan(0.85);
  });

  it.each(ONE_SHOTS)('%s starts and ends at silence (no click)', (id) => {
    const s = render(id);
    expect(Math.abs(s[0])).toBeLessThan(0.05);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(0.01);
  });

  it('footstep is a mid-band thud: most energy between 250 and 1200 Hz', () => {
    expect(bandShare(render('footstep'), SR, 250, 1200)).toBeGreaterThan(0.6);
  });

  it('knock is three separate thuds about 180 ms apart', () => {
    // 20 ms windows: at least one full cycle of a 50-90 Hz thud, so the envelope does not ripple.
    const env = envelope(render('knock'), SR, 0.02);
    const threshold = Math.max(...env) * 0.25;
    const onsets: number[] = [];
    for (let i = 0; i < env.length; i += 1) {
      if (env[i] > threshold && (i === 0 || env[i - 1] <= threshold)) onsets.push(i * 0.02);
    }
    expect(onsets).toHaveLength(3);
    expect(onsets[1] - onsets[0]).toBeGreaterThan(0.14);
    expect(onsets[1] - onsets[0]).toBeLessThan(0.22);
    expect(onsets[2] - onsets[1]).toBeGreaterThan(0.14);
    expect(onsets[2] - onsets[1]).toBeLessThan(0.22);
  });

  it('knock is mostly low frequency (below 250 Hz)', () => {
    expect(bandShare(render('knock'), SR, 0, 250)).toBeGreaterThan(0.8);
  });

  it('flickerBuzz is chopped: it has silent gaps between loud bursts', () => {
    const env = envelope(render('flickerBuzz'), SR, 0.01);
    const loud = Math.max(...env);
    let transitions = 0;
    for (let i = 1; i < env.length; i += 1) {
      if (env[i] > loud * 0.5 !== env[i - 1] > loud * 0.5) transitions += 1;
    }
    expect(Math.min(...env.slice(2, -2))).toBeLessThan(loud * 0.1);
    expect(transitions).toBeGreaterThanOrEqual(4);
  });

  it('powerSurge climbs for 1.5 s then slams: the loudest sample is in the slam', () => {
    const s = render('powerSurge');
    let at = 0;
    for (let i = 0; i < s.length; i += 1) if (Math.abs(s[i]) > Math.abs(s[at])) at = i;
    expect(at / SR).toBeGreaterThanOrEqual(1.5);
    expect(at / SR).toBeLessThan(1.6);
    expect(rms(s, Math.round(1.0 * SR), Math.round(1.4 * SR))).toBeGreaterThan(
      rms(s, Math.round(0.1 * SR), Math.round(0.5 * SR)),
    );
  });

  it('sting builds with a noise swell and then hits: loudest sample after 0.1 s, with a dissonant low cluster', () => {
    const s = render('sting');
    let at = 0;
    for (let i = 0; i < s.length; i += 1) if (Math.abs(s[i]) > Math.abs(s[at])) at = i;
    expect(at / SR).toBeGreaterThan(0.1);
    expect(bandShare(s, SR, 200, 500)).toBeGreaterThan(0.5);
    expect(bandShare(s, SR, 1000, 24_000)).toBeGreaterThan(0.03);
  });
});
