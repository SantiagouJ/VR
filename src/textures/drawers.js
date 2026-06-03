import { fbm, turbulence, clamp255 } from './noise.js';

export function drawMarble(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox1 = rand() * 100, oy1 = rand() * 100;
  const ox2 = rand() * 100, oy2 = rand() * 100;
  const ox3 = rand() * 100, oy3 = rand() * 100;
  const angle = rand() * Math.PI;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const rx = nx * ca - ny * sa, ry = nx * sa + ny * ca;
      const w1x = fbm(noise, nx * 3 + ox1, ny * 3 + oy1, 4);
      const w1y = fbm(noise, nx * 3 + ox2, ny * 3 + oy2, 4);
      const wx = rx + w1x * 0.5, wy = ry + w1y * 0.5;
      const w2 = fbm(noise, wx * 4 + ox3, wy * 4 + oy3, 3) * 0.15;
      const wwx = wx + w2, wwy = wy + w2;
      const vn1 = fbm(noise, wwx * 5, wwy * 5, 5);
      const v1 = Math.pow(1 - Math.abs(Math.sin(vn1 * Math.PI * 2 + wwx * 6)), 8) * 0.6;
      const vn2 = fbm(noise, wwx * 10 + 5.2, wwy * 10 + 1.3, 4);
      const v2 = Math.pow(1 - Math.abs(Math.sin(vn2 * Math.PI * 3 + wwy * 12)), 12) * 0.35;
      const vn3 = fbm(noise, wwx * 20 + 9.1, wwy * 20 + 3.7, 3);
      const v3 = Math.pow(1 - Math.abs(Math.sin(vn3 * Math.PI * 4)), 16) * 0.2;
      const bgV = fbm(noise, nx * 2 + 20, ny * 2 + 20, 3) * 30;
      const t = Math.min(1, v1 + v2 + v3);
      const pn = (rand() - 0.5) * 4;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t + bgV + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + bgV * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + bgV * 0.7 + pn);
      data[i + 3] = 255;
    }
  }
}

export function drawWood(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const ringScale = 10 + rand() * 10;
  const hasKnot = rand() > 0.6;
  const knotX = rand(), knotY = rand(), knotR = 0.03 + rand() * 0.04;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const warp = fbm(noise, nx * 4 + ox, ny * 1.5 + oy, 4) * 0.15;
      const wy = ny + warp;
      const ring = Math.sin((wy * ringScale + fbm(noise, nx * 2 + ox, ny * 2 + oy, 3) * 1.5) * Math.PI * 2) * 0.5 + 0.5;
      const grain = Math.pow(Math.abs(Math.sin(wy * 80 + fbm(noise, nx * 40 + ox, ny * 2 + oy, 2) * 4)), 0.3) * 0.15;
      const ray = Math.pow(Math.max(0, noise(nx * 2 + ox + 30, ny * 30 + oy + 30)), 4) * 0.08;
      const lenV = fbm(noise, nx * 0.5 + 50, ny * 0.5 + 50, 2) * 0.1;
      let knot = 0;
      if (hasKnot) {
        const dx = nx - knotX, dy = ny - knotY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < knotR * 3) {
          const kr = Math.sin((d / knotR) * Math.PI * 4 + noise(nx * 20, ny * 20) * 2);
          knot = Math.max(0, 1 - d / (knotR * 3)) * (kr * 0.3 + 0.5) * 0.5;
        }
      }
      const t = Math.max(0, Math.min(1, ring * 0.5 + grain + ray + lenV + knot));
      const pn = (rand() - 0.5) * 3;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

export function drawBrick(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const brickH = s / 8, brickW = s / 4;
  const mortarW = s * 0.012;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const row = Math.floor(py / brickH);
      const offset = (row % 2) * brickW * 0.5;
      const bx = ((px + offset) % s) / brickW;
      const by = py / brickH;
      const fx = bx - Math.floor(bx), fy = by - Math.floor(by);
      const isMortar = fx * brickW < mortarW || fy * brickH < mortarW;
      const nx = px / s, ny = py / s;
      const i = (py * s + px) * 4;
      if (isMortar) {
        const mn = fbm(noise, nx * 20 + ox, ny * 20 + oy, 3) * 15;
        data[i] = clamp255(ar + mn);
        data[i + 1] = clamp255(ag + mn);
        data[i + 2] = clamp255(ab + mn);
      } else {
        const brickSeed = Math.floor(bx) * 73 + row * 137;
        const colorVar = (((brickSeed * 16807 + 7) % 2147483647) / 2147483647) * 30 - 15;
        const surf = fbm(noise, nx * 12 + ox, ny * 12 + oy, 4) * 25;
        const chip = Math.pow(Math.max(0, noise(nx * 30 + ox + 50, ny * 30 + oy + 50)), 6) * 40;
        const pn = (rand() - 0.5) * 6;
        data[i] = clamp255(br + colorVar + surf + chip + pn);
        data[i + 1] = clamp255(bg + colorVar * 0.7 + surf * 0.8 + chip * 0.6 + pn);
        data[i + 2] = clamp255(bb + colorVar * 0.5 + surf * 0.6 + chip * 0.4 + pn);
      }
      data[i + 3] = 255;
    }
  }
}

export function drawCeramic(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const tileCount = 6 + Math.floor(rand() * 4);
  const tileSize = s / tileCount;
  const groutW = s * 0.008;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const tx = px / tileSize, ty = py / tileSize;
      const fx = tx - Math.floor(tx), fy = ty - Math.floor(ty);
      const isGrout = fx * tileSize < groutW || fy * tileSize < groutW;
      const nx = px / s, ny = py / s;
      const i = (py * s + px) * 4;
      if (isGrout) {
        const gn = fbm(noise, nx * 30 + ox, ny * 30 + oy, 2) * 10;
        data[i] = clamp255(ar * 0.7 + gn);
        data[i + 1] = clamp255(ag * 0.7 + gn);
        data[i + 2] = clamp255(ab * 0.7 + gn);
      } else {
        const tileSeed = Math.floor(tx) * 97 + Math.floor(ty) * 53;
        const colorVar = (((tileSeed * 16807 + 7) % 2147483647) / 2147483647) * 8 - 4;
        const glaze = fbm(noise, nx * 8 + ox + 10, ny * 8 + oy + 10, 3) * 10;
        const spec = Math.pow(Math.max(0, noise(nx * 4 + ox + 30, ny * 4 + oy + 30)), 2) * 15;
        const pn = (rand() - 0.5) * 2;
        data[i] = clamp255(br + colorVar + glaze + spec + pn);
        data[i + 1] = clamp255(bg + colorVar + glaze * 0.9 + spec * 0.95 + pn);
        data[i + 2] = clamp255(bb + colorVar + glaze * 0.8 + spec * 0.9 + pn);
      }
      data[i + 3] = 255;
    }
  }
}

export function drawMarbleStone(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const lg = fbm(noise, nx * 3 + ox, ny * 3 + oy, 4) * 0.3;
      const md = fbm(noise, nx * 8 + ox + 10, ny * 8 + oy + 10, 3) * 0.2;
      const fn = noise(nx * 30 + ox + 20, ny * 30 + oy + 20) * 0.15;
      const mc = noise(nx * 60 + ox + 40, ny * 60 + oy + 40) * 0.08;
      const layer = Math.sin(ny * 15 + fbm(noise, nx * 4, ny * 4, 3) * 3) * 0.05;
      const crystal = Math.pow(Math.max(0, noise(nx * 25 + ox + 50, ny * 25 + oy + 50)), 6) * 50;
      const t = Math.max(0, Math.min(1, 0.5 + lg + md + fn + mc + layer));
      const pn = (rand() - 0.5) * 5;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t + crystal + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + crystal * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + crystal * 0.8 + pn);
      data[i + 3] = 255;
    }
  }
}

export function drawGlass(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const warp = fbm(noise, nx * 3 + ox, ny * 3 + oy, 3) * 0.02;
      const frost = fbm(noise, (nx + warp) * 8 + ox + 10, (ny + warp) * 8 + oy + 10, 4) * 0.06;
      const spec = Math.pow(Math.max(0, noise(nx * 4 + ox + 30, ny * 4 + oy + 30)), 2) * 25;
      const edge = Math.pow(Math.max(0, noise(nx * 2 + ox + 50, ny * 2 + oy + 50)), 3) * 15;
      const t = Math.max(0, Math.min(1, 0.5 + frost + warp));
      const pn = (rand() - 0.5) * 1.5;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t + spec + edge + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + spec * 0.95 + edge * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + spec * 0.9 + edge * 0.85 + pn);
      data[i + 3] = 255;
    }
  }
}

export function drawSolid(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const v = fbm(noise, nx * 4 + ox, ny * 4 + oy, 3) * 0.03;
      const t = Math.max(0, Math.min(1, 0.5 + v));
      const pn = (rand() - 0.5) * 2;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

export function drawConcrete(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const pinholes = [];
  for (let p = 0; p < 25 + ((rand() * 30) | 0); p++)
    pinholes.push({ x: rand(), y: rand(), r: 0.002 + rand() * 0.005 });
  const aggs = [];
  for (let a = 0; a < 10 + ((rand() * 12) | 0); a++)
    aggs.push({ x: rand(), y: rand(), r: 0.01 + rand() * 0.02, sh: (rand() - 0.5) * 0.15 });
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const lg = fbm(noise, nx * 2 + ox, ny * 2 + oy, 3) * 0.08;
      const md = fbm(noise, nx * 6 + ox + 10, ny * 6 + oy + 10, 3) * 0.06;
      const sf = turbulence(noise, nx * 15 + ox + 20, ny * 15 + oy + 20, 4) * 0.05;
      let pin = 0;
      for (const p of pinholes) {
        const dx = nx - p.x, dy = ny - p.y, d2 = dx * dx + dy * dy;
        if (d2 < p.r * p.r) pin = Math.max(pin, (1 - Math.sqrt(d2) / p.r) * 0.25);
      }
      let aggV = 0;
      for (const a of aggs) {
        const dx = nx - a.x, dy = ny - a.y, d2 = dx * dx + dy * dy;
        if (d2 < a.r * a.r) aggV += (1 - Math.sqrt(d2) / a.r) * a.sh;
      }
      const t = Math.max(0, Math.min(1, 0.5 + lg + md + sf + aggV));
      const pn = (rand() - 0.5) * 4;
      const i = (py * s + px) * 4;
      data[i] = clamp255(br + (ar - br) * t - pin * 30 + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t - pin * 30 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t - pin * 30 + pn);
      data[i + 3] = 255;
    }
  }
}

export const DRAW_FN_MAP = {
  marble: drawMarble,
  wood: drawWood,
  stone: drawMarbleStone,
  concrete: drawConcrete,
  solid: drawSolid,
  brick: drawBrick,
  ceramic: drawCeramic,
  glass: drawGlass,
};
