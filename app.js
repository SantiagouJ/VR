import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ────────────────────────────────────────────
// Audio System
// ────────────────────────────────────────────
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let ambientGainNode = null;
let uiGainNode = null;
let ambientSource = null;
let ambientBuffer = null;
let uiBuffer = null;
let audioInitialized = false;
let ambientPlaying = false;

function createAmbientMusic() {
  const sampleRate = audioContext.sampleRate;
  const duration = 30;
  const numSamples = sampleRate * duration;
  const buffer = audioContext.createBuffer(2, numSamples, sampleRate);
  
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const baseFreq = 55;
    
    let sample = 0;
    sample += Math.sin(2 * Math.PI * baseFreq * t) * 0.15;
    sample += Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.08;
    sample += Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.05;
    sample += Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.03;
    
    const lfoFreq = 0.05;
    const lfo = Math.sin(2 * Math.PI * lfoFreq * t) * 0.5 + 0.5;
    sample += Math.sin(2 * Math.PI * (baseFreq * 4) * t) * 0.02 * lfo;
    
    const pad1 = Math.sin(2 * Math.PI * 110 * t + Math.sin(2 * Math.PI * 0.1 * t) * 2) * 0.04;
    const pad2 = Math.sin(2 * Math.PI * 165 * t + Math.sin(2 * Math.PI * 0.08 * t) * 2) * 0.03;
    const pad3 = Math.sin(2 * Math.PI * 220 * t + Math.sin(2 * Math.PI * 0.12 * t) * 2) * 0.02;
    sample += pad1 + pad2 + pad3;
    
    const envelope = Math.min(1, t / 2) * Math.min(1, (duration - t) / 2);
    sample *= envelope * 0.5;
    
    const stereoOffset = Math.sin(2 * Math.PI * 0.03 * t) * 0.3;
    leftChannel[i] = sample * (1 - stereoOffset * 0.5);
    rightChannel[i] = sample * (1 + stereoOffset * 0.5);
  }
  
  return buffer;
}

function createUISound() {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.3;
  const numSamples = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 12) * Math.min(1, t * 100);
    
    let sample = 0;
    sample += Math.sin(2 * Math.PI * 880 * t) * 0.3;
    sample += Math.sin(2 * Math.PI * 1320 * t) * 0.2;
    sample += Math.sin(2 * Math.PI * 1760 * t) * 0.15;
    sample += Math.sin(2 * Math.PI * 2200 * t) * 0.1;
    
    const sweep = 880 + (1 - Math.exp(-t * 20)) * 440;
    sample += Math.sin(2 * Math.PI * sweep * t) * 0.2;
    
    channel[i] = sample * envelope * 0.4;
  }
  
  return buffer;
}

function initAudio() {
  if (audioInitialized) return;
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  ambientGainNode = audioContext.createGain();
  ambientGainNode.gain.value = 0.3;
  ambientGainNode.connect(audioContext.destination);
  
  uiGainNode = audioContext.createGain();
  uiGainNode.gain.value = 0.5;
  uiGainNode.connect(audioContext.destination);
  
  ambientBuffer = createAmbientMusic();
  uiBuffer = createUISound();
  
  audioInitialized = true;
}

function playAmbientMusic() {
  if (!audioInitialized) initAudio();
  if (ambientPlaying) return;
  
  ambientSource = audioContext.createBufferSource();
  ambientSource.buffer = ambientBuffer;
  ambientSource.loop = true;
  ambientSource.connect(ambientGainNode);
  ambientSource.start();
  ambientPlaying = true;
}

function stopAmbientMusic() {
  if (ambientSource && ambientPlaying) {
    ambientSource.stop();
    ambientPlaying = false;
  }
}

function playUISound() {
  if (!audioInitialized) initAudio();
  
  const source = audioContext.createBufferSource();
  source.buffer = uiBuffer;
  source.connect(uiGainNode);
  source.start();
}

function setAmbientVolume(volume) {
  if (ambientGainNode) {
    ambientGainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}

function setUIVolume(volume) {
  if (uiGainNode) {
    uiGainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
}

document.addEventListener('click', () => {
  if (!audioInitialized) {
    initAudio();
  }
}, { once: true });

document.addEventListener('touchstart', () => {
  if (!audioInitialized) {
    initAudio();
  }
}, { once: true });

// ────────────────────────────────────────────
// Tile Catalog (Corona-style finishes)
// ────────────────────────────────────────────
// worldSize = tamaño físico en metros de un "tile" (1 repeat). Se usa para escalar
// la textura dinámicamente al tamaño real de cada superficie del modelo.
const CATALOG = [
  { cat: 'Madera', tiles: [
    { id: 'bk-wood-struct',    name: 'Wood Structure',        type: 'wood', base: '#b8935a', accent: '#7a5c2e', worldSize: 1.8 },
    { id: 'bk-roble-natural',  name: 'Roble Natural',         type: 'wood', base: '#c49a6c', accent: '#8b6914', worldSize: 1.8 },
    { id: 'bk-nogal-amer',     name: 'Nogal Americano',       type: 'wood', base: '#5c3a1e', accent: '#3a2210', worldSize: 1.8 },
    { id: 'bk-parquet',        name: 'Parquet',               type: 'wood', base: '#c8a070', accent: '#8a6030', worldSize: 1.2 },
    { id: 'bk-pino-blanq',     name: 'Pino Blanqueado',       type: 'wood', base: '#ddd0bc', accent: '#c4b090', worldSize: 1.8 },
    { id: 'bk-teca-dorada',    name: 'Teca Dorada',           type: 'wood', base: '#b8860b', accent: '#8b6508', worldSize: 1.8 },
    { id: 'bk-cerezo',         name: 'Cerezo',                type: 'wood', base: '#8b4513', accent: '#5c2d0a', worldSize: 1.8 },
    { id: 'bk-wdeck',          name: 'Weathered Decking',     type: 'wood', base: '#8a7e6c', accent: '#5e5548', worldSize: 1.5 },
  ]},
  { cat: 'Ladrillo', tiles: [
    { id: 'bk-brick-red',      name: 'Brick Wall Rojo',       type: 'brick', base: '#8b3a2a', accent: '#c8a88a', worldSize: 1.0 },
    { id: 'bk-brick-white',    name: 'Brick Wall Blanco',     type: 'brick', base: '#d8d0c8', accent: '#b8b0a8', worldSize: 1.0 },
    { id: 'bk-brick-old',      name: 'Brick Wall Antiguo',    type: 'brick', base: '#9a6a4a', accent: '#706050', worldSize: 1.0 },
    { id: 'bk-brick-modern',   name: 'Brick Wall Moderno',    type: 'brick', base: '#4a4040', accent: '#383030', worldSize: 1.0 },
    { id: 'bk-brick-beige',    name: 'Brick Wall Beige',      type: 'brick', base: '#c4a880', accent: '#a89070', worldSize: 1.0 },
  ]},
  { cat: 'Cerámica', tiles: [
    { id: 'bk-tile-subway',   name: 'Subway Tile',           type: 'ceramic', base: '#f0ece4', accent: '#d0ccc4', worldSize: 1.2 },
    { id: 'bk-tile-hex',      name: 'Hexagonal Tile',        type: 'ceramic', base: '#e8e0d8', accent: '#c0b8b0', worldSize: 1.0 },
    { id: 'bk-tile-mosaic',   name: 'Mosaic',                type: 'ceramic', base: '#4a7a8a', accent: '#2a5a6a', worldSize: 0.8 },
    { id: 'bk-tile-terracota',name: 'Terracota Tile',        type: 'ceramic', base: '#c45a3c', accent: '#a04028', worldSize: 1.2 },
    { id: 'bk-caution',       name: 'Caution Stripe',        type: 'ceramic', base: '#e8c820', accent: '#1a1a1a', worldSize: 1.0 },
  ]},
  { cat: 'Mármol', tiles: [
    { id: 'bk-calacatta',  name: 'Calacatta Bianco',  type: 'marble', base: '#f5f0e8', accent: '#c4a882', worldSize: 2.5 },
    { id: 'bk-statuario',  name: 'Statuario',         type: 'marble', base: '#f0ede8', accent: '#8a8a8a', worldSize: 2.5 },
    { id: 'bk-nero-marq',  name: 'Nero Marquina',     type: 'marble', base: '#1e1e1e', accent: '#8a7a50', worldSize: 2.5 },
    { id: 'bk-travertino', name: 'Travertino Beige',  type: 'marble', base: '#ddd0b8', accent: '#c2ad8a', worldSize: 2.5 },
    { id: 'bk-onyx',       name: 'Onyx Perla',        type: 'marble', base: '#e8ddd0', accent: '#c4a892', worldSize: 2.5 },
  ]},
  { cat: 'Vidrio', tiles: [
    { id: 'bk-glass-clear',   name: 'Glass Clear',           type: 'glass', base: '#c8e0f0', accent: '#a0c8e0', worldSize: 3.0 },
    { id: 'bk-glass-frosted', name: 'Glass Frosted',         type: 'glass', base: '#d8e0e8', accent: '#c0c8d0', worldSize: 3.0 },
    { id: 'bk-glass-tinted',  name: 'Glass Tinted',          type: 'glass', base: '#6090a0', accent: '#487888', worldSize: 3.0 },
    { id: 'bk-glass-green',   name: 'Glass Verde',           type: 'glass', base: '#88b8a0', accent: '#68a088', worldSize: 3.0 },
  ]},
];

// ────────────────────────────────────────────
// Auto-grouping keywords
// ────────────────────────────────────────────
const GROUP_KEYWORDS = [
  { keywords: ['pared', 'wall', 'muro'],                    label: 'Paredes',    icon: 'wall' },
  { keywords: ['puerta', 'door'],                            label: 'Puertas',    icon: 'door' },
  { keywords: ['ventana', 'window', 'vidrio', 'glass'],     label: 'Ventanas',   icon: 'window' },
  { keywords: ['piso', 'suelo', 'floor'],                   label: 'Pisos',      icon: 'floor' },
  { keywords: ['techo', 'ceiling', 'cielo', 'cielorraso'],  label: 'Techos',     icon: 'ceiling' },
  { keywords: ['cocina', 'kitchen', 'mesón', 'meson', 'encimera'], label: 'Cocina', icon: 'kitchen' },
  { keywords: ['baño', 'bano', 'bathroom', 'sanitario', 'lavamanos'], label: 'Baño', icon: 'bath' },
  { keywords: ['escalera', 'stair', 'escalón', 'escalon'], label: 'Escaleras',  icon: 'stairs' },
  { keywords: ['columna', 'column', 'pilar', 'viga'],       label: 'Estructura', icon: 'pillar' },
  { keywords: ['balcon', 'terraza', 'balcony', 'terrasse'],  label: 'Exterior',   icon: 'balcony' },
  { keywords: ['mueble', 'furniture', 'closet', 'armario', 'gabinete', 'estante'], label: 'Muebles', icon: 'furniture' },
  { keywords: ['marco', 'moldura', 'zocalo', 'zócalo', 'baseboard', 'trim'], label: 'Molduras', icon: 'trim' },
];

// ────────────────────────────────────────────
// Procedural texture generation (noise-based)
// ────────────────────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function createNoise2D(rand) {
  const S = 256, perm = new Uint8Array(S * 2);
  const gx = new Float32Array(S), gy = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a); perm[i] = i;
  }
  for (let i = S - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < S; i++) perm[i + S] = perm[i];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const aa = perm[perm[X] + Y], ba = perm[perm[X + 1] + Y];
    const ab = perm[perm[X] + Y + 1], bb = perm[perm[X + 1] + Y + 1];
    const d00 = gx[aa] * xf + gy[aa] * yf;
    const d10 = gx[ba] * (xf - 1) + gy[ba] * yf;
    const d01 = gx[ab] * xf + gy[ab] * (yf - 1);
    const d11 = gx[bb] * (xf - 1) + gy[bb] * (yf - 1);
    return (d00 + u * (d10 - d00)) + v * ((d01 + u * (d11 - d01)) - (d00 + u * (d10 - d00)));
  };
}

function fbm(noise, x, y, oct) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += noise(x * freq, y * freq) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return val / max;
}

function turbulence(noise, x, y, oct) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += Math.abs(noise(x * freq, y * freq)) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return val / max;
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

function generateTileCanvas(tile, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(hashStr(tile.id));
  const noise = createNoise2D(rand);
  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;
  const base = hexToRgb(tile.base), accent = hexToRgb(tile.accent);

  const drawFn = {
    marble: drawMarble, wood: drawWood, stone: drawStone,
    concrete: drawConcrete, solid: drawSolid, brick: drawBrick,
    metal: drawMetal, fabric: drawFabric, leather: drawLeather,
    plaster: drawPlaster, ceramic: drawCeramic, rust: drawRust,
    asphalt: drawAsphalt, glass: drawGlass, moss: drawMoss,
  }[tile.type] || drawSolid;
  drawFn(d, size, base, accent, rand, noise);

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function drawMarble(data, s, base, accent, rand, noise) {
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
      data[i]     = clamp255(br + (ar - br) * t + bgV + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + bgV * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + bgV * 0.7 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawWood(data, s, base, accent, rand, noise) {
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
          const kr = Math.sin(d / knotR * Math.PI * 4 + noise(nx * 20, ny * 20) * 2);
          knot = Math.max(0, 1 - d / (knotR * 3)) * (kr * 0.3 + 0.5) * 0.5;
        }
      }

      const t = Math.max(0, Math.min(1, ring * 0.5 + grain + ray + lenV + knot));
      const pn = (rand() - 0.5) * 3;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

function drawStone(data, s, base, accent, rand, noise) {
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
      data[i]     = clamp255(br + (ar - br) * t + crystal + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + crystal * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + crystal * 0.8 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawConcrete(data, s, base, accent, rand, noise) {
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
      data[i]     = clamp255(br + (ar - br) * t - pin * 30 + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t - pin * 30 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t - pin * 30 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawSolid(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const v = fbm(noise, nx * 4 + ox, ny * 4 + oy, 3) * 0.03;
      const t = Math.max(0, Math.min(1, 0.5 + v));
      const pn = (rand() - 0.5) * 2;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

function drawBrick(data, s, base, accent, rand, noise) {
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
        data[i]     = clamp255(ar + mn);
        data[i + 1] = clamp255(ag + mn);
        data[i + 2] = clamp255(ab + mn);
      } else {
        const brickSeed = Math.floor(bx) * 73 + row * 137;
        const colorVar = ((brickSeed * 16807 + 7) % 2147483647) / 2147483647 * 30 - 15;
        const surf = fbm(noise, nx * 12 + ox, ny * 12 + oy, 4) * 25;
        const chip = Math.pow(Math.max(0, noise(nx * 30 + ox + 50, ny * 30 + oy + 50)), 6) * 40;
        const pn = (rand() - 0.5) * 6;
        data[i]     = clamp255(br + colorVar + surf + chip + pn);
        data[i + 1] = clamp255(bg + colorVar * 0.7 + surf * 0.8 + chip * 0.6 + pn);
        data[i + 2] = clamp255(bb + colorVar * 0.5 + surf * 0.6 + chip * 0.4 + pn);
      }
      data[i + 3] = 255;
    }
  }
}

function drawMetal(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const brushAngle = rand() * Math.PI;
  const ca = Math.cos(brushAngle), sa = Math.sin(brushAngle);

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const rx = nx * ca - ny * sa, ry = nx * sa + ny * ca;

      const brush = Math.sin(ry * 200 + noise(rx * 3 + ox, ry * 0.5 + oy) * 8) * 0.12;
      const scratch1 = Math.pow(Math.max(0, Math.abs(noise(nx * 40 + ox + 10, ny * 2 + oy + 10))), 8) * 0.15;
      const scratch2 = Math.pow(Math.max(0, Math.abs(noise(nx * 2 + ox + 30, ny * 40 + oy + 30))), 8) * 0.1;
      const lg = fbm(noise, nx * 2 + ox + 50, ny * 2 + oy + 50, 3) * 0.08;
      const spec = Math.pow(Math.max(0, noise(nx * 15 + ox + 70, ny * 15 + oy + 70)), 4) * 30;

      const t = Math.max(0, Math.min(1, 0.5 + brush + scratch1 + scratch2 + lg));
      const pn = (rand() - 0.5) * 3;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + spec + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + spec * 0.95 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + spec * 0.9 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawFabric(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;
  const weaveScale = 60 + rand() * 40;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const warpThread = Math.sin(nx * weaveScale * Math.PI * 2) * 0.5 + 0.5;
      const weftThread = Math.sin(ny * weaveScale * Math.PI * 2) * 0.5 + 0.5;
      const weave = ((Math.floor(nx * weaveScale) + Math.floor(ny * weaveScale)) % 2 === 0)
        ? warpThread * 0.15 : weftThread * 0.15;

      const fuzz = fbm(noise, nx * 20 + ox, ny * 20 + oy, 4) * 0.1;
      const lg = fbm(noise, nx * 3 + ox + 20, ny * 3 + oy + 20, 3) * 0.08;
      const fiber = noise(nx * 80 + ox + 40, ny * 80 + oy + 40) * 0.04;

      const t = Math.max(0, Math.min(1, 0.5 + weave + fuzz + lg + fiber));
      const pn = (rand() - 0.5) * 3;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

function drawLeather(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const grain = turbulence(noise, nx * 15 + ox, ny * 15 + oy, 5) * 0.2;
      const pore = Math.pow(Math.max(0, noise(nx * 40 + ox + 10, ny * 40 + oy + 10)), 3) * 0.15;
      const crease = Math.pow(1 - Math.abs(Math.sin(
        fbm(noise, nx * 5 + ox + 20, ny * 5 + oy + 20, 3) * Math.PI * 3
      )), 4) * 0.12;
      const lg = fbm(noise, nx * 2 + ox + 40, ny * 2 + oy + 40, 3) * 0.1;
      const spec = Math.pow(Math.max(0, noise(nx * 8 + ox + 60, ny * 8 + oy + 60)), 3) * 20;

      const t = Math.max(0, Math.min(1, 0.5 + grain + pore + crease + lg));
      const pn = (rand() - 0.5) * 4;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + spec + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + spec * 0.8 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + spec * 0.6 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawPlaster(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const trowel = fbm(noise, nx * 6 + ox, ny * 6 + oy, 4) * 0.15;
      const surf = turbulence(noise, nx * 12 + ox + 10, ny * 12 + oy + 10, 3) * 0.08;
      const crack = Math.pow(1 - Math.abs(Math.sin(
        fbm(noise, nx * 3 + ox + 30, ny * 3 + oy + 30, 4) * Math.PI * 2
      )), 12) * 0.08;
      const grain = noise(nx * 50 + ox + 50, ny * 50 + oy + 50) * 0.04;

      const t = Math.max(0, Math.min(1, 0.5 + trowel + surf + crack + grain));
      const pn = (rand() - 0.5) * 3;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

function drawCeramic(data, s, base, accent, rand, noise) {
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
        data[i]     = clamp255(ar * 0.7 + gn);
        data[i + 1] = clamp255(ag * 0.7 + gn);
        data[i + 2] = clamp255(ab * 0.7 + gn);
      } else {
        const tileSeed = Math.floor(tx) * 97 + Math.floor(ty) * 53;
        const colorVar = ((tileSeed * 16807 + 7) % 2147483647) / 2147483647 * 8 - 4;
        const glaze = fbm(noise, nx * 8 + ox + 10, ny * 8 + oy + 10, 3) * 10;
        const spec = Math.pow(Math.max(0, noise(nx * 4 + ox + 30, ny * 4 + oy + 30)), 2) * 15;
        const pn = (rand() - 0.5) * 2;
        data[i]     = clamp255(br + colorVar + glaze + spec + pn);
        data[i + 1] = clamp255(bg + colorVar + glaze * 0.9 + spec * 0.95 + pn);
        data[i + 2] = clamp255(bb + colorVar + glaze * 0.8 + spec * 0.9 + pn);
      }
      data[i + 3] = 255;
    }
  }
}

function drawRust(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const lg = fbm(noise, nx * 3 + ox, ny * 3 + oy, 4) * 0.3;
      const pitting = turbulence(noise, nx * 15 + ox + 10, ny * 15 + oy + 10, 4) * 0.2;
      const flake = Math.pow(turbulence(noise, nx * 8 + ox + 20, ny * 8 + oy + 20, 3), 2) * 0.15;
      const streak = Math.pow(Math.max(0, Math.sin(
        ny * 8 + fbm(noise, nx * 4 + ox + 40, ny * 2 + oy + 40, 3) * 4
      )), 3) * 0.1;

      const t = Math.max(0, Math.min(1, 0.4 + lg + pitting + flake + streak));
      const orangeShift = turbulence(noise, nx * 6 + ox + 60, ny * 6 + oy + 60, 3) * 30;
      const pn = (rand() - 0.5) * 5;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + orangeShift + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + orangeShift * 0.4 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + pn);
      data[i + 3] = 255;
    }
  }
}

function drawAsphalt(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  const aggregates = [];
  for (let a = 0; a < 80 + ((rand() * 60) | 0); a++)
    aggregates.push({ x: rand(), y: rand(), r: 0.003 + rand() * 0.008, bright: (rand() - 0.5) * 40 });

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const lg = fbm(noise, nx * 4 + ox, ny * 4 + oy, 4) * 0.1;
      const grit = turbulence(noise, nx * 20 + ox + 10, ny * 20 + oy + 10, 4) * 0.12;
      const micro = noise(nx * 60 + ox + 20, ny * 60 + oy + 20) * 0.06;

      let aggV = 0;
      for (const a of aggregates) {
        const dx = nx - a.x, dy = ny - a.y, d2 = dx * dx + dy * dy;
        if (d2 < a.r * a.r) aggV += (1 - Math.sqrt(d2) / a.r) * a.bright;
      }

      const t = Math.max(0, Math.min(1, 0.5 + lg + grit + micro));
      const pn = (rand() - 0.5) * 6;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t + aggV + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + aggV + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + aggV + pn);
      data[i + 3] = 255;
    }
  }
}

function drawGlass(data, s, base, accent, rand, noise) {
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
      data[i]     = clamp255(br + (ar - br) * t + spec + edge + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + spec * 0.95 + edge * 0.9 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t + spec * 0.9 + edge * 0.85 + pn);
      data[i + 3] = 255;
    }
  }
}

function drawMoss(data, s, base, accent, rand, noise) {
  const [br, bg, bb] = base, [ar, ag, ab] = accent;
  const ox = rand() * 100, oy = rand() * 100;

  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const nx = px / s, ny = py / s;
      const clumps = fbm(noise, nx * 5 + ox, ny * 5 + oy, 5) * 0.25;
      const detail = turbulence(noise, nx * 15 + ox + 10, ny * 15 + oy + 10, 4) * 0.15;
      const fiber = Math.abs(noise(nx * 40 + ox + 20, ny * 40 + oy + 20)) * 0.1;
      const depth = fbm(noise, nx * 3 + ox + 40, ny * 3 + oy + 40, 3) * 20;
      const yellowVar = Math.max(0, noise(nx * 6 + ox + 60, ny * 6 + oy + 60)) * 15;

      const t = Math.max(0, Math.min(1, 0.4 + clumps + detail + fiber));
      const pn = (rand() - 0.5) * 5;
      const i = (py * s + px) * 4;
      data[i]     = clamp255(br + (ar - br) * t - depth * 0.3 + yellowVar * 0.5 + pn);
      data[i + 1] = clamp255(bg + (ag - bg) * t + depth * 0.2 + yellowVar * 0.3 + pn);
      data[i + 2] = clamp255(bb + (ab - bb) * t - depth * 0.5 + pn);
      data[i + 3] = 255;
    }
  }
}

function generateNormalFromCanvas(srcCanvas, strength) {
  const s = srcCanvas.width;
  const srcPx = srcCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const canvas = document.createElement('canvas');
  canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(s, s);
  const od = out.data;
  const h = (px, py) => {
    px = ((px % s) + s) % s; py = ((py % s) + s) % s;
    const i = (py * s + px) * 4;
    return (srcPx[i] + srcPx[i + 1] + srcPx[i + 2]) / (3 * 255);
  };
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const l = h(x - 1, y), r = h(x + 1, y);
      const t = h(x, y - 1), b = h(x, y + 1);
      const dx = (l - r) * strength, dy = (t - b) * strength, dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const i = (y * s + x) * 4;
      od[i]     = (dx / len * 0.5 + 0.5) * 255;
      od[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      od[i + 2] = (dz / len * 0.5 + 0.5) * 255;
      od[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

const textureCache = new Map();
const normalCache = new Map();
const NORMAL_STRENGTH = {
  marble: 0.6, wood: 1.2, stone: 2.5, concrete: 1.8, solid: 0.2,
  brick: 3.0, metal: 0.4, fabric: 1.5, leather: 1.8, plaster: 1.2,
  ceramic: 0.5, rust: 2.2, asphalt: 2.0, glass: 0.15, moss: 2.0,
};

function getTileTexture(tile) {
  if (textureCache.has(tile.id)) return textureCache.get(tile.id);
  const canvas = generateTileCanvas(tile, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  textureCache.set(tile.id, texture);

  const nCanvas = generateNormalFromCanvas(canvas, NORMAL_STRENGTH[tile.type] || 1.0);
  const nTex = new THREE.CanvasTexture(nCanvas);
  nTex.wrapS = THREE.RepeatWrapping;
  nTex.wrapT = THREE.RepeatWrapping;
  nTex.anisotropy = 8;
  normalCache.set(tile.id, nTex);

  return texture;
}

function getTileNormalMap(tile) {
  if (!normalCache.has(tile.id)) getTileTexture(tile);
  return normalCache.get(tile.id);
}

// Calcula el tamaño físico aproximado de un mesh en el mundo (metros)
// usando sus dos dimensiones mayores (la superficie principal).
function getMeshSurfaceSize(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  return { u: Math.max(dims[0], 0.1), v: Math.max(dims[1], 0.1) };
}

// Clona las texturas cacheadas y ajusta repeat según tamaño real del mesh
function buildMeshTextureSet(tile, mesh) {
  const baseTex = getTileTexture(tile);
  const baseNorm = getTileNormalMap(tile);
  const { u, v } = getMeshSurfaceSize(mesh);
  const ws = tile.worldSize || 2.0;
  const ru = Math.max(0.25, u / ws);
  const rv = Math.max(0.25, v / ws);

  const tex = baseTex.clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(ru, rv);

  const norm = baseNorm.clone();
  norm.needsUpdate = true;
  norm.wrapS = THREE.RepeatWrapping;
  norm.wrapT = THREE.RepeatWrapping;
  norm.anisotropy = 8;
  norm.repeat.set(ru, rv);

  return { tex, norm };
}

function getTilePreviewDataURL(tile) {
  const key = tile.id + '_preview';
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = generateTileCanvas(tile, 128);
  const url = canvas.toDataURL();
  textureCache.set(key, url);
  return url;
}

// ────────────────────────────────────────────
// DOM refs
// ────────────────────────────────────────────
const container     = document.getElementById('canvas-container');
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const loadingEl     = document.getElementById('loading');
const controlsEl    = document.getElementById('controls');
const partsList     = document.getElementById('parts-list');
const hintEl        = document.getElementById('hint');
const panelToggle   = document.getElementById('panel-toggle');
const panelClose    = document.getElementById('panel-close');
const partsSearch   = document.getElementById('parts-search');
const partsView     = document.getElementById('parts-view');
const finishView    = document.getElementById('finish-view');
const btnBack       = document.getElementById('btn-back');
const categoryChips = document.getElementById('category-chips');
const tileGrid      = document.getElementById('tile-grid');
const textureInput  = document.getElementById('texture-input');
const uploadArea    = document.getElementById('upload-area');
const uploadedTexEl = document.getElementById('uploaded-textures');
const solidPicker   = document.getElementById('solid-color-picker');
const colorHexLabel = document.getElementById('color-hex-label');
const btnApplyColor = document.getElementById('btn-apply-color');


// ────────────────────────────────────────────
// Renderer
// ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
container.appendChild(renderer.domElement);

const vrButton = VRButton.createButton(renderer, {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking']
});
vrButton.id = 'vr-button';
document.body.appendChild(vrButton);

// ────────────────────────────────────────────
// Scene, Camera, Controls
// ────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(8, 6, 10);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.target.set(0, 1, 0);
orbitControls.maxPolarAngle = Math.PI / 2 + 0.15;
orbitControls.update();

// ────────────────────────────────────────────
// Lights (multi-directional to avoid dark backfaces)
// ────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xc8d0e0, 1.0));

const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
sunLight.position.set(8, 12, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

const fillLeft = new THREE.DirectionalLight(0x99bbff, 0.6);
fillLeft.position.set(-8, 6, -4);
scene.add(fillLeft);

const fillBack = new THREE.DirectionalLight(0xdde4f0, 0.8);
fillBack.position.set(-4, 8, -10);
scene.add(fillBack);

const fillRight = new THREE.DirectionalLight(0xf0e8dd, 0.4);
fillRight.position.set(4, 4, -6);
scene.add(fillRight);

scene.add(new THREE.HemisphereLight(0xb0c4de, 0x8090a0, 0.6));

// (Ground plane removed)

// ────────────────────────────────────────────
// WebXR: Controllers, Hands, Rays
// ────────────────────────────────────────────
let isInVR = false;

// Locomoción VR (thumbstick): offset acumulado + rotación yaw
let xrBaseReferenceSpace = null;
const xrOffset = { x: 0, y: 0, z: 0 };
let xrYaw = 0;
let xrLastFrameTime = 0;
let xrSnapTurnReady = true;
const XR_MOVE_SPEED = 2.0;
const XR_SNAP_ANGLE = Math.PI / 6;
const XR_STICK_DEADZONE = 0.18;

// VR Player height adjustment (positive = lower viewpoint, makes you "shorter")
// Adjust this value if you feel too tall or too short in the apartment
const VR_HEIGHT_OFFSET = 0.3;

renderer.xr.addEventListener('sessionstart', () => {
  isInVR = true;
  orbitControls.enabled = false;
  xrBaseReferenceSpace = renderer.xr.getReferenceSpace();
  xrOffset.x = 0; 
  xrOffset.y = VR_HEIGHT_OFFSET;  // Apply height offset to lower viewpoint
  xrOffset.z = 0;
  xrYaw = 0;
  xrLastFrameTime = 0;
  xrSnapTurnReady = true;
  
  // Resume audio context and play ambient music in VR
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  if (loadedModel && !ambientPlaying) {
    initAudio();
    playAmbientMusic();
  }
});

renderer.xr.addEventListener('sessionend', () => {
  isInVR = false;
  orbitControls.enabled = true;
  closeVRPanel();
  xrBaseReferenceSpace = null;
});

const controllerModelFactory = new XRControllerModelFactory();
const handModelFactory = new XRHandModelFactory();

const xrControllers = [0, 1].map(i => {
  const ctrl = renderer.xr.getController(i);
  ctrl.userData.index = i;
  scene.add(ctrl);

  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  const hand = renderer.xr.getHand(i);
  hand.add(handModelFactory.createHandModel(hand, 'mesh'));
  scene.add(hand);

  const rayGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -4)
  ]);
  const rayMat = new THREE.LineBasicMaterial({ color: 0x64B5F6, transparent: true, opacity: 0.6 });
  const ray = new THREE.Line(rayGeo, rayMat);
  ray.visible = false;
  ctrl.add(ray);

  ctrl.addEventListener('connected', (e) => {
    ray.visible = e.data.targetRayMode === 'tracked-pointer' || e.data.hand != null;
    ctrl.userData.handedness = e.data.handedness || null;
  });
  ctrl.addEventListener('disconnected', () => {
    ray.visible = false;
    ctrl.userData.handedness = null;
  });

  ctrl.addEventListener('selectstart', onXRSelectStart);
  ctrl.addEventListener('squeezestart', onXRSqueezeStart);
  ctrl.addEventListener('squeezeend', onXRSqueezeEnd);

  return { ctrl, grip, hand, ray };
});

// ────────────────────────────────────────────
// WebXR: VR Panel (floating 3D UI)
// ────────────────────────────────────────────
const VR_PANEL_W = 800;
const VR_PANEL_H = 640;
const VR_PANEL_SCALE_X = 0.9;
const VR_PANEL_SCALE_Y = VR_PANEL_SCALE_X * (VR_PANEL_H / VR_PANEL_W);

let vrPanelVisible = false;
let vrPanelActiveCategory = CATALOG[0].cat;
const vrPanelRegions = { close: null, categories: [], tiles: [] };

const vrPanelCanvas = document.createElement('canvas');
vrPanelCanvas.width = VR_PANEL_W;
vrPanelCanvas.height = VR_PANEL_H;
const vrPanelCtx = vrPanelCanvas.getContext('2d');

const vrPanelTexture = new THREE.CanvasTexture(vrPanelCanvas);
vrPanelTexture.colorSpace = THREE.SRGBColorSpace;

const vrPanelMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(VR_PANEL_SCALE_X, VR_PANEL_SCALE_Y),
  new THREE.MeshBasicMaterial({ map: vrPanelTexture, transparent: true, side: THREE.DoubleSide })
);
vrPanelMesh.visible = false;
vrPanelMesh.userData.isVRPanel = true;
scene.add(vrPanelMesh);

const vrPointerDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.006, 16),
  new THREE.MeshBasicMaterial({ color: 0x64B5F6, depthTest: false })
);
vrPointerDot.visible = false;
vrPointerDot.renderOrder = 999;
scene.add(vrPointerDot);

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderVRPanel() {
  const ctx = vrPanelCtx;
  const W = VR_PANEL_W, H = VR_PANEL_H;

  ctx.clearRect(0, 0, W, H);

  drawRoundRect(ctx, 0, 0, W, H, 20);
  ctx.fillStyle = 'rgba(14, 14, 30, 0.96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Drag handle indicator at top
  const handleY = 12;
  const handleW = 60;
  const handleH = 6;
  const handleX = (W - handleW) / 2;
  drawRoundRect(ctx, handleX, handleY, handleW, handleH, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  
  // Grip instruction text
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Grip para mover', W / 2, 22);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f0f0f5';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Acabados y Texturas', 30, 55);

  // Close button
  drawRoundRect(ctx, W - 65, 40, 48, 42, 10);
  ctx.fillStyle = 'rgba(239,154,154,0.12)';
  ctx.fill();
  ctx.fillStyle = '#ef9a9a';
  ctx.font = 'bold 26px system-ui';
  ctx.fillText('✕', W - 50, 64);
  vrPanelRegions.close = { x: W - 65, y: 40, w: 48, h: 42 };

  // Category chips
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  let cx = 30;
  vrPanelRegions.categories = [];
  CATALOG.forEach(cat => {
    const tw = ctx.measureText(cat.cat).width + 28;
    const isActive = cat.cat === vrPanelActiveCategory;

    drawRoundRect(ctx, cx, 90, tw, 32, 16);
    ctx.fillStyle = isActive ? 'rgba(100,181,246,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    if (isActive) {
      ctx.strokeStyle = 'rgba(100,181,246,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = isActive ? '#64B5F6' : 'rgba(255,255,255,0.5)';
    ctx.fillText(cat.cat, cx + 14, 106);

    vrPanelRegions.categories.push({ x: cx, y: 90, w: tw, h: 32, cat: cat.cat });
    cx += tw + 10;
  });

  const tiles = CATALOG.find(c => c.cat === vrPanelActiveCategory)?.tiles || [];
  const cols = 3, tileSize = 140, gap = 22, startX = 30, startY = 140;

  const selIndices = getSelectedMeshIndices();
  const appliedTileId = selIndices.length > 0
    ? appliedFinishes.get(meshParts[selIndices[0]]?.uuid)?.tile?.id
    : null;

  vrPanelRegions.tiles = [];
  tiles.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = startX + col * (tileSize + gap);
    const ty = startY + row * (tileSize + 40);

    const isApplied = tile.id === appliedTileId;
    if (isApplied) {
      drawRoundRect(ctx, tx - 5, ty - 5, tileSize + 10, tileSize + 10, 10);
      ctx.strokeStyle = 'rgba(100,181,246,0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const preview = generateTileCanvas(tile, 128);
    drawRoundRect(ctx, tx, ty, tileSize, tileSize, 8);
    ctx.save();
    ctx.clip();
    ctx.drawImage(preview, tx, ty, tileSize, tileSize);
    ctx.restore();

    drawRoundRect(ctx, tx, ty, tileSize, tileSize, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isApplied ? '#64B5F6' : 'rgba(255,255,255,0.6)';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(tile.name, tx, ty + tileSize + 8, tileSize);

    vrPanelRegions.tiles.push({ x: tx, y: ty, w: tileSize, h: tileSize + 25, tile });
  });

  const selLabel = selectedGroup
    ? `${selectedGroup.name} (${selectedGroup.meshIndices.length})`
    : (selectedMesh ? formatName(selectedMesh.name || 'Superficie') : '');
  if (selLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Aplicar a: ' + selLabel, 30, H - 16);
  }

  vrPanelTexture.needsUpdate = true;
}

function openVRPanel() {
  const xrCam = renderer.xr.getCamera();
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  xrCam.getWorldPosition(pos);
  xrCam.getWorldDirection(dir);

  dir.y = 0;
  dir.normalize();

  vrPanelMesh.position.copy(pos).addScaledVector(dir, 1.3);
  vrPanelMesh.position.y = pos.y - 0.05;
  vrPanelMesh.lookAt(pos.x, vrPanelMesh.position.y, pos.z);

  vrPanelMesh.visible = true;
  vrPanelVisible = true;
  renderVRPanel();
}

function closeVRPanel() {
  vrPanelMesh.visible = false;
  vrPanelVisible = false;
  vrPointerDot.visible = false;
}

function handleVRPanelHit(uv) {
  const x = uv.x * VR_PANEL_W;
  const y = (1 - uv.y) * VR_PANEL_H;

  const { close, categories, tiles } = vrPanelRegions;

  if (close && x >= close.x && x <= close.x + close.w && y >= close.y && y <= close.y + close.h) {
    closeVRPanel();
    return;
  }

  for (const r of categories) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      vrPanelActiveCategory = r.cat;
      renderVRPanel();
      return;
    }
  }

  for (const r of tiles) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      applyTileFinish(r.tile);
      renderVRPanel();
      return;
    }
  }
}

// ────────────────────────────────────────────
// WebXR: Interaction handlers
// ────────────────────────────────────────────
const _xrRaycaster = new THREE.Raycaster();
const _tempMatrix = new THREE.Matrix4();

function getXRRay(controller) {
  _tempMatrix.identity().extractRotation(controller.matrixWorld);
  _xrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _xrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_tempMatrix);
  return _xrRaycaster;
}

function onXRSelectStart(event) {
  if (!isInVR) return;
  const controller = event.target;
  const rc = getXRRay(controller);

  if (vrPanelVisible) {
    const panelHits = rc.intersectObject(vrPanelMesh);
    if (panelHits.length > 0) {
      handleVRPanelHit(panelHits[0].uv);
      return;
    }
  }

  if (loadedModel && meshParts.length > 0) {
    const hits = rc.intersectObjects(meshParts, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const index = meshParts.indexOf(hitMesh);
      if (index !== -1) {
        selectMeshAndShowFinishes(hitMesh, index);
        if (!vrPanelVisible) openVRPanel();
        else renderVRPanel();
      }
    }
  }
}

// ────────────────────────────────────────────
// Drag de interfaces VR (agarre con squeeze/grip)
// ────────────────────────────────────────────
const vrDragState = {
  active: false,
  mesh: null,
  controller: null,
  offsetMatrix: new THREE.Matrix4(),
};

function startDraggingMesh(mesh, controller) {
  vrDragState.active = true;
  vrDragState.mesh = mesh;
  vrDragState.controller = controller;
  mesh.userData.userMoved = true;

  const ctrlInv = new THREE.Matrix4().copy(controller.matrixWorld).invert();
  vrDragState.offsetMatrix.copy(mesh.matrixWorld).premultiply(ctrlInv);
  
  playUISound();
}

function stopDraggingMesh() {
  vrDragState.active = false;
  vrDragState.mesh = null;
  vrDragState.controller = null;
}

function updateVRDrag() {
  if (!vrDragState.active || !vrDragState.mesh || !vrDragState.controller) return;
  const m = new THREE.Matrix4().multiplyMatrices(
    vrDragState.controller.matrixWorld,
    vrDragState.offsetMatrix
  );
  m.decompose(vrDragState.mesh.position, vrDragState.mesh.quaternion, vrDragState.mesh.scale);
}

function onXRSqueezeStart(event) {
  if (!isInVR) return;
  const controller = event.target;
  const rc = getXRRay(controller);

  // Grab the VR panel if visible and pointing at it
  if (vrPanelVisible) {
    const panelHits = rc.intersectObject(vrPanelMesh);
    if (panelHits.length > 0) {
      startDraggingMesh(vrPanelMesh, controller);
      return;
    }
  }

  // If not grabbing the panel, toggle it
  if (vrPanelVisible) {
    closeVRPanel();
  } else if (selectedMesh || selectedGroup) {
    openVRPanel();
  }
}

function onXRSqueezeEnd() {
  if (vrDragState.active) stopDraggingMesh();
}

function updateVRPointer() {
  if (!isInVR || !vrPanelVisible) {
    vrPointerDot.visible = false;
    return;
  }

  for (const { ctrl } of xrControllers) {
    const rc = getXRRay(ctrl);
    const hits = rc.intersectObject(vrPanelMesh);
    if (hits.length > 0) {
      vrPointerDot.position.copy(hits[0].point);
      vrPointerDot.quaternion.copy(vrPanelMesh.quaternion);
      vrPointerDot.position.addScaledVector(vrPanelMesh.getWorldDirection(new THREE.Vector3()), 0.002);
      vrPointerDot.visible = true;
      return;
    }
  }
  vrPointerDot.visible = false;
}

// ────────────────────────────────────────────
// WebXR: Locomoción con thumbsticks (stick izq = mover, stick der = girar)
// ────────────────────────────────────────────
const _xrForward = new THREE.Vector3();
const _xrRight = new THREE.Vector3();
const _xrUp = new THREE.Vector3(0, 1, 0);
const _xrHeadQuat = new THREE.Quaternion();

function updateXRLocomotion(now) {
  if (!isInVR || !xrBaseReferenceSpace) return;

  const session = renderer.xr.getSession();
  if (!session) return;

  const dt = xrLastFrameTime ? Math.min(0.1, (now - xrLastFrameTime) / 1000) : 0;
  xrLastFrameTime = now;
  if (dt === 0) return;

  let moveX = 0, moveZ = 0, turnX = 0;

  for (const source of session.inputSources) {
    if (!source.gamepad) continue;
    const axes = source.gamepad.axes;
    if (!axes || axes.length < 4) continue;

    // Quest touch controllers: axes[2]=stick X, axes[3]=stick Y
    const sx = axes[2] || 0;
    const sy = axes[3] || 0;

    if (source.handedness === 'left') {
      if (Math.abs(sx) > XR_STICK_DEADZONE) moveX += sx;
      if (Math.abs(sy) > XR_STICK_DEADZONE) moveZ += sy;
    } else if (source.handedness === 'right') {
      if (Math.abs(sx) > XR_STICK_DEADZONE) turnX += sx;
    }
  }

  // Snap turn (stick derecho izq/der)
  if (xrSnapTurnReady && Math.abs(turnX) > 0.7) {
    xrYaw -= Math.sign(turnX) * XR_SNAP_ANGLE;
    xrSnapTurnReady = false;
  } else if (Math.abs(turnX) < 0.3) {
    xrSnapTurnReady = true;
  }

  // Movimiento relativo a la dirección de la cabeza
  if (moveX !== 0 || moveZ !== 0) {
    const xrCam = renderer.xr.getCamera();
    xrCam.getWorldQuaternion(_xrHeadQuat);
    _xrForward.set(0, 0, -1).applyQuaternion(_xrHeadQuat);
    _xrForward.y = 0;
    if (_xrForward.lengthSq() < 1e-6) _xrForward.set(0, 0, -1);
    _xrForward.normalize();
    _xrRight.crossVectors(_xrForward, _xrUp).normalize();

    const speed = XR_MOVE_SPEED * dt;
    const dx = (_xrForward.x * -moveZ + _xrRight.x * moveX) * speed;
    const dz = (_xrForward.z * -moveZ + _xrRight.z * moveX) * speed;

    // El offset del reference space va en sentido contrario al movimiento del jugador
    xrOffset.x -= dx;
    xrOffset.z -= dz;
  }

  // Aplica offset acumulado al reference space
  const quat = new THREE.Quaternion().setFromAxisAngle(_xrUp, xrYaw);
  const offsetTransform = new XRRigidTransform(
    { x: xrOffset.x, y: xrOffset.y, z: xrOffset.z, w: 1 },
    { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
  );
  const newRefSpace = xrBaseReferenceSpace.getOffsetReferenceSpace(offsetTransform);
  renderer.xr.setReferenceSpace(newRefSpace);
}

// ────────────────────────────────────────────
// GLTF Loader
// ────────────────────────────────────────────
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

// ────────────────────────────────────────────
// State
// ────────────────────────────────────────────
let loadedModel = null;
const meshParts = [];
const originalMaterials = new Map();
const appliedFinishes = new Map();
let selectedMesh = null;
let selectedIndex = -1;
let selectedGroup = null;
let meshGroups = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const highlightEdges = new THREE.LineBasicMaterial({ color: 0x64B5F6, linewidth: 2 });

let activeCategory = CATALOG[0].cat;
const uploadedTextures = [];

// ────────────────────────────────────────────
// Grouping logic
// ────────────────────────────────────────────
function computeGroups() {
  const groupMap = new Map();
  const ungrouped = [];

  meshParts.forEach((mesh, i) => {
    const rawName = (mesh.name || '').toLowerCase().replace(/_/g, ' ').replace(/\./g, ' ');

    let matched = false;
    for (const gk of GROUP_KEYWORDS) {
      if (gk.keywords.some(kw => rawName.includes(kw))) {
        if (!groupMap.has(gk.label)) {
          groupMap.set(gk.label, { name: gk.label, icon: gk.icon, meshIndices: [], expanded: true });
        }
        groupMap.get(gk.label).meshIndices.push(i);
        matched = true;
        break;
      }
    }

    if (!matched) ungrouped.push(i);
  });

  meshGroups = [];

  for (const [, group] of groupMap) {
    if (group.meshIndices.length >= 2) {
      meshGroups.push(group);
    } else {
      ungrouped.push(...group.meshIndices);
    }
  }

  ungrouped.sort((a, b) => a - b);

  ungrouped.forEach(i => {
    meshGroups.push({ name: null, icon: null, meshIndices: [i], expanded: true });
  });
}

function getSelectedMeshIndices() {
  if (selectedGroup) return [...selectedGroup.meshIndices];
  if (selectedIndex >= 0) return [selectedIndex];
  return [];
}

// ────────────────────────────────────────────
// File handling (3D model)
// ────────────────────────────────────────────
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadFile(file);
});

const browseBtn = document.querySelector('.browse-btn');
if (browseBtn) {
  browseBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

function loadFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'glb' && ext !== 'gltf') {
    alert('Formato no soportado. Usa archivos .glb o .gltf');
    return;
  }

  showLoading(true);
  const url = URL.createObjectURL(file);

  gltfLoader.load(
    url,
    (gltf) => {
      URL.revokeObjectURL(url);
      processModel(gltf, file.name);
      showLoading(false);
    },
    undefined,
    (error) => {
      URL.revokeObjectURL(url);
      showLoading(false);
      console.error('Error cargando modelo:', error);
      alert('Error al cargar el modelo. Asegúrate de que sea un archivo glTF/GLB válido.');
    }
  );
}

function showLoading(show) {
  loadingEl.classList.toggle('active', show);
}

// ────────────────────────────────────────────
// Process loaded model
// ────────────────────────────────────────────
function processModel(gltf, filename) {
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
  }

  meshParts.length = 0;
  originalMaterials.clear();
  appliedFinishes.clear();
  selectedMesh = null;
  selectedIndex = -1;
  selectedGroup = null;
  meshGroups = [];

  const model = gltf.scene;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        child.material.side = THREE.DoubleSide;
      }
      meshParts.push(child);
      originalMaterials.set(child.uuid, child.material.clone());
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 6 / maxDim;
  model.scale.multiplyScalar(scale);

  box.setFromObject(model);
  box.getCenter(center);
  model.position.sub(center);
  model.position.y -= box.min.y;

  loadedModel = model;
  scene.add(model);

  box.setFromObject(model);
  const newSize = box.getSize(new THREE.Vector3());
  const newCenter = box.getCenter(new THREE.Vector3());

  orbitControls.target.copy(newCenter);
  const dist = Math.max(newSize.x, newSize.y, newSize.z) * 2;
  camera.position.set(newCenter.x + dist * 0.8, newCenter.y + dist * 0.5, newCenter.z + dist * 0.8);
  orbitControls.update();

  computeGroups();
  buildControlsUI(filename);

  dropZone.classList.add('hidden');
  controlsEl.classList.add('active');
  hintEl.classList.add('active');

  partsSearch.value = '';
  showPartsView();

  initAudio();
  playAmbientMusic();
  
  const audioToggle = document.getElementById('audio-toggle');
  if (audioToggle) {
    audioToggle.classList.add('active');
  }

  setTimeout(() => { hintEl.style.opacity = '0'; }, 6000);
}

// ────────────────────────────────────────────
// Build parts list with groups
// ────────────────────────────────────────────
function buildControlsUI(filename) {
  document.getElementById('model-name').textContent = filename;

  const groupCount = meshGroups.filter(g => g.name).length;
  const totalParts = meshParts.length;
  document.getElementById('part-count').textContent =
    `${totalParts} superficie${totalParts !== 1 ? 's' : ''}` +
    (groupCount > 0 ? ` en ${groupCount} grupo${groupCount !== 1 ? 's' : ''}` : '');

  partsList.innerHTML = '';

  meshGroups.forEach((group, gi) => {
    const isGroup = group.name !== null;
    const wrapper = document.createElement('div');
    wrapper.className = 'part-group';
    wrapper.dataset.groupIndex = gi;
    wrapper.dataset.isGroup = isGroup;
    if (isGroup) wrapper.dataset.groupName = group.name.toLowerCase();

    if (isGroup) {
      const header = document.createElement('div');
      header.className = 'group-header';

      header.innerHTML = `
        <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span class="group-name">${group.name}</span>
        <span class="group-count">${group.meshIndices.length}</span>
        <button class="group-paint-btn" title="Aplicar acabado a todo el grupo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
      `;

      header.addEventListener('click', (e) => {
        if (e.target.closest('.group-paint-btn')) {
          selectGroupAndShowFinishes(group);
          return;
        }
        group.expanded = !group.expanded;
        wrapper.classList.toggle('collapsed', !group.expanded);
      });

      wrapper.appendChild(header);
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'group-items';

    group.meshIndices.forEach(mi => {
      const mesh = meshParts[mi];
      const name = mesh.name || `Parte_${mi + 1}`;
      const color = mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc';

      const item = document.createElement('div');
      item.className = 'color-group';
      item.dataset.meshIndex = mi;
      item.dataset.name = formatName(name).toLowerCase();
      item.setAttribute('role', 'listitem');

      item.innerHTML = `
        <label>
          <div class="wall-icon" style="background-color: ${color}"></div>
          <span class="part-name" title="${name}">${formatName(name)}</span>
          <span class="finish-label">Original</span>
        </label>
      `;

      item.addEventListener('click', () => {
        selectMeshAndShowFinishes(mesh, mi);
      });

      itemsContainer.appendChild(item);
    });

    wrapper.appendChild(itemsContainer);

    if (isGroup && !group.expanded) {
      wrapper.classList.add('collapsed');
    }

    partsList.appendChild(wrapper);
  });

  buildCatalogUI();
}

function formatName(name) {
  return name.replace(/_/g, ' ').replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

// ────────────────────────────────────────────
// Search / Filter
// ────────────────────────────────────────────
partsSearch.addEventListener('input', () => {
  const query = partsSearch.value.toLowerCase().trim();
  const groupEls = partsList.querySelectorAll('.part-group');
  let visibleCount = 0;

  groupEls.forEach(groupEl => {
    const isGroup = groupEl.dataset.isGroup === 'true';
    const groupName = (groupEl.dataset.groupName || '');
    const items = groupEl.querySelectorAll('.color-group');
    const header = groupEl.querySelector('.group-header');
    let anyVisible = false;

    const groupNameMatches = isGroup && groupName.includes(query);

    items.forEach(item => {
      const name = item.dataset.name || '';
      const matches = !query || name.includes(query) || groupNameMatches;
      item.classList.toggle('hidden-by-search', !matches);
      if (matches) {
        visibleCount++;
        anyVisible = true;
      }
    });

    if (header) header.style.display = anyVisible ? '' : 'none';
    groupEl.style.display = anyVisible ? '' : 'none';
  });

  const countEl = document.getElementById('part-count');
  if (query) {
    countEl.textContent = `${visibleCount} de ${meshParts.length} superficies`;
  } else {
    const groupCount = meshGroups.filter(g => g.name).length;
    countEl.textContent =
      `${meshParts.length} superficie${meshParts.length !== 1 ? 's' : ''}` +
      (groupCount > 0 ? ` en ${groupCount} grupo${groupCount !== 1 ? 's' : ''}` : '');
  }
});

// ────────────────────────────────────────────
// View switching
// ────────────────────────────────────────────
function showPartsView() {
  partsView.classList.remove('view-hidden');
  finishView.classList.add('view-hidden');
}

function showFinishView() {
  partsView.classList.add('view-hidden');
  finishView.classList.remove('view-hidden');
}

btnBack.addEventListener('click', () => {
  showPartsView();
  clearHighlight();
  partsList.querySelectorAll('.color-group.selected').forEach(el => el.classList.remove('selected'));
  partsList.querySelectorAll('.group-header.selected').forEach(el => el.classList.remove('selected'));
  selectedMesh = null;
  selectedIndex = -1;
  selectedGroup = null;
});

// ────────────────────────────────────────────
// Selection: individual mesh (auto-selects group if it belongs to one)
// ────────────────────────────────────────────
function findGroupForMesh(meshIndex) {
  return meshGroups.find(g => g.name !== null && g.meshIndices.includes(meshIndex)) || null;
}

function selectMeshAndShowFinishes(mesh, index) {
  const parentGroup = findGroupForMesh(index);
  if (parentGroup) {
    selectGroupAndShowFinishes(parentGroup);
    return;
  }

  partsList.querySelectorAll('.color-group.selected').forEach(el => el.classList.remove('selected'));
  partsList.querySelectorAll('.group-header.selected').forEach(el => el.classList.remove('selected'));
  clearHighlight();

  if (selectedMesh === mesh && !selectedGroup) {
    selectedMesh = null;
    selectedIndex = -1;
    selectedGroup = null;
    showPartsView();
    return;
  }

  selectedMesh = mesh;
  selectedIndex = index;
  selectedGroup = null;

  const itemEl = partsList.querySelector(`.color-group[data-mesh-index="${index}"]`);
  if (itemEl) itemEl.classList.add('selected');

  highlightMeshes([index]);

  const partName = mesh.name || `Parte_${index + 1}`;
  document.getElementById('selected-part-label').textContent = formatName(partName);

  updateSelectedPartPreview();
  showFinishView();
  highlightAppliedTile();

  playUISound();

  const currentColor = mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc';
  solidPicker.value = currentColor;
  colorHexLabel.textContent = currentColor.toUpperCase();
}

// ────────────────────────────────────────────
// Selection: entire group
// ────────────────────────────────────────────
function selectGroupAndShowFinishes(group) {
  partsList.querySelectorAll('.color-group.selected').forEach(el => el.classList.remove('selected'));
  partsList.querySelectorAll('.group-header.selected').forEach(el => el.classList.remove('selected'));
  clearHighlight();

  if (selectedGroup === group) {
    selectedGroup = null;
    selectedMesh = null;
    selectedIndex = -1;
    showPartsView();
    return;
  }

  selectedGroup = group;
  selectedMesh = meshParts[group.meshIndices[0]];
  selectedIndex = group.meshIndices[0];

  const gi = meshGroups.indexOf(group);
  const headerEl = partsList.querySelector(`.part-group[data-group-index="${gi}"] .group-header`);
  if (headerEl) headerEl.classList.add('selected');

  highlightMeshes(group.meshIndices);

  document.getElementById('selected-part-label').textContent =
    `${group.name} (${group.meshIndices.length} superficies)`;

  updateSelectedPartPreview();
  showFinishView();
  highlightAppliedTile();

  playUISound();

  const currentColor = selectedMesh?.material?.color ? '#' + selectedMesh.material.color.getHexString() : '#cccccc';
  solidPicker.value = currentColor;
  colorHexLabel.textContent = currentColor.toUpperCase();
}

// ────────────────────────────────────────────
// Highlight helpers
// ────────────────────────────────────────────
function clearHighlight() {
  scene.children
    .filter(c => c.userData.isHighlight)
    .forEach(c => scene.remove(c));
}

function highlightMeshes(indices) {
  clearHighlight();
  indices.forEach(i => {
    const mesh = meshParts[i];
    if (!mesh) return;
    const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
    const line = new THREE.LineSegments(edges, highlightEdges);
    line.userData.isHighlight = true;
    line.userData.sourceMesh = mesh;
    mesh.getWorldPosition(line.position);
    mesh.getWorldQuaternion(line.quaternion);
    mesh.getWorldScale(line.scale);
    scene.add(line);
  });
}

function updateSelectedPartPreview() {
  const preview = document.getElementById('selected-part-preview');
  const ref = selectedMesh;
  if (!ref) return;

  const finish = appliedFinishes.get(ref.uuid);
  if (finish?.type === 'tile') {
    preview.style.backgroundImage = `url(${getTilePreviewDataURL(finish.tile)})`;
    preview.style.backgroundColor = '';
  } else if (finish?.type === 'uploaded') {
    preview.style.backgroundImage = `url(${finish.dataURL})`;
    preview.style.backgroundColor = '';
  } else {
    preview.style.backgroundImage = '';
    const c = ref.material?.color;
    preview.style.backgroundColor = c ? '#' + c.getHexString() : '#cccccc';
  }
}

// ────────────────────────────────────────────
// Finish Tabs
// ────────────────────────────────────────────
document.querySelectorAll('.finish-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.finish-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`);
    if (panel) panel.classList.add('active');
  });
});

// ────────────────────────────────────────────
// Catalog UI
// ────────────────────────────────────────────
function buildCatalogUI() {
  categoryChips.innerHTML = '';
  CATALOG.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'category-chip' + (cat.cat === activeCategory ? ' active' : '');
    chip.textContent = cat.cat;
    chip.addEventListener('click', () => {
      activeCategory = cat.cat;
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderTileGrid();
    });
    categoryChips.appendChild(chip);
  });
  renderTileGrid();
}

function renderTileGrid() {
  tileGrid.innerHTML = '';
  const category = CATALOG.find(c => c.cat === activeCategory);
  if (!category) return;

  category.tiles.forEach(tile => {
    const item = document.createElement('button');
    item.className = 'tile-item';
    item.dataset.tileId = tile.id;
    const previewURL = getTilePreviewDataURL(tile);

    item.innerHTML = `
      <div class="tile-swatch">
        <img src="${previewURL}" alt="${tile.name}" style="width:100%;height:100%;display:block;">
        <div class="tile-check">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <span class="tile-name">${tile.name}</span>
    `;

    item.addEventListener('click', () => applyTileFinish(tile));
    tileGrid.appendChild(item);
  });

  highlightAppliedTile();
}

function highlightAppliedTile() {
  document.querySelectorAll('.tile-item').forEach(el => el.classList.remove('applied'));
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;

  const finish = appliedFinishes.get(meshParts[indices[0]].uuid);
  if (finish?.type === 'tile') {
    const el = document.querySelector(`.tile-item[data-tile-id="${finish.tile.id}"]`);
    if (el) el.classList.add('applied');
  }
}

// ────────────────────────────────────────────
// Apply finishes (supports group + individual)
// ────────────────────────────────────────────
const ROUGHNESS_MAP = {
  marble: 0.15, wood: 0.45, stone: 0.65, concrete: 0.85, solid: 0.3,
  brick: 0.85, metal: 0.25, fabric: 0.95, leather: 0.6, plaster: 0.8,
  ceramic: 0.2, rust: 0.9, asphalt: 0.95, glass: 0.05, moss: 0.9,
};

function applyTileFinish(tile) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;

  const previewURL = getTilePreviewDataURL(tile);
  const metalTypes = { metal: 0.85, rust: 0.3, glass: 0.1 };

  indices.forEach(i => {
    const mesh = meshParts[i];
    const { tex, norm } = buildMeshTextureSet(tile, mesh);
    mesh.material.map = tex;
    mesh.material.color.set(0xffffff);
    if ('normalMap' in mesh.material) {
      mesh.material.normalMap = norm;
      mesh.material.normalScale = new THREE.Vector2(0.6, 0.6);
    }
    if ('roughness' in mesh.material) mesh.material.roughness = ROUGHNESS_MAP[tile.type] ?? 0.5;
    if ('metalness' in mesh.material) mesh.material.metalness = metalTypes[tile.type] ?? 0.0;
    if (tile.type === 'glass' && 'transparent' in mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0.6;
    } else if ('transparent' in mesh.material) {
      mesh.material.transparent = false;
      mesh.material.opacity = 1.0;
    }
    mesh.material.needsUpdate = true;
    appliedFinishes.set(mesh.uuid, { type: 'tile', tile });
    updatePartListItemByIndex(i, tile.name, previewURL);
  });

  updateSelectedPartPreview();
  highlightAppliedTile();
}

function applyUploadedTexture(dataURL, texName) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;

  const img = new Image();
  img.onload = () => {
    const UPLOADED_WORLD_SIZE = 2.0;
    indices.forEach(i => {
      const mesh = meshParts[i];
      const texture = new THREE.Texture(img);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const { u, v } = getMeshSurfaceSize(mesh);
      texture.repeat.set(
        Math.max(0.25, u / UPLOADED_WORLD_SIZE),
        Math.max(0.25, v / UPLOADED_WORLD_SIZE)
      );
      texture.needsUpdate = true;

      mesh.material.map = texture;
      if ('normalMap' in mesh.material) mesh.material.normalMap = null;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
      appliedFinishes.set(mesh.uuid, { type: 'uploaded', dataURL, name: texName });
      updatePartListItemByIndex(i, texName, dataURL);
    });

    updateSelectedPartPreview();
    highlightUploadedTexture(dataURL);
  };
  img.src = dataURL;
}

function applySolidColor(hex) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;

  indices.forEach(i => {
    const mesh = meshParts[i];
    mesh.material.map = null;
    if ('normalMap' in mesh.material) mesh.material.normalMap = null;
    mesh.material.color.set(hex);
    mesh.material.needsUpdate = true;
    appliedFinishes.set(mesh.uuid, { type: 'color', hex });
    updatePartListItemByIndex(i, hex.toUpperCase(), null, hex);
  });

  updateSelectedPartPreview();
}

function updatePartListItemByIndex(meshIndex, label, bgImage, bgColor) {
  const el = partsList.querySelector(`.color-group[data-mesh-index="${meshIndex}"]`);
  if (!el) return;

  const icon = el.querySelector('.wall-icon');
  const finishLabel = el.querySelector('.finish-label');

  if (bgImage) {
    icon.style.backgroundImage = `url(${bgImage})`;
    icon.style.backgroundColor = '';
  } else {
    icon.style.backgroundImage = '';
    icon.style.backgroundColor = bgColor || '#cccccc';
  }

  if (finishLabel) finishLabel.textContent = label;
}

// ────────────────────────────────────────────
// Texture upload handling
// ────────────────────────────────────────────
textureInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleTextureFile(file);
  textureInput.value = '';
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', (e) => {
  e.stopPropagation();
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleTextureFile(file);
});

function handleTextureFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataURL = e.target.result;
    const texName = file.name.replace(/\.[^.]+$/, '');
    uploadedTextures.push({ dataURL, name: texName });
    renderUploadedTextures();
    applyUploadedTexture(dataURL, texName);
  };
  reader.readAsDataURL(file);
}

function renderUploadedTextures() {
  uploadedTexEl.innerHTML = '';
  uploadedTextures.forEach((tex, i) => {
    const item = document.createElement('div');
    item.className = 'uploaded-tex-item';
    item.dataset.index = i;
    item.innerHTML = `
      <img src="${tex.dataURL}" alt="${tex.name}">
      <button class="remove-tex" title="Eliminar">&times;</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.remove-tex')) {
        uploadedTextures.splice(i, 1);
        renderUploadedTextures();
        return;
      }
      applyUploadedTexture(tex.dataURL, tex.name);
    });
    uploadedTexEl.appendChild(item);
  });
  highlightUploadedTexture();
}

function highlightUploadedTexture(activeURL) {
  document.querySelectorAll('.uploaded-tex-item').forEach(el => el.classList.remove('applied'));
  const indices = getSelectedMeshIndices();
  if (indices.length === 0 || !activeURL) return;

  const finish = appliedFinishes.get(meshParts[indices[0]].uuid);
  if (finish?.type === 'uploaded') {
    uploadedTextures.forEach((tex, i) => {
      if (tex.dataURL === finish.dataURL) {
        const el = uploadedTexEl.children[i];
        if (el) el.classList.add('applied');
      }
    });
  }
}

// ────────────────────────────────────────────
// Solid color picker
// ────────────────────────────────────────────
solidPicker.addEventListener('input', (e) => {
  colorHexLabel.textContent = e.target.value.toUpperCase();
});

btnApplyColor.addEventListener('click', () => {
  applySolidColor(solidPicker.value);
});

// ────────────────────────────────────────────
// Raycasting (click to select mesh in 3D)
// ────────────────────────────────────────────
let isDragging = false;
let mouseDownPos = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseDownPos.set(e.clientX, e.clientY);
  isDragging = false;
});

renderer.domElement.addEventListener('pointermove', (e) => {
  const dx = e.clientX - mouseDownPos.x;
  const dy = e.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (isDragging || !loadedModel) return;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(meshParts, true);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const index = meshParts.indexOf(hitMesh);
    if (index !== -1) {
      selectMeshAndShowFinishes(hitMesh, index);
    }
  } else {
    clearHighlight();
    partsList.querySelectorAll('.color-group.selected').forEach(el => el.classList.remove('selected'));
    partsList.querySelectorAll('.group-header.selected').forEach(el => el.classList.remove('selected'));
    selectedMesh = null;
    selectedIndex = -1;
    selectedGroup = null;
    showPartsView();
  }
});

// ────────────────────────────────────────────
// Mobile panel toggle
// ────────────────────────────────────────────
panelToggle.addEventListener('click', () => {
  controlsEl.classList.remove('closing');
  controlsEl.classList.add('active');
  panelToggle.setAttribute('aria-expanded', 'true');
});

panelClose.addEventListener('click', () => {
  controlsEl.classList.add('closing');
  panelToggle.setAttribute('aria-expanded', 'false');
  controlsEl.addEventListener('animationend', function handler() {
    controlsEl.classList.remove('active', 'closing');
    controlsEl.removeEventListener('animationend', handler);
  });
});

// ────────────────────────────────────────────
// Action buttons
// ────────────────────────────────────────────
document.getElementById('btn-reset-colors').addEventListener('click', () => {
  meshParts.forEach((mesh, i) => {
    const orig = originalMaterials.get(mesh.uuid);
    if (orig) {
      mesh.material.color.copy(orig.color);
      mesh.material.map = orig.map;
      if ('normalMap' in mesh.material) mesh.material.normalMap = orig.normalMap || null;
      if ('roughness' in mesh.material) mesh.material.roughness = orig.roughness ?? 0.5;
      if ('metalness' in mesh.material) mesh.material.metalness = orig.metalness ?? 0;
      mesh.material.needsUpdate = true;
    }
    appliedFinishes.delete(mesh.uuid);
    updatePartListItemByIndex(i, 'Original', null, mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc');
  });

  if (selectedMesh || selectedGroup) {
    updateSelectedPartPreview();
    highlightAppliedTile();
  }
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const allTiles = CATALOG.flatMap(c => c.tiles);
  const metalTypes = { metal: 0.85, rust: 0.3, glass: 0.1 };

  meshParts.forEach((mesh, i) => {
    const tile = allTiles[Math.floor(Math.random() * allTiles.length)];
    const { tex, norm } = buildMeshTextureSet(tile, mesh);
    mesh.material.map = tex;
    mesh.material.color.set(0xffffff);
    if ('normalMap' in mesh.material) {
      mesh.material.normalMap = norm;
      mesh.material.normalScale = new THREE.Vector2(0.6, 0.6);
    }
    if ('roughness' in mesh.material) mesh.material.roughness = ROUGHNESS_MAP[tile.type] ?? 0.5;
    if ('metalness' in mesh.material) mesh.material.metalness = metalTypes[tile.type] ?? 0.0;
    mesh.material.needsUpdate = true;
    appliedFinishes.set(mesh.uuid, { type: 'tile', tile });
    updatePartListItemByIndex(i, tile.name, getTilePreviewDataURL(tile));
  });

  if (selectedMesh || selectedGroup) {
    updateSelectedPartPreview();
    highlightAppliedTile();
  }
});

document.getElementById('btn-load-new').addEventListener('click', () => {
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
  }
  clearHighlight();

  meshParts.length = 0;
  originalMaterials.clear();
  appliedFinishes.clear();
  selectedMesh = null;
  selectedIndex = -1;
  selectedGroup = null;
  meshGroups = [];
  partsSearch.value = '';
  uploadedTextures.length = 0;
  uploadedTexEl.innerHTML = '';

  controlsEl.classList.remove('active');
  hintEl.classList.remove('active');
  hintEl.style.opacity = '';
  dropZone.classList.remove('hidden');
  fileInput.value = '';
  panelToggle.setAttribute('aria-expanded', 'false');
  showPartsView();
  
  stopAmbientMusic();
  const audioToggle = document.getElementById('audio-toggle');
  if (audioToggle) {
    audioToggle.classList.remove('active');
  }
});

// ────────────────────────────────────────────
// Resize
// ────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ────────────────────────────────────────────
// Animation loop (setAnimationLoop for WebXR)
// ────────────────────────────────────────────
function animate(time) {
  scene.children
    .filter(c => c.userData.isHighlight)
    .forEach(c => {
      const src = c.userData.sourceMesh;
      if (src) {
        src.getWorldPosition(c.position);
        src.getWorldQuaternion(c.quaternion);
        src.getWorldScale(c.scale);
      }
    });

  if (isInVR) {
    updateXRLocomotion(time || performance.now());
    updateVRPointer();
    updateVRDrag();
  } else {
    orbitControls.update();
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// ────────────────────────────────────────────
// Load default model
// ────────────────────────────────────────────
const DEFAULT_MODEL = 'apto modelado.glb';

function loadDefaultModel() {
  showLoading(true);
  gltfLoader.load(
    DEFAULT_MODEL,
    (gltf) => {
      processModel(gltf, DEFAULT_MODEL);
      showLoading(false);
    },
    undefined,
    (error) => {
      showLoading(false);
      console.error('Error cargando modelo por defecto:', error);
      alert('No se pudo cargar el modelo de ejemplo. Asegúrate de que el archivo "' + DEFAULT_MODEL + '" esté en la misma carpeta.');
    }
  );
}

document.getElementById('btn-load-default').addEventListener('click', loadDefaultModel);

// ────────────────────────────────────────────
// Audio Toggle
// ────────────────────────────────────────────
const audioToggleBtn = document.getElementById('audio-toggle');
let audioMuted = false;

if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', () => {
    audioMuted = !audioMuted;
    audioToggleBtn.classList.toggle('muted', audioMuted);
    
    if (audioMuted) {
      setAmbientVolume(0);
      setUIVolume(0);
    } else {
      setAmbientVolume(0.3);
      setUIVolume(0.5);
    }
  });
}
