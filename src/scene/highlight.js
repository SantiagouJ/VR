import * as THREE from 'three';
import { scene } from './setup.js';
import { state } from '../state.js';
import { isMeshFinishesLocked } from '../model/sketchfab.js';

const highlightMaterial = new THREE.LineBasicMaterial({ color: 0x64b5f6, linewidth: 2 });

export function clearHighlight() {
  scene.children
    .filter((c) => c.userData.isHighlight)
    .forEach((c) => scene.remove(c));
}

export function highlightMeshes(indices) {
  clearHighlight();
  indices.forEach((i) => {
    const mesh = state.meshParts[i];
    if (!mesh || isMeshFinishesLocked(mesh)) return;
    const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
    const line = new THREE.LineSegments(edges, highlightMaterial);
    line.userData.isHighlight = true;
    line.userData.sourceMesh = mesh;
    mesh.getWorldPosition(line.position);
    mesh.getWorldQuaternion(line.quaternion);
    mesh.getWorldScale(line.scale);
    scene.add(line);
  });
}

export function updateHighlightTransforms() {
  scene.children
    .filter((c) => c.userData.isHighlight)
    .forEach((c) => {
      const src = c.userData.sourceMesh;
      if (src) {
        src.getWorldPosition(c.position);
        src.getWorldQuaternion(c.quaternion);
        src.getWorldScale(c.scale);
      }
    });
}
