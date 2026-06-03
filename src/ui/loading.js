import { loadingEl } from './dom.js';

export function showLoading(show) {
  loadingEl.classList.toggle('active', show);
}
