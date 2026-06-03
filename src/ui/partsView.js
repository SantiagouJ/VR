import { state } from '../state.js';
import { isMeshFinishesLocked, filterEditableMeshIndices } from '../model/sketchfab.js';
import { partsList, partsSearch } from './dom.js';

export function formatName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function updatePartListItemByIndex(meshIndex, label, bgImage, bgColor) {
  const el = partsList.querySelector(`.color-group[data-mesh-index="${meshIndex}"]`);
  if (!el) return;
  const icon = el.querySelector('.wall-icon');
  const finishLabel = el.querySelector('.finish-label');
  if (bgImage) {
    icon.style.backgroundImage = `url(${bgImage})`;
    icon.style.backgroundColor = '';
  } else {
    icon.style.backgroundImage = '';
    icon.style.backgroundColor = bgColor || '#cccccc';
  }
  if (finishLabel) finishLabel.textContent = label;
}

export function buildPartsList(onSelectMesh, onSelectGroup) {
  const filename = document.getElementById('model-name')?.textContent || '';
  const groupCount = state.meshGroups.filter((g) => g.name).length;
  const totalParts = state.meshParts.length;
  const countEl = document.getElementById('part-count');
  if (countEl) {
    countEl.textContent =
      `${totalParts} superficie${totalParts !== 1 ? 's' : ''}` +
      (groupCount > 0 ? ` en ${groupCount} grupo${groupCount !== 1 ? 's' : ''}` : '');
  }

  partsList.innerHTML = '';

  state.meshGroups.forEach((group, gi) => {
    const isGroup = group.name !== null;
    const wrapper = document.createElement('div');
    wrapper.className = 'part-group';
    wrapper.dataset.groupIndex = gi;
    wrapper.dataset.isGroup = isGroup;
    if (isGroup) wrapper.dataset.groupName = group.name.toLowerCase();

    if (isGroup) {
      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span class="group-name">${group.name}</span>
        <span class="group-count">${group.meshIndices.length}</span>
        <button class="group-paint-btn" title="Aplicar acabado a todo el grupo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
      `;
      header.addEventListener('click', (e) => {
        if (e.target.closest('.group-paint-btn')) {
          if (onSelectGroup) onSelectGroup(group);
          return;
        }
        group.expanded = !group.expanded;
        wrapper.classList.toggle('collapsed', !group.expanded);
      });
      wrapper.appendChild(header);

      const editableInGroup = filterEditableMeshIndices(group.meshIndices);
      const paintBtnEl = header.querySelector('.group-paint-btn');
      if (paintBtnEl) paintBtnEl.disabled = editableInGroup.length === 0;
    }

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'group-items';

    group.meshIndices.forEach((mi) => {
      const mesh = state.meshParts[mi];
      const name = mesh.name || `Parte_${mi + 1}`;
      const color = mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#cccccc';
      const sfLocked = isMeshFinishesLocked(mesh);

      const item = document.createElement('div');
      item.className = 'color-group';
      if (sfLocked) item.classList.add('mesh-finishes-locked');
      item.dataset.meshIndex = mi;
      item.dataset.name = formatName(name).toLowerCase();
      item.setAttribute('role', 'listitem');
      if (sfLocked) item.title = `${name} — Sketchfab (solo lectura)`;

      item.innerHTML = `
        <label>
          <div class="wall-icon" style="background-color: ${color}"></div>
          <span class="part-name" title="${name}">${formatName(name)}</span>
          <span class="finish-label">Original</span>
        </label>
      `;

      item.addEventListener('click', () => {
        if (isMeshFinishesLocked(mesh)) return;
        if (onSelectMesh) onSelectMesh(mesh, mi);
      });

      itemsContainer.appendChild(item);
    });

    wrapper.appendChild(itemsContainer);
    if (isGroup && !group.expanded) wrapper.classList.add('collapsed');
    partsList.appendChild(wrapper);
  });
}

export function initPartsSearch() {
  partsSearch.addEventListener('input', () => {
    const query = partsSearch.value.toLowerCase().trim();
    const groupEls = partsList.querySelectorAll('.part-group');
    let visibleCount = 0;

    groupEls.forEach((groupEl) => {
      const isGroup = groupEl.dataset.isGroup === 'true';
      const groupName = groupEl.dataset.groupName || '';
      const items = groupEl.querySelectorAll('.color-group');
      const header = groupEl.querySelector('.group-header');
      let anyVisible = false;
      const groupNameMatches = isGroup && groupName.includes(query);

      items.forEach((item) => {
        const name = item.dataset.name || '';
        const matches = !query || name.includes(query) || groupNameMatches;
        item.classList.toggle('hidden-by-search', !matches);
        if (matches) { visibleCount++; anyVisible = true; }
      });

      if (header) header.style.display = anyVisible ? '' : 'none';
      groupEl.style.display = anyVisible ? '' : 'none';
    });

    const countEl = document.getElementById('part-count');
    if (!countEl) return;
    if (query) {
      countEl.textContent = `${visibleCount} de ${state.meshParts.length} superficies`;
    } else {
      const groupCount = state.meshGroups.filter((g) => g.name).length;
      countEl.textContent =
        `${state.meshParts.length} superficie${state.meshParts.length !== 1 ? 's' : ''}` +
        (groupCount > 0 ? ` en ${groupCount} grupo${groupCount !== 1 ? 's' : ''}` : '');
    }
  });
}
