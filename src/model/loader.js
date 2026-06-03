import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { scene, camera, orbitControls } from '../scene/setup.js';
import { state } from '../state.js';
import { detectSketchfabGltf } from './sketchfab.js';
import { invalidateCollisionMeshes } from '../xr/collision.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/');

export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

export const DEFAULT_MODEL = '/apto.glb';

export function loadFile(file, onSuccess, onError) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'glb' && ext !== 'gltf') {
    alert('Formato no soportado. Usa archivos .glb o .gltf');
    return;
  }
  const url = URL.createObjectURL(file);
  gltfLoader.load(
    url,
    (gltf) => { URL.revokeObjectURL(url); onSuccess(gltf, file.name); },
    undefined,
    (err) => { URL.revokeObjectURL(url); onError(err); },
  );
}

export function loadDefaultModel(onSuccess, onError) {
  gltfLoader.load(DEFAULT_MODEL, (gltf) => onSuccess(gltf, DEFAULT_MODEL), undefined, onError);
}

export function processModel(gltf, filename) {
  if (state.loadedModel) {
    scene.remove(state.loadedModel);
    state.loadedModel = null;
  }
  invalidateCollisionMeshes();

  state.meshParts.length = 0;
  state.originalMaterials.clear();
  state.appliedFinishes.clear();
  state.selectedMesh = null;
  state.selectedIndex = -1;
  state.selectedGroup = null;
  state.meshGroups = [];

  state.modelFinishesLocked = detectSketchfabGltf(gltf, filename);

  const model = gltf.scene;
  model.userData.finishesLocked = state.modelFinishesLocked;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material = child.material.clone();
        child.material.side = THREE.DoubleSide;
      }
      state.meshParts.push(child);
      state.originalMaterials.set(child.uuid, child.material.clone());
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

  state.loadedModel = model;
  scene.add(model);
  invalidateCollisionMeshes();

  box.setFromObject(model);
  const newSize = box.getSize(new THREE.Vector3());
  const newCenter = box.getCenter(new THREE.Vector3());

  orbitControls.target.copy(newCenter);
  const dist = Math.max(newSize.x, newSize.y, newSize.z) * 2;
  camera.position.set(
    newCenter.x + dist * 0.8,
    newCenter.y + dist * 0.5,
    newCenter.z + dist * 0.8,
  );
  orbitControls.update();
}
