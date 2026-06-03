import * as THREE from 'three';
import { state } from './state.js';
import { CATALOG } from './catalog/data.js';

// Scene
import { renderer, scene, camera, orbitControls } from './scene/setup.js';
import { clearHighlight, highlightMeshes, updateHighlightTransforms } from './scene/highlight.js';

// Audio
import {
  initAudio, playAmbientMusic, stopAmbientMusic,
  playUISelectSound, playUICloseSound,
  setAmbientMixForVR, setAmbientVolume, setUIVolume,
  unlockAudioContext, ensureAudioFromXRGesture,
  DEFAULT_AMBIENT_VOLUME, VR_AMBIENT_VOLUME, DEFAULT_UI_VOLUME,
} from './audio/AudioSystem.js';

// Model
import { loadFile, loadDefaultModel, processModel } from './model/loader.js';
import { computeGroups, findGroupForMesh } from './model/groups.js';
import { isMeshFinishesLocked } from './model/sketchfab.js';

// Finishes
import { applyTileFinish, applyUploadedTexture, applySolidColor, resetAllFinishes, randomizeAllFinishes } from './finishes/apply.js';
import { getTilePreviewDataURL } from './textures/cache.js';

// XR
import { setupXR, updateVRDrag, updateVRPointer, isVRDragActive, xrControllers } from './xr/setup.js';
import { updateXRLocomotion } from './xr/locomotion.js';
import { vrPanelVisible, vrPanelMesh, attachVRPanelToLeftHand, openVRPanel, renderVRPanel, initVRPanel } from './xr/VRPanel.js';

// UI
import {
  dropZone, fileInput, controlsEl, hintEl,
  panelToggle, panelClose, partsSearch, solidPicker,
  colorHexLabel, btnApplyColor, audioToggleBtn,
} from './ui/dom.js';
import { showLoading } from './ui/loading.js';
import { showPartsView, showFinishView, updateSelectedPartPreview, initFinishTabs } from './ui/finishView.js';
import { buildPartsList, initPartsSearch, updatePartListItemByIndex, formatName } from './ui/partsView.js';
import { updateFilteredCatalogUI, highlightAppliedTile, renderTileGrid } from './ui/catalog.js';
import { initTextureUpload, renderUploadedTextures, highlightUploadedTexture } from './ui/upload.js';
import { updateFinishesLockedUI } from './ui/lockedUI.js';

// ─── Selection ────────────────────────────────────────────────────────────────

function clearSelectionHighlight() {
  document.querySelectorAll('#parts-list .color-group.selected').forEach((el) => el.classList.remove('selected'));
  document.querySelectorAll('#parts-list .group-header.selected').forEach((el) => el.classList.remove('selected'));
  clearHighlight();
}

function onApplyTile(tile) {
  const result = applyTileFinish(tile);
  result.indices.forEach((i) => updatePartListItemByIndex(i, result.tileName, result.previewURL));
  updateSelectedPartPreview();
  highlightAppliedTile();
  playUISelectSound();
  if (state.isInVR) renderVRPanel();
}

function onApplyUploadedTexture(dataURL, texName) {
  applyUploadedTexture(dataURL, texName).then((result) => {
    result.indices.forEach((i) => updatePartListItemByIndex(i, texName, dataURL));
    updateSelectedPartPreview();
    highlightUploadedTexture();
  });
}

function onApplyColor(hex) {
  const result = applySolidColor(hex);
  result.indices.forEach((i) => updatePartListItemByIndex(i, hex.toUpperCase(), null, hex));
  updateSelectedPartPreview();
}

function selectMesh(mesh, index) {
  if (isMeshFinishesLocked(mesh)) return;

  const parentGroup = findGroupForMesh(index);
  if (parentGroup) { selectGroup(parentGroup); return; }

  clearSelectionHighlight();

  if (state.selectedMesh === mesh && !state.selectedGroup) {
    state.selectedMesh = null;
    state.selectedIndex = -1;
    state.selectedGroup = null;
    showPartsView();
    return;
  }

  state.selectedMesh = mesh;
  state.selectedIndex = index;
  state.selectedGroup = null;

  const itemEl = document.querySelector(`#parts-list .color-group[data-mesh-index="${index}"]`);
  if (itemEl) itemEl.classList.add('selected');

  highlightMeshes([index]);

  const partName = mesh.name || `Parte_${index + 1}`;
  document.getElementById('selected-part-label').textContent = formatName(partName);

  updateSelectedPartPreview();
  showFinishView();
  updateFilteredCatalogUI(onApplyTile);
  highlightAppliedTile();
  playUISelectSound();

  const currentColor = mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc';
  solidPicker.value = currentColor;
  colorHexLabel.textContent = currentColor.toUpperCase();
}

function selectGroup(group) {
  if (state.modelFinishesLocked) return;
  const editableIdx = group.meshIndices.filter((i) => state.meshParts[i] && !isMeshFinishesLocked(state.meshParts[i]));
  if (editableIdx.length === 0) return;

  clearSelectionHighlight();

  if (state.selectedGroup === group) {
    state.selectedGroup = null;
    state.selectedMesh = null;
    state.selectedIndex = -1;
    showPartsView();
    return;
  }

  state.selectedGroup = group;
  state.selectedMesh = state.meshParts[editableIdx[0]];
  state.selectedIndex = editableIdx[0];

  const gi = state.meshGroups.indexOf(group);
  const headerEl = document.querySelector(`#parts-list .part-group[data-group-index="${gi}"] .group-header`);
  if (headerEl) headerEl.classList.add('selected');

  highlightMeshes(editableIdx);

  document.getElementById('selected-part-label').textContent =
    `${group.name} (${group.meshIndices.length} superficies)`;

  updateSelectedPartPreview();
  showFinishView();
  updateFilteredCatalogUI(onApplyTile);
  highlightAppliedTile();
  playUISelectSound();

  const currentColor = state.selectedMesh?.material?.color
    ? '#' + state.selectedMesh.material.color.getHexString()
    : '#cccccc';
  solidPicker.value = currentColor;
  colorHexLabel.textContent = currentColor.toUpperCase();
}

// ─── Model load ───────────────────────────────────────────────────────────────

function afterModelLoaded(gltf, filename) {
  processModel(gltf, filename);
  computeGroups();

  document.getElementById('model-name').textContent = filename;
  buildPartsList(selectMesh, selectGroup);
  initPartsSearch();
  updateFilteredCatalogUI(onApplyTile);
  updateFinishesLockedUI();

  dropZone.classList.add('hidden');
  controlsEl.classList.add('active');
  hintEl.classList.add('active');
  partsSearch.value = '';
  showPartsView();

  initAudio();
  playAmbientMusic();
  audioToggleBtn?.classList.add('active');

  setTimeout(() => { hintEl.style.opacity = '0'; }, 6000);
  showLoading(false);
}

function onLoadError(err) {
  console.error('Error cargando modelo:', err);
  showLoading(false);
  alert('Error al cargar el modelo. Asegúrate de que sea un archivo glTF/GLB válido.');
}

// ─── File input / drop zone ───────────────────────────────────────────────────

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) { showLoading(true); loadFile(file, afterModelLoaded, onLoadError); }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) { showLoading(true); loadFile(file, afterModelLoaded, onLoadError); }
});

const browseBtn = document.querySelector('.browse-btn');
if (browseBtn) {
  browseBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
}

document.getElementById('btn-load-default').addEventListener('click', () => {
  showLoading(true);
  loadDefaultModel(afterModelLoaded, onLoadError);
});

// ─── Panel toggle (mobile) ────────────────────────────────────────────────────

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

// ─── Back button ──────────────────────────────────────────────────────────────

document.getElementById('btn-back').addEventListener('click', () => {
  showPartsView();
  clearSelectionHighlight();
  state.selectedMesh = null;
  state.selectedIndex = -1;
  state.selectedGroup = null;
});

// ─── Color picker ─────────────────────────────────────────────────────────────

solidPicker.addEventListener('input', (e) => {
  colorHexLabel.textContent = e.target.value.toUpperCase();
});

btnApplyColor.addEventListener('click', () => onApplyColor(solidPicker.value));

// ─── Texture upload ───────────────────────────────────────────────────────────

initTextureUpload((dataURL, texName) => onApplyUploadedTexture(dataURL, texName));

// ─── Finish tabs ──────────────────────────────────────────────────────────────

initFinishTabs();

// ─── Action buttons ───────────────────────────────────────────────────────────

document.getElementById('btn-reset-colors').addEventListener('click', () => {
  resetAllFinishes();
  state.meshParts.forEach((mesh, i) => {
    const color = mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc';
    updatePartListItemByIndex(i, 'Original', null, color);
  });
  if (state.selectedMesh || state.selectedGroup) {
    updateSelectedPartPreview();
    highlightAppliedTile();
  }
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const allTiles = CATALOG.flatMap((c) => c.tiles);
  randomizeAllFinishes(allTiles);
  state.meshParts.forEach((mesh, i) => {
    const finish = state.appliedFinishes.get(mesh.uuid);
    if (finish?.type === 'tile') {
      updatePartListItemByIndex(i, finish.tile.name, getTilePreviewDataURL(finish.tile));
    }
  });
  if (state.selectedMesh || state.selectedGroup) {
    updateSelectedPartPreview();
    highlightAppliedTile();
  }
});

document.getElementById('btn-load-new').addEventListener('click', () => {
  if (state.loadedModel) {
    scene.remove(state.loadedModel);
    state.loadedModel = null;
  }
  clearHighlight();
  state.meshParts.length = 0;
  state.originalMaterials.clear();
  state.appliedFinishes.clear();
  state.selectedMesh = null;
  state.selectedIndex = -1;
  state.selectedGroup = null;
  state.meshGroups = [];
  state.uploadedTextures.length = 0;
  document.getElementById('uploaded-textures').innerHTML = '';
  partsSearch.value = '';

  controlsEl.classList.remove('active');
  hintEl.classList.remove('active');
  hintEl.style.opacity = '';
  dropZone.classList.remove('hidden');
  fileInput.value = '';
  panelToggle.setAttribute('aria-expanded', 'false');
  showPartsView();

  stopAmbientMusic();
  audioToggleBtn?.classList.remove('active');
  state.modelFinishesLocked = false;
  updateFinishesLockedUI();
});

// ─── Mouse raycasting ─────────────────────────────────────────────────────────

let isDragging = false;
const mouseDownPos = new THREE.Vector2();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

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
  if (isDragging || !state.loadedModel) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(state.meshParts, true);
  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const index = state.meshParts.indexOf(hitMesh);
    if (index !== -1 && !isMeshFinishesLocked(hitMesh)) selectMesh(hitMesh, index);
  } else {
    clearSelectionHighlight();
    state.selectedMesh = null;
    state.selectedIndex = -1;
    state.selectedGroup = null;
    showPartsView();
  }
});

// ─── Audio toggle ─────────────────────────────────────────────────────────────

if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', () => {
    state.audioMuted = !state.audioMuted;
    audioToggleBtn.classList.toggle('muted', state.audioMuted);
    if (state.audioMuted) {
      setAmbientVolume(0);
      setUIVolume(0);
    } else {
      setAmbientVolume(state.isInVR ? VR_AMBIENT_VOLUME : DEFAULT_AMBIENT_VOLUME);
      setUIVolume(DEFAULT_UI_VOLUME);
    }
  });
}

// ─── XR Setup ─────────────────────────────────────────────────────────────────

initVRPanel({ onApplyTile });

setupXR({
  onSelectMesh: selectMesh,
  onEnsureAudio: ensureAudioFromXRGesture,
  onSessionStart: async () => {
    await unlockAudioContext();
    if (state.loadedModel && !state.isInVR) playAmbientMusic();
    setAmbientMixForVR(true);
  },
  onSessionEnd: () => setAmbientMixForVR(false),
});

// ─── Render loop ──────────────────────────────────────────────────────────────

renderer.setAnimationLoop((time, frame) => {
  updateHighlightTransforms();

  if (state.isInVR) {
    updateXRLocomotion(time || performance.now(), frame);
    if (vrPanelVisible && !isVRDragActive() && !vrPanelMesh.userData.userMoved) {
      attachVRPanelToLeftHand(xrControllers);
    }
    updateVRPointer();
    updateVRDrag();
  } else {
    orbitControls.update();
  }

  renderer.render(scene, camera);
});

// ─── Initial UI state ─────────────────────────────────────────────────────────

updateFinishesLockedUI();
