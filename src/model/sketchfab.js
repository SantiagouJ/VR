import { state } from '../state.js';

export function detectSketchfabGltf(gltf, filename) {
  const asset = gltf?.asset || gltf?.parser?.json?.asset || {};
  const gen = typeof asset.generator === 'string' ? asset.generator : '';
  const copyright = typeof asset.copyright === 'string' ? asset.copyright : '';
  if (/sketchfab/i.test(gen) || /sketchfab/i.test(copyright)) return true;
  if (filename && /sketchfab/i.test(String(filename))) return true;
  return false;
}

export function hasSketchfabAncestor(obj) {
  let o = obj;
  while (o) {
    if (/sketchfab/i.test(o.name || '')) return true;
    o = o.parent;
  }
  return false;
}

export function isMeshFinishesLocked(mesh) {
  if (!mesh) return false;
  if (state.modelFinishesLocked) return true;
  return hasSketchfabAncestor(mesh);
}

export function filterEditableMeshIndices(indices) {
  return indices.filter((i) => state.meshParts[i] && !isMeshFinishesLocked(state.meshParts[i]));
}

export function sceneHasSketchfabHierarchyMeshes() {
  return state.meshParts.some((m) => hasSketchfabAncestor(m));
}
