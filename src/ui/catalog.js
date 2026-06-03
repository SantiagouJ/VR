import { state } from '../state.js';
import { getFilteredCategories } from '../catalog/utils.js';
import { getTilePreviewDataURL } from '../textures/cache.js';
import { getSelectedMeshIndices } from '../model/groups.js';
import { categoryChips, tileGrid } from './dom.js';

export function renderTileGrid(onApplyTile) {
  tileGrid.innerHTML = '';
  const filteredCatalog = getFilteredCategories();
  const category = filteredCatalog.find((c) => c.cat === state.activeCategory);
  if (!category) return;

  category.tiles.forEach((tile) => {
    const item = document.createElement('button');
    item.className = 'tile-item';
    item.dataset.tileId = tile.id;
    const previewURL = getTilePreviewDataURL(tile);
    item.innerHTML = `
      <div class="tile-swatch">
        <img src="${previewURL}" alt="${tile.name}" style="width:100%;height:100%;display:block;">
        <div class="tile-check">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <span class="tile-name">${tile.name}</span>
    `;
    item.addEventListener('click', () => { if (onApplyTile) onApplyTile(tile); });
    tileGrid.appendChild(item);
  });

  highlightAppliedTile();
}

export function highlightAppliedTile() {
  document.querySelectorAll('.tile-item').forEach((el) => el.classList.remove('applied'));
  const indices = getSelectedMeshIndices();
  if (indices.length === 0) return;
  const finish = state.appliedFinishes.get(state.meshParts[indices[0]].uuid);
  if (finish?.type === 'tile') {
    const el = document.querySelector(`.tile-item[data-tile-id="${finish.tile.id}"]`);
    if (el) el.classList.add('applied');
  }
}

export function updateFilteredCatalogUI(onApplyTile) {
  categoryChips.innerHTML = '';
  const filteredCatalog = getFilteredCategories();

  if (!filteredCatalog.find((c) => c.cat === state.activeCategory)) {
    state.activeCategory = filteredCatalog.length > 0 ? filteredCatalog[0].cat : null;
  }

  const surfaceType = (() => {
    if (state.selectedGroup?.name) return state.selectedGroup.name;
    return null;
  })();

  if (surfaceType) {
    const indicator = document.createElement('div');
    indicator.className = 'surface-indicator';
    indicator.innerHTML = `<span class="surface-label">Materiales para: <strong>${surfaceType}</strong></span>`;
    categoryChips.appendChild(indicator);
  }

  filteredCatalog.forEach((cat) => {
    const chip = document.createElement('button');
    chip.className = 'category-chip' + (cat.cat === state.activeCategory ? ' active' : '');
    chip.textContent = cat.cat;
    chip.addEventListener('click', () => {
      state.activeCategory = cat.cat;
      document.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderTileGrid(onApplyTile);
    });
    categoryChips.appendChild(chip);
  });

  renderTileGrid(onApplyTile);
}
