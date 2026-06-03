import * as THREE from 'three';
import { seededRandom, hashStr, hexToRgb, createNoise2D } from './noise.js';
import { DRAW_FN_MAP, drawSolid } from './drawers.js';

export const TEXTURE_SCALE = 15;

export const NORMAL_STRENGTH = {
  marble: 0.6, wood: 1.2, stone: 2.5, concrete: 1.8, solid: 0.2,
  brick: 3.0, metal: 0.4, fabric: 1.5, leather: 1.8, plaster: 1.2,
  ceramic: 0.5, rust: 2.2, asphalt: 2.0, glass: 0.15, moss: 2.0,
};

const textureCache = new Map();
const normalCache = new Map();

export function getMeshSurfaceSize(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  return { u: Math.max(dims[0], 0.1), v: Math.max(dims[1], 0.1) };
}

export function generateTileCanvas(tile, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(hashStr(tile.id));
  const noise = createNoise2D(rand);
  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;
  const base = hexToRgb(tile.base);
  const accent = hexToRgb(tile.accent);
  const drawFn = DRAW_FN_MAP[tile.type] || drawSolid;
  drawFn(d, size, base, accent, rand, noise);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function generateNormalFromCanvas(srcCanvas, strength) {
  const s = srcCanvas.width;
  const srcPx = srcCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(s, s);
  const od = out.data;
  const h = (px, py) => {
    px = ((px % s) + s) % s;
    py = ((py % s) + s) % s;
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
      od[i] = ((dx / len) * 0.5 + 0.5) * 255;
      od[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      od[i + 2] = ((dz / len) * 0.5 + 0.5) * 255;
      od[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

export function getTileTexture(tile) {
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

export function getTileNormalMap(tile) {
  if (!normalCache.has(tile.id)) getTileTexture(tile);
  return normalCache.get(tile.id);
}

export function buildMeshTextureSet(tile, mesh) {
  const baseTex = getTileTexture(tile);
  const baseNorm = getTileNormalMap(tile);
  const { u, v } = getMeshSurfaceSize(mesh);
  const ws = (tile.worldSize || 2.0) * TEXTURE_SCALE;
  const ru = Math.max(0.1, u / ws);
  const rv = Math.max(0.1, v / ws);

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

export function getTilePreviewDataURL(tile) {
  const key = tile.id + '_preview';
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = generateTileCanvas(tile, 128);
  const url = canvas.toDataURL();
  textureCache.set(key, url);
  return url;
}
