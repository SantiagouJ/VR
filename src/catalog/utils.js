import { CATALOG, GROUP_KEYWORDS, SURFACE_MATERIALS } from './data.js';
import { state } from '../state.js';

export function getSurfaceType(meshName) {
  if (!meshName) return null;
  const rawName = meshName.toLowerCase().replace(/_/g, ' ').replace(/\./g, ' ');
  for (const gk of GROUP_KEYWORDS) {
    if (gk.keywords.some((kw) => rawName.includes(kw))) return gk.label;
  }
  return null;
}

export function getSelectedSurfaceType() {
  if (state.selectedGroup?.name) return state.selectedGroup.name;
  if (state.selectedMesh) return getSurfaceType(state.selectedMesh.name);
  return null;
}

export function getFilteredCategories() {
  const surfaceType = getSelectedSurfaceType();
  const allowed = SURFACE_MATERIALS[surfaceType] || SURFACE_MATERIALS['default'];
  return CATALOG.filter((cat) => allowed.includes(cat.cat));
}
