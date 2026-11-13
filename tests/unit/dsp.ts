/** Small signal-analysis helpers for tests. */

export function peak(samples: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) max = Math.max(max, Math.abs(samples[i]));
  return max;
}

export function rms(samples: ArrayLike<number>, from = 0, to = samples.length): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** RMS per window of `windowSeconds`. */
export function envelope(samples: Float32Array, sampleRate: number, windowSeconds: number): number[] {
  const size = Math.max(1, Math.round(windowSeconds * sampleRate));
  const out: number[] = [];
  for (let i = 0; i + size <= samples.length; i += size) out.push(rms(samples, i, i + size));
  return out;
}

/** Power spectrum of bins 0..N/2 (zero-padded to a power of two). */
export function powerSpectrum(samples: Float32Array): { power: Float64Array; size: number } {
  let size = 1;
  while (size < samples.length) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(samples);
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const half = len / 2;
    for (let i = 0; i < size; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k += 1) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * cr - im[i + k + half] * ci;
        const vi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
  const power = new Float64Array(size / 2);
  for (let k = 0; k < size / 2; k += 1) power[k] = re[k] * re[k] + im[k] * im[k];
  return { power, size };
}

/** Fraction of the signal's energy between lo and hi Hz (DC excluded). */
export function bandShare(samples: Float32Array, sampleRate: number, lo: number, hi: number): number {
  const { power, size } = powerSpectrum(samples);
  let inBand = 0;
  let total = 0;
  for (let k = 1; k < power.length; k += 1) {
    const hz = (k * sampleRate) / size;
    total += power[k];
    if (hz >= lo && hz < hi) inBand += power[k];
  }
  return total === 0 ? 0 : inBand / total;
}
