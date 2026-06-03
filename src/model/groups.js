import { GROUP_KEYWORDS } from '../catalog/data.js';
import { state } from '../state.js';
import { filterEditableMeshIndices } from './sketchfab.js';

export function computeGroups() {
  const groupMap = new Map();
  const ungrouped = [];

  state.meshParts.forEach((mesh, i) => {
    const rawName = (mesh.name || '').toLowerCase().replace(/_/g, ' ').replace(/\./g, ' ');
    let matched = false;
    for (const gk of GROUP_KEYWORDS) {
      if (gk.keywords.some((kw) => rawName.includes(kw))) {
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

  state.meshGroups = [];

  for (const [, group] of groupMap) {
    if (group.meshIndices.length >= 2) {
      state.meshGroups.push(group);
    } else {
      ungrouped.push(...group.meshIndices);
    }
  }

  ungrouped.sort((a, b) => a - b);
  ungrouped.forEach((i) => {
    state.meshGroups.push({ name: null, icon: null, meshIndices: [i], expanded: true });
  });
}

export function getSelectedMeshIndices() {
  let raw = [];
  if (state.selectedGroup) raw = [...state.selectedGroup.meshIndices];
  else if (state.selectedIndex >= 0) raw = [state.selectedIndex];
  else return [];
  return filterEditableMeshIndices(raw);
}

export function findGroupForMesh(meshIndex) {
  return state.meshGroups.find((g) => g.name !== null && g.meshIndices.includes(meshIndex)) || null;
}
