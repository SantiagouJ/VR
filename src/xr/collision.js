import * as THREE from 'three';
import { renderer, scene } from '../scene/setup.js';
import { state } from '../state.js';

export const VR_PLAYER_SKIN = 0.25;
const VR_COLLISION_HEIGHT_OFFSETS = [0.2, 0.9, 1.6];
const VR_NORMAL_Y_THRESHOLD = 0.42;
export const VR_ASSUMED_HEAD_TO_FLOOR = 1.6;

const _collisionRaycaster = new THREE.Raycaster();
const _collisionDirection = new THREE.Vector3();
const _vrWallNormal = new THREE.Vector3();
const _vrSlideDir = new THREE.Vector3();
const _vrOrigin = new THREE.Vector3();
const _vrRayFrom = new THREE.Vector3();
const _vrPerp = new THREE.Vector3();
const _vrHeadPos = new THREE.Vector3();

let _collisionMeshes = null;

export function invalidateCollisionMeshes() {
  _collisionMeshes = null;
}

function buildCollisionMeshes() {
  if (!state.loadedModel || state.meshParts.length === 0) {
    _collisionMeshes = [];
    return;
  }
  _collisionMeshes = state.meshParts.filter((mesh) => {
    if (!mesh || mesh.userData?.noCollision) return false;
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z) >= 0.05;
  });
  state.loadedModel.updateMatrixWorld(true);
}

function getCollisionMeshes() {
  if (_collisionMeshes === null) buildCollisionMeshes();
  return _collisionMeshes;
}

function getHitWallNormal(hit, rayDir, outNormal) {
  if (!hit?.face) return false;
  outNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  if (Math.abs(outNormal.y) > VR_NORMAL_Y_THRESHOLD) return false;
  outNormal.y = 0;
  if (outNormal.lengthSq() < 1e-8) return false;
  outNormal.normalize();
  if (outNormal.dot(rayDir) > 0) outNormal.negate();
  return true;
}

export function checkVRCollision(proposedOffset) {
  const { x: dx, y: dy, z: dz } = proposedOffset;
  if ((dx === 0 && dz === 0) || !state.loadedModel || state.meshParts.length === 0) return proposedOffset;

  const xrCam = renderer.xr.getCamera();
  xrCam.getWorldPosition(_vrHeadPos);
  const floorY = _vrHeadPos.y - VR_ASSUMED_HEAD_TO_FLOOR;
  state.loadedModel.updateMatrixWorld(true);

  const stepLen = Math.hypot(dx, dz);
  if (stepLen < 1e-6) return proposedOffset;

  function castWallRay(from, dir, far) {
    _collisionRaycaster.set(from, dir);
    _collisionRaycaster.far = far;
    const meshes = getCollisionMeshes();
    if (!meshes || meshes.length === 0) return null;
    const hits = _collisionRaycaster.intersectObjects(meshes, false);
    for (const h of hits) {
      if (h.distance < 0.001) continue;
      if (getHitWallNormal(h, dir, _vrWallNormal)) return h;
    }
    return null;
  }

  function castVerticalWallAtHeights(fromXZ, dir, far) {
    let bestHit = null;
    for (const hOff of VR_COLLISION_HEIGHT_OFFSETS) {
      _vrOrigin.set(fromXZ.x, floorY + hOff, fromXZ.z);
      const h = castWallRay(_vrOrigin, dir, far);
      if (h && (!bestHit || h.distance < bestHit.distance)) bestHit = h;
    }
    return bestHit;
  }

  function castVerticalWallCapsule(dirNorm, far) {
    let bestHit = null;
    _vrPerp.set(-dirNorm.z, 0, dirNorm.x);
    if (_vrPerp.lengthSq() < 1e-10) _vrPerp.set(0, 0, 1);
    else _vrPerp.normalize();
    const lateral = VR_PLAYER_SKIN * 0.88;
    for (const off of [0, lateral, -lateral]) {
      _vrRayFrom.set(_vrHeadPos.x + _vrPerp.x * off, _vrHeadPos.y, _vrHeadPos.z + _vrPerp.z * off);
      const h = castVerticalWallAtHeights(_vrRayFrom, dirNorm, far);
      if (h && (!bestHit || h.distance < bestHit.distance)) bestHit = h;
    }
    return bestHit;
  }

  function tryAxisOnly() {
    let ox = 0, oz = 0;
    const ax = Math.abs(dx), az = Math.abs(dz);
    if (ax > 1e-6) {
      _collisionDirection.set(Math.sign(dx), 0, 0);
      const hx = castVerticalWallCapsule(_collisionDirection, ax + VR_PLAYER_SKIN);
      if (!hx || hx.distance >= ax + VR_PLAYER_SKIN * 0.08) ox = dx;
    }
    if (az > 1e-6) {
      _collisionDirection.set(0, 0, Math.sign(dz));
      const hz = castVerticalWallCapsule(_collisionDirection, az + VR_PLAYER_SKIN);
      if (!hz || hz.distance >= az + VR_PLAYER_SKIN * 0.08) oz = dz;
    }
    return { x: ox, y: dy, z: oz };
  }

  _collisionDirection.set(dx / stepLen, 0, dz / stepLen);
  const hit = castVerticalWallCapsule(_collisionDirection, stepLen + VR_PLAYER_SKIN);
  if (!hit || hit.distance > stepLen + 0.03) return proposedOffset;
  if (!getHitWallNormal(hit, _collisionDirection, _vrWallNormal)) return proposedOffset;

  const walkX = dx / stepLen, walkZ = dz / stepLen;
  const into = walkX * _vrWallNormal.x + walkZ * _vrWallNormal.z;
  if (into >= -0.02) return proposedOffset;

  _vrSlideDir.set(walkX - _vrWallNormal.x * into, 0, walkZ - _vrWallNormal.z * into);
  if (_vrSlideDir.lengthSq() < 1e-5) return tryAxisOnly();

  _vrSlideDir.normalize();
  const slideHit = castVerticalWallCapsule(_vrSlideDir, stepLen + VR_PLAYER_SKIN);
  if (slideHit && slideHit.distance < VR_PLAYER_SKIN * 0.55) return tryAxisOnly();

  return { x: _vrSlideDir.x * stepLen, y: dy, z: _vrSlideDir.z * stepLen };
}
