import { state } from '../state.js';
import { isMeshFinishesLocked, sceneHasSketchfabHierarchyMeshes } from '../model/sketchfab.js';
import {
  controlsEl, sketchfabLockNotice, panelSubtitleEl,
  solidPicker, textureInput, btnApplyColor, partsSearch, uploadArea,
} from './dom.js';

export function updateFinishesLockedUI() {
  const fullFileLocked = state.modelFinishesLocked;
  const partialSketchfab = !fullFileLocked && sceneHasSketchfabHierarchyMeshes();
  const noEditableMeshes = state.meshParts.length > 0 && state.meshParts.every((m) => isMeshFinishesLocked(m));
  const blockFinishTools = fullFileLocked || noEditableMeshes;

  controlsEl?.classList.toggle('finishes-locked', blockFinishTools);
  controlsEl?.classList.toggle('has-sketchfab-parts', partialSketchfab);

  if (sketchfabLockNotice) {
    sketchfabLockNotice.hidden = !(fullFileLocked || partialSketchfab || noEditableMeshes);
    sketchfabLockNotice.textContent = fullFileLocked
      ? 'Los GLB exportados desde Sketchfab se muestran sin editar acabados.'
      : noEditableMeshes
        ? 'Todas las superficies son Sketchfab: no se pueden aplicar acabados.'
        : 'Las piezas bajo objetos Sketchfab (p. ej. Sketchfab_model) no admiten acabados; el resto sí.';
  }

  if (panelSubtitleEl) {
    if (fullFileLocked || noEditableMeshes) {
      panelSubtitleEl.textContent = 'Modelo Sketchfab: solo lectura (sin cambiar acabados).';
    } else if (partialSketchfab) {
      panelSubtitleEl.textContent = 'Selecciona una superficie editable (no Sketchfab) para cambiar su acabado.';
    } else {
      panelSubtitleEl.textContent = 'Selecciona una superficie para cambiar su acabado';
    }
  }

  const resetBtn = document.getElementById('btn-reset-colors');
  const randBtn = document.getElementById('btn-randomize');
  if (resetBtn) resetBtn.disabled = blockFinishTools;
  if (randBtn) randBtn.disabled = blockFinishTools;
  if (solidPicker) solidPicker.disabled = blockFinishTools;
  if (textureInput) textureInput.disabled = blockFinishTools;
  if (btnApplyColor) btnApplyColor.disabled = blockFinishTools;
  if (partsSearch) partsSearch.disabled = blockFinishTools;
  if (uploadArea) uploadArea.classList.toggle('disabled', blockFinishTools);

  document.querySelectorAll('.finish-tab').forEach((tab) => {
    tab.disabled = blockFinishTools;
    tab.setAttribute('aria-disabled', blockFinishTools ? 'true' : 'false');
  });
}
