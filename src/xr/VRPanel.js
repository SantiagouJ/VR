import * as THREE from 'three';
import { scene, renderer } from '../scene/setup.js';
import { state } from '../state.js';
import { getFilteredCategories, getSelectedSurfaceType } from '../catalog/utils.js';
import { generateTileCanvas } from '../textures/cache.js';
import { getSelectedMeshIndices } from '../model/groups.js';

const VR_PANEL_W = 800;
const VR_PANEL_H = 640;
const VR_PANEL_SCALE_X = 0.62;
const VR_PANEL_SCALE_Y = VR_PANEL_SCALE_X * (VR_PANEL_H / VR_PANEL_W);
const VR_LEFT_PANEL_LOCAL_POS = new THREE.Vector3(0, 0.06, -0.11);
const VR_LEFT_PANEL_LOCAL_EULER = new THREE.Euler(-0.4, 0, 0);

export let vrPanelVisible = false;
export let vrPanelActiveCategory = null;
const vrPanelRegions = { close: null, categories: [], tiles: [] };

let _onApplyTile = null;

const vrPanelCanvas = document.createElement('canvas');
vrPanelCanvas.width = VR_PANEL_W;
vrPanelCanvas.height = VR_PANEL_H;
const vrPanelCtx = vrPanelCanvas.getContext('2d');

const vrPanelTexture = new THREE.CanvasTexture(vrPanelCanvas);
vrPanelTexture.colorSpace = THREE.SRGBColorSpace;

export const vrPanelMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(VR_PANEL_SCALE_X, VR_PANEL_SCALE_Y),
  new THREE.MeshBasicMaterial({ map: vrPanelTexture, transparent: true, side: THREE.DoubleSide }),
);
vrPanelMesh.visible = false;
vrPanelMesh.userData.isVRPanel = true;
scene.add(vrPanelMesh);

export const vrPointerDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.006, 16),
  new THREE.MeshBasicMaterial({ color: 0x64b5f6, depthTest: false }),
);
vrPointerDot.visible = false;
vrPointerDot.renderOrder = 999;
scene.add(vrPointerDot);

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderVRPanel() {
  const ctx = vrPanelCtx;
  const W = VR_PANEL_W, H = VR_PANEL_H;
  ctx.clearRect(0, 0, W, H);

  drawRoundRect(ctx, 0, 0, W, H, 20);
  ctx.fillStyle = 'rgba(14, 14, 30, 0.96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundRect(ctx, (W - 60) / 2, 12, 60, 6, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Grip para mover', W / 2, 22);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f0f0f5';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Acabados y Texturas', 30, 55);

  drawRoundRect(ctx, W - 65, 40, 48, 42, 10);
  ctx.fillStyle = 'rgba(239,154,154,0.12)';
  ctx.fill();
  ctx.fillStyle = '#ef9a9a';
  ctx.font = 'bold 26px system-ui';
  ctx.fillText('✕', W - 50, 64);
  vrPanelRegions.close = { x: W - 65, y: 40, w: 48, h: 42 };

  const surfaceType = getSelectedSurfaceType();
  if (surfaceType) {
    ctx.fillStyle = 'rgba(100,181,246,0.4)';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Materiales para: ${surfaceType}`, 30, 80);
  }

  const filteredCatalog = getFilteredCategories();
  if (!filteredCatalog.find((c) => c.cat === vrPanelActiveCategory)) {
    vrPanelActiveCategory = filteredCatalog.length > 0 ? filteredCatalog[0].cat : null;
  }

  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  let cx = 30;
  vrPanelRegions.categories = [];
  filteredCatalog.forEach((cat) => {
    const tw = ctx.measureText(cat.cat).width + 28;
    const isActive = cat.cat === vrPanelActiveCategory;
    drawRoundRect(ctx, cx, 100, tw, 32, 16);
    ctx.fillStyle = isActive ? 'rgba(100,181,246,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    if (isActive) {
      ctx.strokeStyle = 'rgba(100,181,246,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = isActive ? '#64B5F6' : 'rgba(255,255,255,0.5)';
    ctx.fillText(cat.cat, cx + 14, 116);
    vrPanelRegions.categories.push({ x: cx, y: 100, w: tw, h: 32, cat: cat.cat });
    cx += tw + 10;
  });

  const tiles = filteredCatalog.find((c) => c.cat === vrPanelActiveCategory)?.tiles || [];
  const cols = 3, tileSize = 140, gap = 22, startX = 30, startY = 150;

  const selIndices = getSelectedMeshIndices();
  const appliedTileId = selIndices.length > 0
    ? state.appliedFinishes.get(state.meshParts[selIndices[0]]?.uuid)?.tile?.id
    : null;

  vrPanelRegions.tiles = [];
  tiles.forEach((tile, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const tx = startX + col * (tileSize + gap);
    const ty = startY + row * (tileSize + 40);
    const isApplied = tile.id === appliedTileId;

    if (isApplied) {
      drawRoundRect(ctx, tx - 5, ty - 5, tileSize + 10, tileSize + 10, 10);
      ctx.strokeStyle = 'rgba(100,181,246,0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const preview = generateTileCanvas(tile, 128);
    drawRoundRect(ctx, tx, ty, tileSize, tileSize, 8);
    ctx.save();
    ctx.clip();
    ctx.drawImage(preview, tx, ty, tileSize, tileSize);
    ctx.restore();

    drawRoundRect(ctx, tx, ty, tileSize, tileSize, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isApplied ? '#64B5F6' : 'rgba(255,255,255,0.6)';
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(tile.name, tx, ty + tileSize + 8, tileSize);
    vrPanelRegions.tiles.push({ x: tx, y: ty, w: tileSize, h: tileSize + 25, tile });
  });

  const selLabel = state.selectedGroup
    ? `${state.selectedGroup.name} (${state.selectedGroup.meshIndices.length})`
    : state.selectedMesh
      ? (state.selectedMesh.name || 'Superficie')
      : '';
  if (selLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Aplicar a: ' + selLabel, 30, H - 16);
  }

  vrPanelTexture.needsUpdate = true;
}

export function initVRPanel({ onApplyTile }) {
  _onApplyTile = onApplyTile;
}

function getXRControllerEntry(xrControllers, handedness) {
  return xrControllers.find(({ ctrl }) => ctrl.userData.handedness === handedness) || null;
}

export function attachVRPanelToLeftHand(xrControllers) {
  const entry = getXRControllerEntry(xrControllers, 'left');
  if (!entry) return false;
  const parent = entry.grip;
  if (vrPanelMesh.parent !== parent) parent.add(vrPanelMesh);
  vrPanelMesh.position.copy(VR_LEFT_PANEL_LOCAL_POS);
  vrPanelMesh.rotation.copy(VR_LEFT_PANEL_LOCAL_EULER);
  return true;
}

function detachVRPanelFromController() {
  if (vrPanelMesh.parent && vrPanelMesh.parent !== scene) scene.attach(vrPanelMesh);
}

export function openVRPanel(xrControllers) {
  vrPanelMesh.userData.userMoved = false;
  if (!attachVRPanelToLeftHand(xrControllers)) {
    const xrCam = renderer.xr.getCamera();
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    xrCam.getWorldPosition(pos);
    xrCam.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    detachVRPanelFromController();
    vrPanelMesh.position.copy(pos).addScaledVector(dir, 1.3);
    vrPanelMesh.position.y = pos.y - 0.05;
    vrPanelMesh.lookAt(pos.x, vrPanelMesh.position.y, pos.z);
  }
  vrPanelMesh.visible = true;
  vrPanelVisible = true;
  renderVRPanel();
}

export function closeVRPanel() {
  detachVRPanelFromController();
  vrPanelMesh.visible = false;
  vrPanelVisible = false;
  vrPointerDot.visible = false;
}

export function handleVRPanelHit(uv, xrControllers) {
  const x = uv.x * VR_PANEL_W;
  const y = (1 - uv.y) * VR_PANEL_H;
  const { close, categories, tiles } = vrPanelRegions;

  if (close && x >= close.x && x <= close.x + close.w && y >= close.y && y <= close.y + close.h) {
    closeVRPanel();
    return 'close';
  }

  for (const r of categories) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      vrPanelActiveCategory = r.cat;
      renderVRPanel();
      return 'category';
    }
  }

  for (const r of tiles) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (_onApplyTile) _onApplyTile(r.tile);
      renderVRPanel();
      return 'tile';
    }
  }

  return null;
}
