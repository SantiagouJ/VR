import * as THREE from 'three';
import { renderer } from '../scene/setup.js';
import { state } from '../state.js';
import { checkVRCollision } from './collision.js';

export const VR_MOVE_SPEED = 2.0;
export const VR_TURN_SPEED = 2.2;
export const VR_STICK_DEADZONE = 0.18;
export const VR_MOVE_SUBSTEP = 0.04;
export const VR_HEIGHT_OFFSET = 0.7;

export let xrBaseReferenceSpace = null;
export const xrPlayerPos = new THREE.Vector3(0, 0, 0);
export let xrYaw = 0;
export let xrLastFrameTime = 0;

export function resetLocomotionState() {
  xrBaseReferenceSpace = renderer.xr.getReferenceSpace();
  xrPlayerPos.set(0, VR_HEIGHT_OFFSET, 0);
  xrYaw = 0;
  xrLastFrameTime = 0;
}

export function clearLocomotionState() {
  xrBaseReferenceSpace = null;
}

const _xrForward = new THREE.Vector3();
const _xrRight = new THREE.Vector3();
const _xrUp = new THREE.Vector3(0, 1, 0);
const _xrHeadQuat = new THREE.Quaternion();

function readXRStickInput(session) {
  let moveX = 0, moveZ = 0, turnX = 0;
  for (const source of session.inputSources) {
    if (!source.gamepad) continue;
    const axes = source.gamepad.axes;
    if (!axes || axes.length < 4) continue;
    const sx = axes[2] || 0, sy = axes[3] || 0;
    if (source.handedness === 'left') {
      if (Math.abs(sx) > VR_STICK_DEADZONE) moveX += sx;
      if (Math.abs(sy) > VR_STICK_DEADZONE) moveZ += sy;
    } else if (source.handedness === 'right') {
      if (Math.abs(sx) > VR_STICK_DEADZONE) turnX += sx;
    }
  }
  return { moveX, moveZ, turnX };
}

function getXRMoveDirectionWorld(moveX, moveZ, headOrientation) {
  _xrHeadQuat.set(headOrientation.x, headOrientation.y, headOrientation.z, headOrientation.w);
  _xrForward.set(0, 0, -1).applyQuaternion(_xrHeadQuat);
  _xrForward.y = 0;
  if (_xrForward.lengthSq() < 1e-6) _xrForward.set(0, 0, -1);
  else _xrForward.normalize();
  _xrRight.crossVectors(_xrForward, _xrUp).normalize();
  return {
    x: _xrForward.x * -moveZ + _xrRight.x * moveX,
    z: _xrForward.z * -moveZ + _xrRight.z * moveX,
  };
}

function applyXRMoveWorld(dx, dz) {
  if (dx === 0 && dz === 0) return;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / VR_MOVE_SUBSTEP));
  const stepX = dx / steps, stepZ = dz / steps;
  for (let i = 0; i < steps; i++) {
    const allowed = checkVRCollision({ x: stepX, y: 0, z: stepZ });
    xrPlayerPos.x += allowed.x;
    xrPlayerPos.z += allowed.z;
    if (Math.abs(allowed.x) < 1e-6 && Math.abs(allowed.z) < 1e-6) break;
  }
}

function commitXRReferenceSpace() {
  if (!xrBaseReferenceSpace) return;
  const sinY = Math.sin(xrYaw * 0.5);
  const cosY = Math.cos(xrYaw * 0.5);
  const c = Math.cos(xrYaw), s = Math.sin(xrYaw);
  const tx = -(xrPlayerPos.x * c - xrPlayerPos.z * s);
  const tz = -(xrPlayerPos.x * s + xrPlayerPos.z * c);
  const offsetTransform = new XRRigidTransform(
    { x: tx, y: xrPlayerPos.y, z: tz, w: 1 },
    { x: 0, y: sinY, z: 0, w: cosY },
  );
  renderer.xr.setReferenceSpace(xrBaseReferenceSpace.getOffsetReferenceSpace(offsetTransform));
}

export function updateXRLocomotion(now, frame) {
  if (!state.isInVR || !xrBaseReferenceSpace || !frame) return;
  const session = renderer.xr.getSession();
  if (!session) return;

  const dt = xrLastFrameTime ? Math.min(0.1, (now - xrLastFrameTime) / 1000) : 0;
  xrLastFrameTime = now;
  if (dt === 0) return;

  const { moveX, moveZ, turnX } = readXRStickInput(session);
  const viewerPose = frame.getViewerPose(renderer.xr.getReferenceSpace());
  if (!viewerPose) return;

  if (Math.abs(moveX) > VR_STICK_DEADZONE || Math.abs(moveZ) > VR_STICK_DEADZONE) {
    const dir = getXRMoveDirectionWorld(moveX, moveZ, viewerPose.transform.orientation);
    const speed = VR_MOVE_SPEED * dt;
    applyXRMoveWorld(dir.x * speed, dir.z * speed);
  }

  if (Math.abs(turnX) > VR_STICK_DEADZONE) xrYaw += turnX * VR_TURN_SPEED * dt;

  commitXRReferenceSpace();
}
