/**
 * Minimal iterative radix-2 FFT. Enough for feature extraction; not a general DSP library.
 * Sizes must be powers of two. Twiddles are cached per size.
 */
const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function twiddles(size: number): { cos: Float64Array; sin: Float64Array } {
  const cached = twiddleCache.get(size);
  if (cached) return cached;
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    const angle = (-2 * Math.PI * i) / size;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }
  const entry = { cos, sin };
  twiddleCache.set(size, entry);
  return entry;
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** In-place complex FFT. `re` and `im` must have the same power-of-two length. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (!isPowerOfTwo(n) || im.length !== n) throw new Error('fft: length must be a power of two');

  // Bit reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] as number;
      re[i] = re[j] as number;
      re[j] = tr;
      const ti = im[i] as number;
      im[i] = im[j] as number;
      im[j] = ti;
    }
  }

  const { cos, sin } = twiddles(n);
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step] as number;
        const wi = sin[k * step] as number;
        const a = start + k;
        const b = a + half;
        const xr = re[b] as number;
        const xi = im[b] as number;
        const tr = xr * wr - xi * wi;
        const ti = xr * wi + xi * wr;
        re[b] = (re[a] as number) - tr;
        im[b] = (im[a] as number) - ti;
        re[a] = (re[a] as number) + tr;
        im[a] = (im[a] as number) + ti;
      }
    }
  }
}

/** Magnitude spectrum (bins 0..n/2) of a real frame, with a Hann window applied. */
export function magnitudeSpectrum(
  frame: Float32Array | Float64Array,
  window: Float64Array,
): Float64Array {
  const n = frame.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (frame[i] as number) * (window[i] as number);
  fft(re, im);
  const bins = n / 2 + 1;
  const out = new Float64Array(bins);
  for (let i = 0; i < bins; i++) out[i] = Math.hypot(re[i] as number, im[i] as number);
  return out;
}

export function hannWindow(size: number): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  return out;
}
