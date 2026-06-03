import * as THREE from 'three';
import { state } from '../state.js';
import { buildMeshTextureSet, getTilePreviewDataURL, TEXTURE_SCALE, getMeshSurfaceSize } from '../textures/cache.js';
import { getSelectedMeshIndices } from '../model/groups.js';
import { isMeshFinishesLocked } from '../model/sketchfab.js';

export const ROUGHNESS_MAP = {
  marble: 0.15, wood: 0.45, stone: 0.65, concrete: 0.85, solid: 0.3,
  brick: 0.85, metal: 0.25, fabric: 0.95, leather: 0.6, plaster: 0.8,
  ceramic: 0.2, rust: 0.9, asphalt: 0.95, glass: 0.05, moss: 0.9,
};

const METAL_TYPES = { metal: 0.85, rust: 0.3, glass: 0.1 };

export function applyTileFinish(tile) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return { indices: [], previewURL: null };
  const previewURL = getTilePreviewDataURL(tile);

  indices.forEach((i) => {
    const mesh = state.meshParts[i];
    const { tex, norm } = buildMeshTextureSet(tile, mesh);
    mesh.material.map = tex;
    mesh.material.color.set(0xffffff);
    if ('normalMap' in mesh.material) {
      mesh.material.normalMap = norm;
      mesh.material.normalScale = new THREE.Vector2(0.6, 0.6);
    }
    if ('roughness' in mesh.material) mesh.material.roughness = ROUGHNESS_MAP[tile.type] ?? 0.5;
    if ('metalness' in mesh.material) mesh.material.metalness = METAL_TYPES[tile.type] ?? 0.0;
    if (tile.type === 'glass' && 'transparent' in mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0.6;
    } else if ('transparent' in mesh.material) {
      mesh.material.transparent = false;
      mesh.material.opacity = 1.0;
    }
    mesh.material.needsUpdate = true;
    state.appliedFinishes.set(mesh.uuid, { type: 'tile', tile });
  });

  return { indices, previewURL, tileName: tile.name };
}

export function applyUploadedTexture(dataURL, texName) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return Promise.resolve({ indices: [] });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const UPLOADED_WORLD_SIZE = 2.0 * TEXTURE_SCALE;
      indices.forEach((i) => {
        const mesh = state.meshParts[i];
        const texture = new THREE.Texture(img);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const { u, v } = getMeshSurfaceSize(mesh);
        texture.repeat.set(Math.max(0.1, u / UPLOADED_WORLD_SIZE), Math.max(0.1, v / UPLOADED_WORLD_SIZE));
        texture.needsUpdate = true;
        mesh.material.map = texture;
        if ('normalMap' in mesh.material) mesh.material.normalMap = null;
        mesh.material.color.set(0xffffff);
        mesh.material.needsUpdate = true;
        state.appliedFinishes.set(mesh.uuid, { type: 'uploaded', dataURL, name: texName });
      });
      resolve({ indices, dataURL, texName });
    };
    img.src = dataURL;
  });
}

export function applySolidColor(hex) {
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return { indices: [] };

  indices.forEach((i) => {
    const mesh = state.meshParts[i];
    mesh.material.map = null;
    if ('normalMap' in mesh.material) mesh.material.normalMap = null;
    mesh.material.color.set(hex);
    mesh.material.needsUpdate = true;
    state.appliedFinishes.set(mesh.uuid, { type: 'color', hex });
  });

  return { indices, hex };
}

export function resetAllFinishes() {
  state.meshParts.forEach((mesh) => {
    if (isMeshFinishesLocked(mesh)) return;
    const orig = state.originalMaterials.get(mesh.uuid);
    if (orig) {
      mesh.material.color.copy(orig.color);
      mesh.material.map = orig.map;
      if ('normalMap' in mesh.material) mesh.material.normalMap = orig.normalMap || null;
      if ('roughness' in mesh.material) mesh.material.roughness = orig.roughness ?? 0.5;
      if ('metalness' in mesh.material) mesh.material.metalness = orig.metalness ?? 0;
      mesh.material.needsUpdate = true;
    }
    state.appliedFinishes.delete(mesh.uuid);
  });
}

export function randomizeAllFinishes(allTiles) {
  state.meshParts.forEach((mesh) => {
    if (isMeshFinishesLocked(mesh)) return;
    const tile = allTiles[Math.floor(Math.random() * allTiles.length)];
    const { tex, norm } = buildMeshTextureSet(tile, mesh);
    mesh.material.map = tex;
    mesh.material.color.set(0xffffff);
    if ('normalMap' in mesh.material) {
      mesh.material.normalMap = norm;
      mesh.material.normalScale = new THREE.Vector2(0.6, 0.6);
    }
    if ('roughness' in mesh.material) mesh.material.roughness = ROUGHNESS_MAP[tile.type] ?? 0.5;
    if ('metalness' in mesh.material) mesh.material.metalness = METAL_TYPES[tile.type] ?? 0.0;
    mesh.material.needsUpdate = true;
    state.appliedFinishes.set(mesh.uuid, { type: 'tile', tile });
  });
}
