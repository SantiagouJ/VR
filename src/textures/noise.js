export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

export function createNoise2D(rand) {
  const S = 256;
  const perm = new Uint8Array(S * 2);
  const gx = new Float32Array(S);
  const gy = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
    perm[i] = i;
  }
  for (let i = S - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < S; i++) perm[i + S] = perm[i];

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const aa = perm[perm[X] + Y];
    const ba = perm[perm[X + 1] + Y];
    const ab = perm[perm[X] + Y + 1];
    const bb = perm[perm[X + 1] + Y + 1];
    const d00 = gx[aa] * xf + gy[aa] * yf;
    const d10 = gx[ba] * (xf - 1) + gy[ba] * yf;
    const d01 = gx[ab] * xf + gy[ab] * (yf - 1);
    const d11 = gx[bb] * (xf - 1) + gy[bb] * (yf - 1);
    return d00 + u * (d10 - d00) + v * (d01 + u * (d11 - d01) - (d00 + u * (d10 - d00)));
  };
}

export function fbm(noise, x, y, oct) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += noise(x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

export function turbulence(noise, x, y, oct) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += Math.abs(noise(x * freq, y * freq)) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}
