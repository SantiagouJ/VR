import { state } from '../state.js';
import { getTilePreviewDataURL } from '../textures/cache.js';
import { partsView, finishView } from './dom.js';

export function showPartsView() {
  partsView.classList.remove('view-hidden');
  finishView.classList.add('view-hidden');
}

export function showFinishView() {
  partsView.classList.add('view-hidden');
  finishView.classList.remove('view-hidden');
}

export function updateSelectedPartPreview() {
  const preview = document.getElementById('selected-part-preview');
  const ref = state.selectedMesh;
  if (!ref) return;
  const finish = state.appliedFinishes.get(ref.uuid);
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

export function initFinishTabs() {
  document.querySelectorAll('.finish-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.finish-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      const panel = document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.classList.add('active');
    });
  });
}
