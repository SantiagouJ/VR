import { state } from '../state.js';
import { getSelectedMeshIndices } from '../model/groups.js';
import { textureInput, uploadArea, uploadedTexEl } from './dom.js';

export function highlightUploadedTexture() {
  document.querySelectorAll('.uploaded-tex-item').forEach((el) => el.classList.remove('applied'));
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;
  const finish = state.appliedFinishes.get(state.meshParts[indices[0]].uuid);
  if (finish?.type === 'uploaded') {
    state.uploadedTextures.forEach((tex, i) => {
      if (tex.dataURL === finish.dataURL) {
        const el = uploadedTexEl.children[i];
        if (el) el.classList.add('applied');
      }
    });
  }
}

export function renderUploadedTextures(onApplyTexture) {
  uploadedTexEl.innerHTML = '';
  state.uploadedTextures.forEach((tex, i) => {
    const item = document.createElement('div');
    item.className = 'uploaded-tex-item';
    item.dataset.index = i;
    item.innerHTML = `
      <img src="${tex.dataURL}" alt="${tex.name}">
      <button class="remove-tex" title="Eliminar">&times;</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.remove-tex')) {
        state.uploadedTextures.splice(i, 1);
        renderUploadedTextures(onApplyTexture);
        return;
      }
      if (onApplyTexture) onApplyTexture(tex.dataURL, tex.name);
    });
    uploadedTexEl.appendChild(item);
  });
  highlightUploadedTexture();
}

export function initTextureUpload(onApplyTexture) {
  function handleTextureFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target.result;
      const texName = file.name.replace(/\.[^.]+$/, '');
      state.uploadedTextures.push({ dataURL, name: texName });
      renderUploadedTextures(onApplyTexture);
      if (onApplyTexture) onApplyTexture(dataURL, texName);
    };
    reader.readAsDataURL(file);
  }

  textureInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleTextureFile(file);
    textureInput.value = '';
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleTextureFile(file);
  });
}
