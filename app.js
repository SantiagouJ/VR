import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// --- DOM refs ---
const container = document.getElementById('canvas-container');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const loadingEl = document.getElementById('loading');
const controlsEl = document.getElementById('controls');
const partsList = document.getElementById('parts-list');
const hintEl = document.getElementById('hint');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(8, 6, 10);

// --- Controls ---
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.target.set(0, 1, 0);
orbitControls.maxPolarAngle = Math.PI / 2 + 0.15;
orbitControls.update();

// --- Lights ---
scene.add(new THREE.AmbientLight(0x8899bb, 0.6));

const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.5);
sunLight.position.set(8, 12, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

scene.add(new THREE.DirectionalLight(0x99bbff, 0.4).translateX(-5).translateY(4));
scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a5f3a, 0.3));

// --- Ground ---
const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// --- GLTF Loader ---
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

// --- State ---
let loadedModel = null;
const meshParts = [];
const originalColors = new Map();
let selectedMesh = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const highlightEdges = new THREE.LineBasicMaterial({ color: 0x64B5F6, linewidth: 2 });

// --- File handling ---
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'glb' && ext !== 'gltf') {
    alert('Formato no soportado. Usa archivos .glb o .gltf');
    return;
  }

  showLoading(true);
  const url = URL.createObjectURL(file);

  gltfLoader.load(
    url,
    (gltf) => {
      URL.revokeObjectURL(url);
      processModel(gltf, file.name);
      showLoading(false);
    },
    undefined,
    (error) => {
      URL.revokeObjectURL(url);
      showLoading(false);
      console.error('Error cargando modelo:', error);
      alert('Error al cargar el modelo. Asegúrate de que sea un archivo glTF/GLB válido.');
    }
  );
}

function showLoading(show) {
  loadingEl.classList.toggle('active', show);
}

// --- Process loaded model ---
function processModel(gltf, filename) {
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
  }

  meshParts.length = 0;
  originalColors.clear();
  selectedMesh = null;

  const model = gltf.scene;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material = child.material.clone();
      }

      meshParts.push(child);
      if (child.material && child.material.color) {
        originalColors.set(child.uuid, child.material.color.clone());
      }
    }
  });

  // Center and scale the model to fit the view
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const desiredSize = 6;
  const scale = desiredSize / maxDim;
  model.scale.multiplyScalar(scale);

  box.setFromObject(model);
  box.getCenter(center);
  const bottom = box.min.y;

  model.position.sub(center);
  model.position.y -= bottom;

  loadedModel = model;
  scene.add(model);

  // Adjust camera to frame the model
  box.setFromObject(model);
  const newSize = box.getSize(new THREE.Vector3());
  const newCenter = box.getCenter(new THREE.Vector3());

  orbitControls.target.copy(newCenter);
  const dist = Math.max(newSize.x, newSize.y, newSize.z) * 2;
  camera.position.set(
    newCenter.x + dist * 0.8,
    newCenter.y + dist * 0.5,
    newCenter.z + dist * 0.8
  );
  orbitControls.update();

  buildControlsUI(filename);

  dropZone.classList.add('hidden');
  controlsEl.classList.add('active');
  hintEl.classList.add('active');

  setTimeout(() => { hintEl.style.opacity = '0'; }, 6000);
}

// --- Build dynamic color controls ---
function buildControlsUI(filename) {
  document.getElementById('model-name').textContent = filename;
  document.getElementById('part-count').textContent =
    `${meshParts.length} parte${meshParts.length !== 1 ? 's' : ''} detectada${meshParts.length !== 1 ? 's' : ''}`;

  partsList.innerHTML = '';

  meshParts.forEach((mesh, i) => {
    const name = mesh.name || `Parte_${i + 1}`;
    const color = mesh.material?.color
      ? '#' + mesh.material.color.getHexString()
      : '#cccccc';

    const group = document.createElement('div');
    group.className = 'color-group';
    group.dataset.index = i;

    group.innerHTML = `
      <label>
        <div class="wall-icon" style="background-color: ${color}"></div>
        <span class="part-name" title="${name}">${formatName(name)}</span>
        <span class="color-hex">${color.toUpperCase()}</span>
        <input type="color" value="${color}">
      </label>
    `;

    const colorInput = group.querySelector('input[type="color"]');
    const icon = group.querySelector('.wall-icon');
    const hexLabel = group.querySelector('.color-hex');

    colorInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (mesh.material && mesh.material.color) {
        mesh.material.color.set(hex);
      }
      icon.style.backgroundColor = hex;
      hexLabel.textContent = hex.toUpperCase();
    });

    group.addEventListener('click', (e) => {
      if (e.target === colorInput) return;
      selectMesh(mesh, group);
    });

    partsList.appendChild(group);
  });
}

function formatName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

// --- Selection ---
function selectMesh(mesh, uiGroup) {
  document.querySelectorAll('.color-group.selected').forEach(el => el.classList.remove('selected'));

  scene.children
    .filter(c => c.userData.isHighlight)
    .forEach(c => scene.remove(c));

  if (selectedMesh === mesh) {
    selectedMesh = null;
    return;
  }

  selectedMesh = mesh;
  if (uiGroup) uiGroup.classList.add('selected');

  const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
  const line = new THREE.LineSegments(edges, highlightEdges);
  line.userData.isHighlight = true;
  mesh.getWorldPosition(line.position);
  mesh.getWorldQuaternion(line.quaternion);
  mesh.getWorldScale(line.scale);
  scene.add(line);
}

// --- Raycasting (click to select mesh) ---
let isDragging = false;
let mouseDownPos = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseDownPos.set(e.clientX, e.clientY);
  isDragging = false;
});

renderer.domElement.addEventListener('pointermove', (e) => {
  const dx = e.clientX - mouseDownPos.x;
  const dy = e.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (isDragging || !loadedModel) return;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(meshParts, true);

  if (intersects.length > 0) {
    let hitMesh = intersects[0].object;
    const index = meshParts.indexOf(hitMesh);
    if (index !== -1) {
      const group = partsList.children[index];
      selectMesh(hitMesh, group);
      group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
    selectMesh(null, null);
  }
});

// --- Action buttons ---
document.getElementById('btn-reset-colors').addEventListener('click', () => {
  meshParts.forEach((mesh, i) => {
    const orig = originalColors.get(mesh.uuid);
    if (orig && mesh.material?.color) {
      mesh.material.color.copy(orig);
      const hex = '#' + orig.getHexString();
      const group = partsList.children[i];
      if (group) {
        group.querySelector('.wall-icon').style.backgroundColor = hex;
        group.querySelector('.color-hex').textContent = hex.toUpperCase();
        group.querySelector('input[type="color"]').value = hex;
      }
    }
  });
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  meshParts.forEach((mesh, i) => {
    const hue = Math.random();
    const sat = 0.3 + Math.random() * 0.5;
    const light = 0.4 + Math.random() * 0.4;
    const color = new THREE.Color().setHSL(hue, sat, light);

    if (mesh.material?.color) {
      mesh.material.color.copy(color);
      const hex = '#' + color.getHexString();
      const group = partsList.children[i];
      if (group) {
        group.querySelector('.wall-icon').style.backgroundColor = hex;
        group.querySelector('.color-hex').textContent = hex.toUpperCase();
        group.querySelector('input[type="color"]').value = hex;
      }
    }
  });
});

document.getElementById('btn-load-new').addEventListener('click', () => {
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
  }
  scene.children
    .filter(c => c.userData.isHighlight)
    .forEach(c => scene.remove(c));

  meshParts.length = 0;
  originalColors.clear();
  selectedMesh = null;

  controlsEl.classList.remove('active');
  hintEl.classList.remove('active');
  dropZone.classList.remove('hidden');
  fileInput.value = '';
});

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);

  scene.children
    .filter(c => c.userData.isHighlight)
    .forEach(c => {
      if (selectedMesh) {
        selectedMesh.getWorldPosition(c.position);
        selectedMesh.getWorldQuaternion(c.quaternion);
        selectedMesh.getWorldScale(c.scale);
      }
    });

  orbitControls.update();
  renderer.render(scene, camera);
}
animate();

// --- Try loading casa.glb from same directory ---
fetch('casa.glb', { method: 'HEAD' })
  .then(res => {
    if (res.ok) {
      showLoading(true);
      gltfLoader.load('casa.glb', (gltf) => {
        processModel(gltf, 'casa.glb');
        showLoading(false);
      }, undefined, () => showLoading(false));
    }
  })
  .catch(() => {});
