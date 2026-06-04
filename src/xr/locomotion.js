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

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _headQuat = new THREE.Quaternion();

// Read left and right thumbstick values.
// Meta Quest xr-standard mapping: thumbstick at axes[2] (X) and axes[3] (Y).
// Falls back to axes[0]/[1] on controllers with fewer than 4 axes.
function readSticks(session) {
  let lx = 0, ly = 0, rx = 0;
  for (const src of session.inputSources) {
    if (!src.gamepad) continue;
    const a = src.gamepad.axes;
    if (!a || a.length < 2) continue;
    const sx = (a.length >= 4 ? a[2] : a[0]) ?? 0;
    const sy = (a.length >= 4 ? a[3] : a[1]) ?? 0;
    if (src.handedness === 'left') { lx = sx; ly = sy; }
    else if (src.handedness === 'right') { rx = sx; }
  }
  return { lx, ly, rx };
}

// Build an offset reference space that places the tracking origin at xrPlayerPos
// with orientation xrYaw in the virtual world.
//
// getOffsetReferenceSpace(T) maps: p_virtual = R^{-1}(p_tracking - T.pos)
// We need p_virtual = xrPlayerPos when p_tracking = (0,0,0), so:
//   T.pos = -R_y(xrYaw) * xrPlayerPos
// where R_y(yaw) = [[c,0,s],[0,1,0],[-s,0,c]], giving:
//   tx = -(c*px + s*pz),  tz = s*px - c*pz
function commitPose() {
  if (!xrBaseReferenceSpace) return;
  const yaw = xrYaw;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const px = xrPlayerPos.x;
  const pz = xrPlayerPos.z;
  renderer.xr.setReferenceSpace(
    xrBaseReferenceSpace.getOffsetReferenceSpace(
      new XRRigidTransform(
        { x: -(c * px + s * pz), y: xrPlayerPos.y, z: s * px - c * pz, w: 1 },
        { x: 0, y: Math.sin(yaw * 0.5), z: 0, w: Math.cos(yaw * 0.5) },
      ),
    ),
  );
}

export function updateXRLocomotion(now, frame) {
  if (!state.isInVR || !xrBaseReferenceSpace || !frame) return;
  const session = renderer.xr.getSession();
  if (!session) return;

  const dt = xrLastFrameTime ? Math.min(0.1, (now - xrLastFrameTime) / 1000) : 0;
  xrLastFrameTime = now;
  if (dt === 0) return;

  const { lx, ly, rx } = readSticks(session);

  // Right stick X → smooth turn (rx > 0 = stick right = player turns right).
  if (Math.abs(rx) > VR_STICK_DEADZONE) {
    xrYaw += rx * VR_TURN_SPEED * dt;
  }

  // Left stick → move in head's horizontal forward direction.
  const hasLx = Math.abs(lx) > VR_STICK_DEADZONE;
  const hasLy = Math.abs(ly) > VR_STICK_DEADZONE;
  if (hasLx || hasLy) {
    const viewerPose = frame.getViewerPose(renderer.xr.getReferenceSpace());
    if (viewerPose) {
      const ori = viewerPose.transform.orientation;
      _headQuat.set(ori.x, ori.y, ori.z, ori.w);

      _fwd.set(0, 0, -1).applyQuaternion(_headQuat);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
      else _fwd.normalize();
      _right.crossVectors(_fwd, _up).normalize();

      // Thumbstick Y: +1 = stick down = backward, -1 = stick up = forward.
      const fwdInput = hasLy ? -ly : 0;
      const rightInput = hasLx ? lx : 0;
      const speed = VR_MOVE_SPEED * dt;
      const dx = (_fwd.x * fwdInput + _right.x * rightInput) * speed;
      const dz = (_fwd.z * fwdInput + _right.z * rightInput) * speed;

      const dist = Math.hypot(dx, dz);
      if (dist > 1e-8) {
        const steps = Math.max(1, Math.ceil(dist / VR_MOVE_SUBSTEP));
        const sx = dx / steps;
        const sz = dz / steps;
        for (let i = 0; i < steps; i++) {
          const allowed = checkVRCollision({ x: sx, y: 0, z: sz });
          xrPlayerPos.x += allowed.x;
          xrPlayerPos.z += allowed.z;
          if (Math.abs(allowed.x) < 1e-6 && Math.abs(allowed.z) < 1e-6) break;
        }
      }
    }
  }

  commitPose();
}
