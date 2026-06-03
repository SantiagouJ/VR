import * as THREE from 'three';
import { scene, renderer } from '../scene/setup.js';

const VR_TUTORIAL_W = 760;
const VR_TUTORIAL_H = 560;
const VR_TUTORIAL_SCALE_X = 0.72;
const VR_TUTORIAL_SCALE_Y = VR_TUTORIAL_SCALE_X * (VR_TUTORIAL_H / VR_TUTORIAL_W);

export let vrTutorialVisible = false;
let vrTutorialDismissRegion = null;

const vrTutorialCanvas = document.createElement('canvas');
vrTutorialCanvas.width = VR_TUTORIAL_W;
vrTutorialCanvas.height = VR_TUTORIAL_H;
const vrTutorialCtx = vrTutorialCanvas.getContext('2d');

const vrTutorialTexture = new THREE.CanvasTexture(vrTutorialCanvas);
vrTutorialTexture.colorSpace = THREE.SRGBColorSpace;

export const vrTutorialMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(VR_TUTORIAL_SCALE_X, VR_TUTORIAL_SCALE_Y),
  new THREE.MeshBasicMaterial({ map: vrTutorialTexture, transparent: true, side: THREE.DoubleSide }),
);
vrTutorialMesh.visible = false;
vrTutorialMesh.userData.isVRTutorial = true;
scene.add(vrTutorialMesh);

function renderVRTutorial() {
  const ctx = vrTutorialCtx;
  const W = VR_TUTORIAL_W, H = VR_TUTORIAL_H;
  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fillStyle = 'rgba(14, 14, 30, 0.98)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 181, 246, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#64B5F6';
  ctx.font = 'bold 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Controles VR - Meta Quest 3', W / 2, 42);

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(42, 76);
  ctx.lineTo(W - 42, 76);
  ctx.stroke();

  const controls = [
    { icon: '🎯', title: 'Trigger (Gatillo)', desc: 'Seleccionar superficies y elementos del menú' },
    { icon: '✊', title: 'Grip (Agarre)', desc: 'Sostener y mover el panel de materiales' },
    { icon: '🕹️', title: 'Stick Izquierdo', desc: 'Moverte por el apartamento (con colisión con paredes)' },
    { icon: '🔄', title: 'Stick Derecho', desc: 'Girar la cámara (rotación suave)' },
    { icon: '📋', title: 'Panel de acabados', desc: 'Aparece en la mano izquierda al seleccionar una superficie' },
    { icon: '👆', title: 'Apuntar', desc: 'Apunta a superficies para ver el rayo láser' },
  ];

  ctx.textAlign = 'left';
  let y = 106;
  controls.forEach((ctrl) => {
    ctx.font = '26px sans-serif';
    ctx.fillText(ctrl.icon, 44, y + 16);
    ctx.fillStyle = '#f0f0f5';
    ctx.font = 'bold 19px Inter, system-ui, sans-serif';
    ctx.fillText(ctrl.title, 100, y + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '15px Inter, system-ui, sans-serif';
    ctx.fillText(ctrl.desc, 100, y + 33);
    y += 58;
  });

  const btnW = 220, btnH = 50;
  const btnX = (W - btnW) / 2, btnY = H - 86;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 12);
  ctx.fillStyle = 'rgba(100, 181, 246, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(100, 181, 246, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#64B5F6';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Entendido', W / 2, btnY + btnH / 2 + 2);
  vrTutorialDismissRegion = { x: btnX, y: btnY, w: btnW, h: btnH };

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText('Presiona Trigger en "Entendido" para cerrar', W / 2, H - 24);

  vrTutorialTexture.needsUpdate = true;
}

export function openVRTutorial() {
  const xrCam = renderer.xr.getCamera();
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  xrCam.getWorldPosition(pos);
  xrCam.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  vrTutorialMesh.position.copy(pos).addScaledVector(dir, 1.45);
  vrTutorialMesh.position.y = pos.y + 0.03;
  vrTutorialMesh.lookAt(pos.x, vrTutorialMesh.position.y, pos.z);
  vrTutorialMesh.visible = true;
  vrTutorialVisible = true;
  renderVRTutorial();
}

export function closeVRTutorial() {
  vrTutorialMesh.visible = false;
  vrTutorialVisible = false;
}

export function handleVRTutorialHit(uv, onClose) {
  const x = uv.x * VR_TUTORIAL_W;
  const y = (1 - uv.y) * VR_TUTORIAL_H;
  if (vrTutorialDismissRegion) {
    const r = vrTutorialDismissRegion;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      closeVRTutorial();
      if (onClose) onClose();
      return true;
    }
  }
  return false;
}
