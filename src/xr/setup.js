import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { scene, renderer, orbitControls } from '../scene/setup.js';
import { state } from '../state.js';
import {
  vrPanelVisible, vrPanelMesh, vrPointerDot,
  openVRPanel, closeVRPanel, renderVRPanel,
  handleVRPanelHit, attachVRPanelToLeftHand,
} from './VRPanel.js';
import {
  vrTutorialVisible, vrTutorialMesh,
  openVRTutorial, closeVRTutorial, handleVRTutorialHit,
} from './VRTutorial.js';
import { resetLocomotionState, clearLocomotionState, updateXRLocomotion } from './locomotion.js';

const controllerModelFactory = new XRControllerModelFactory();
const handModelFactory = new XRHandModelFactory();

const _xrRaycaster = new THREE.Raycaster();
const _tempMatrix = new THREE.Matrix4();

let _onSelectMesh = null;
let _onEnsureAudio = null;
let _onSessionStart = null;
let _onSessionEnd = null;

export let xrControllers = [];

const vrDragState = {
  active: false,
  mesh: null,
  controller: null,
  offsetMatrix: new THREE.Matrix4(),
};

function getXRRay(controller) {
  _tempMatrix.identity().extractRotation(controller.matrixWorld);
  _xrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _xrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_tempMatrix);
  return _xrRaycaster;
}

function onXRSelectStart(event) {
  if (!state.isInVR) return;
  if (_onEnsureAudio && !state.audioMuted) _onEnsureAudio();
  const controller = event.target;
  const rc = getXRRay(controller);

  if (vrTutorialVisible) {
    const hits = rc.intersectObject(vrTutorialMesh);
    if (hits.length > 0 && handleVRTutorialHit(hits[0].uv)) return;
  }

  if (vrPanelVisible) {
    const hits = rc.intersectObject(vrPanelMesh);
    if (hits.length > 0) {
      handleVRPanelHit(hits[0].uv, xrControllers);
      return;
    }
  }

  if (state.loadedModel && state.meshParts.length > 0) {
    const hits = rc.intersectObjects(state.meshParts, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const index = state.meshParts.indexOf(hitMesh);
      if (index !== -1 && _onSelectMesh) {
        _onSelectMesh(hitMesh, index);
        if (!vrPanelVisible) openVRPanel(xrControllers);
        else renderVRPanel();
      }
    }
  }
}

function startDraggingMesh(mesh, controller) {
  if (mesh.parent && mesh.parent !== scene) scene.attach(mesh);
  vrDragState.active = true;
  vrDragState.mesh = mesh;
  vrDragState.controller = controller;
  mesh.userData.userMoved = true;
  const ctrlInv = new THREE.Matrix4().copy(controller.matrixWorld).invert();
  vrDragState.offsetMatrix.copy(mesh.matrixWorld).premultiply(ctrlInv);
}

function stopDraggingMesh() {
  vrDragState.active = false;
  vrDragState.mesh = null;
  vrDragState.controller = null;
}

function onXRSqueezeStart(event) {
  if (!state.isInVR) return;
  if (_onEnsureAudio && !state.audioMuted) _onEnsureAudio();
  const controller = event.target;
  const rc = getXRRay(controller);

  if (vrPanelVisible) {
    const hits = rc.intersectObject(vrPanelMesh);
    if (hits.length > 0) { startDraggingMesh(vrPanelMesh, controller); return; }
  }

  if (vrPanelVisible) closeVRPanel();
  else if (state.selectedMesh || state.selectedGroup) openVRPanel(xrControllers);
}

function onXRSqueezeEnd() {
  if (vrDragState.active) stopDraggingMesh();
}

export function updateVRDrag() {
  if (!vrDragState.active || !vrDragState.mesh || !vrDragState.controller) return;
  const m = new THREE.Matrix4().multiplyMatrices(vrDragState.controller.matrixWorld, vrDragState.offsetMatrix);
  m.decompose(vrDragState.mesh.position, vrDragState.mesh.quaternion, vrDragState.mesh.scale);
}

export function updateVRPointer() {
  if (!state.isInVR || (!vrPanelVisible && !vrTutorialVisible)) {
    vrPointerDot.visible = false;
    return;
  }
  for (const { ctrl } of xrControllers) {
    const rc = getXRRay(ctrl);
    if (vrTutorialVisible) {
      const hits = rc.intersectObject(vrTutorialMesh);
      if (hits.length > 0) {
        vrPointerDot.position.copy(hits[0].point);
        vrPointerDot.quaternion.copy(vrTutorialMesh.quaternion);
        vrPointerDot.position.addScaledVector(vrTutorialMesh.getWorldDirection(new THREE.Vector3()), 0.002);
        vrPointerDot.visible = true;
        return;
      }
    }
    if (vrPanelVisible) {
      const hits = rc.intersectObject(vrPanelMesh);
      if (hits.length > 0) {
        vrPointerDot.position.copy(hits[0].point);
        vrPointerDot.quaternion.copy(vrPanelMesh.quaternion);
        vrPointerDot.position.addScaledVector(vrPanelMesh.getWorldDirection(new THREE.Vector3()), 0.002);
        vrPointerDot.visible = true;
        return;
      }
    }
  }
  vrPointerDot.visible = false;
}

export function setupXR({ onSelectMesh, onEnsureAudio, onSessionStart, onSessionEnd }) {
  _onSelectMesh = onSelectMesh;
  _onEnsureAudio = onEnsureAudio;
  _onSessionStart = onSessionStart;
  _onSessionEnd = onSessionEnd;

  renderer.xr.addEventListener('sessionstart', async () => {
    state.isInVR = true;
    orbitControls.enabled = false;
    resetLocomotionState();
    if (_onSessionStart) await _onSessionStart();

    setTimeout(() => {
      if (!state.audioMuted && _onEnsureAudio) _onEnsureAudio();
    }, 250);

    if (state.loadedModel) {
      setTimeout(() => openVRTutorial(), 500);
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    state.isInVR = false;
    orbitControls.enabled = true;
    closeVRPanel();
    closeVRTutorial();
    clearLocomotionState();
    if (_onSessionEnd) _onSessionEnd();
  });

  xrControllers = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    ctrl.userData.index = i;
    scene.add(ctrl);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    scene.add(grip);

    const hand = renderer.xr.getHand(i);
    hand.add(handModelFactory.createHandModel(hand, 'mesh'));
    scene.add(hand);

    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4),
    ]);
    const ray = new THREE.Line(
      rayGeo,
      new THREE.LineBasicMaterial({ color: 0x64b5f6, transparent: true, opacity: 0.6 }),
    );
    ray.visible = false;
    ctrl.add(ray);

    ctrl.addEventListener('connected', (e) => {
      ray.visible = e.data.targetRayMode === 'tracked-pointer' || e.data.hand != null;
      ctrl.userData.handedness = e.data.handedness || null;
    });
    ctrl.addEventListener('disconnected', () => {
      ray.visible = false;
      ctrl.userData.handedness = null;
    });
    ctrl.addEventListener('selectstart', onXRSelectStart);
    ctrl.addEventListener('squeezestart', onXRSqueezeStart);
    ctrl.addEventListener('squeezeend', onXRSqueezeEnd);

    return { ctrl, grip, hand, ray };
  });
}

export function isVRDragActive() { return vrDragState.active; }

export { updateXRLocomotion, openVRPanel, attachVRPanelToLeftHand };
