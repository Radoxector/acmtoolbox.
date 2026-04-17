// frontend/js/threejs-viewer.js

import { state } from './state.js';

// ── Inertia ───────────────────────────────────────────────────────────────────
const _iner = { yawV: 0, pitchV: 0, panXV: 0, panYV: 0, damping: 0.87, active: false };

// ── Scene helpers ─────────────────────────────────────────────────────────────
let _grid = null;
let _axes = null;
let _ground = null;
let _controlsReady = false;
let _envMap = null;

// ─────────────────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────────────────
export async function init3D() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) { console.error('[3D] Canvas not found'); return; }

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(0x808080, 1);
  state.renderer.shadowMap.enabled = false;
  state.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.1;
  if (THREE.SRGBColorSpace !== undefined) {
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  state.scene = new THREE.Scene();

  const w = canvas.offsetWidth || 800;
  const h = canvas.offsetHeight || 600;
  state.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 20000);

  // Orbit controls state (always orbits around origin)
  state.orbitControls = {
    distance: 150,
    yaw: -Math.PI / 4,
    pitch: Math.PI / 6,
    panX: 0,
    panY: 0,
    isAutoRotating: false,
  };

  // Initial camera position (will be updated via updateOrbitCamera)
  updateOrbitCamera();

  _setupLighting();
  await _setupEnvironment();

  // Grid and axes
  _axes = new THREE.AxesHelper(20);
  _axes.visible = false;
  state.scene.add(_axes);

  window.addEventListener('resize', _onResize);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  _setupOrbitControls();
  _onResize();
  _animate();

  console.log('[3D] Enhanced viewer initialised');
}

async function _setupEnvironment() {
  try {
    const loader = new THREE.TextureLoader();
    // Using the provided KTX2 URL. Note: standard TextureLoader might fail for KTX2 
    // if the environment doesn't have the KTX2Loader/transcoder.
    // However, we'll attempt to load it as is.
    const texture = await loader.loadAsync('https://cdn.needle.tools/static/hdris/canary_wharf_2k.pmrem.ktx2');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    _envMap = texture;
    state.scene.environment = _envMap;
    console.log('[3D] Environment map loaded successfully');
  } catch (e) {
    console.warn('[3D] Failed to load HDRI environment map. Check if KTX2 loader is required.', e);
  }
}

function _setupLighting() {




// ... (rest of the file)

// ... (rest of the file)

// ... (rest of the file)
  state.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  state.scene.add(new THREE.HemisphereLight(0xddeeff, 0x664422, 0.6));

  state.shadowLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
  state.shadowLight.castShadow = true;
  state.shadowLight.shadow.mapSize.set(2048, 2048);
  state.shadowLight.shadow.bias = -0.0005;
  state.scene.add(state.shadowLight);

  const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
  fill.position.set(-1, 0.5, -1).normalize();
  state.scene.add(fill);

  const rim = new THREE.PointLight(0xff9966, 0.5, 2000);
  rim.position.set(80, -30, -100);
  state.scene.add(rim);
}

function _onResize() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) return;
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  if (w > 0 && h > 0) {
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(w, h);
  }
}

function _animate() {
  requestAnimationFrame(_animate);
  if (state.orbitControls.isAutoRotating && state.mesh) {
    state.orbitControls.yaw += 0.005;
    updateOrbitCamera();
  }
  if (_iner.active) {
    const EPS = 0.00005;
    if (Math.abs(_iner.yawV) > EPS || Math.abs(_iner.pitchV) > EPS ||
        Math.abs(_iner.panXV) > EPS || Math.abs(_iner.panYV) > EPS) {
      state.orbitControls.yaw   += _iner.yawV;
      state.orbitControls.pitch += _iner.pitchV;
      state.orbitControls.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.orbitControls.pitch));
      state.orbitControls.panX  += _iner.panXV;
      state.orbitControls.panY  += _iner.panYV;
      _iner.yawV   *= _iner.damping;
      _iner.pitchV *= _iner.damping;
      _iner.panXV  *= _iner.damping;
      _iner.panYV  *= _iner.damping;
      updateOrbitCamera();
    } else {
      _iner.yawV = _iner.pitchV = _iner.panXV = _iner.panYV = 0;
      _iner.active = false;
    }
  }
  state.renderer.render(state.scene, state.camera);
}

function _buildWireframeGeo(faces, vertices) {
  const seen = new Set(), pos = [];
  for (const face of faces) {
    for (let j = 0; j < face.length; j++) {
      const a = face[j], b = face[(j + 1) % face.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const va = vertices[a], vb = vertices[b];
      pos.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return geo;
}

export function buildModel3D(vertices, faces) {
  // Dispose previous objects
  [state.mesh, state.meshWireframe, state.bbPoints].forEach(obj => {
    if (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else if (obj.material) obj.material.dispose();
      if (state.scene) state.scene.remove(obj);
    }
  });
  state.bbPoints = null;

  // Build geometry
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices.flat()), 3));
  const idx = [];
  faces.forEach(f => { for (let i = 0; i < f.length - 2; i++) idx.push(f[0], f[i+1], f[i+2]); });
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  state.meshMaterial = new THREE.MeshStandardMaterial({
    color:     state.materialColor,
    metalness: 0.6,
    roughness: 0.05,
    envMapIntensity: 1.0,
    side:      THREE.FrontSide,
  });

  const innerMaterial = new THREE.MeshStandardMaterial({
    color:     '#1a1a1a',
    metalness: 0.0,
    roughness: 0.9,
    side:      THREE.BackSide,
  });

  const outerMesh = new THREE.Mesh(geo, state.meshMaterial);
  const innerMesh = new THREE.Mesh(geo, innerMaterial);
  outerMesh.castShadow = outerMesh.receiveShadow = false;
  innerMesh.castShadow = innerMesh.receiveShadow = false;

  state.mesh = new THREE.Group();
  state.mesh.add(outerMesh);
  state.mesh.add(innerMesh);


  // Center the model at (0,0,0)
  const box = new THREE.Box3().setFromObject(state.mesh);
  const center = box.getCenter(new THREE.Vector3());
  state.mesh.position.set(-center.x, -center.y, -center.z);
  state.scene.add(state.mesh);

  // Wireframe
  state.meshWireframe = new THREE.LineSegments(
    _buildWireframeGeo(faces, vertices),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, fog: false })
  );
  state.meshWireframe.position.copy(state.mesh.position);
  state.meshWireframe.visible = true;
  state.scene.add(state.meshWireframe);

  // Re‑compute bounding box after centering
  const newBox = new THREE.Box3().setFromObject(state.mesh);

  // Bounding box points (optional, used for UI)
  const bbGeo = new THREE.BufferGeometry();
  const bbPos = [];
  const min = newBox.min;
  const max = newBox.max;
  const corners = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, max.y, min.z], [min.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [max.x, max.y, max.z], [min.x, max.y, max.z]
  ];
  corners.forEach(c => bbPos.push(c[0], c[1], c[2]));
  bbGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bbPos), 3));
  state.bbPoints = new THREE.Points(bbGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2 }));
  state.bbPoints.visible = false;
  state.scene.add(state.bbPoints);

  _alignEnvironment(newBox);
  resetView();
}

function _alignEnvironment(box) {
  const bottomY = box.min.y;
  if (_grid) _grid.position.y = bottomY;
  if (_ground) _ground.position.y = bottomY;
  _updateShadows(box);
}

function _updateShadows(box) {
  if (!state.shadowLight) return;
  const size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, size.z) * 2;
  state.shadowLight.position.set(0, pad, 0);

  const sc = state.shadowLight.shadow.camera;
  if (sc && typeof sc.updateProjectionMatrix === 'function') {
    sc.left = -size.x / 2;
    sc.right = size.x / 2;
    sc.top = size.z / 2;
    sc.bottom = -size.z / 2;
    sc.near = 0.1;
    sc.far = pad * 10;
    sc.updateProjectionMatrix();
  }
}

// ── Public camera control ─────────────────────────────────────────────────────
export function updateOrbitCamera() {
  const { distance, yaw, pitch, panX = 0, panY = 0 } = state.orbitControls;

  // Direction from target to camera (spherical)
  const x = distance * Math.sin(yaw) * Math.cos(pitch);
  const y = distance * Math.sin(pitch);
  const z = distance * Math.cos(yaw) * Math.cos(pitch);

  const target = new THREE.Vector3(0, 0, 0);
  let pos = new THREE.Vector3(x, y, z);

  // Apply panning: move camera perpendicular to view direction
  const forward = pos.clone().normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  pos = pos.clone().add(right.clone().multiplyScalar(panX)).add(up.clone().multiplyScalar(panY));

  state.camera.position.copy(target.clone().add(pos));
  state.camera.lookAt(target);
}

export function resetView() {
  if (!state.mesh) return;
  const box = new THREE.Box3().setFromObject(state.mesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = (state.camera.fov * Math.PI) / 180;
  const distance = (maxDim / 2) / Math.tan(fovRad / 2) * 1.5;

  state.orbitControls.distance = Math.max(1, distance);
  state.orbitControls.yaw = -Math.PI / 4;    // 45° around Y
  state.orbitControls.pitch = Math.PI / 6;   // 30° elevation
  state.orbitControls.panX = 0;
  state.orbitControls.panY = 0;
  updateOrbitCamera();
}

// Kept for compatibility
export function fitCameraToBox(box) {
  resetView();
}

// ── Input handling (orbit/pan) ────────────────────────────────────────────────
function _setupOrbitControls() {
  if (_controlsReady) return;
  _controlsReady = true;

  const canvas = document.getElementById('canvas3d');
  const ROT_SPD = 0.008;

  let dragging = false;
  let prev = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', e => {
    state.orbitControls.isAutoRotating = false;
    _iner.active = false;
    if (e.button === 0) dragging = true;
    prev = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;

    const s = (300 / state.orbitControls.distance) * ROT_SPD;
    _iner.yawV = dx * s;
    _iner.pitchV = dy * s;
    state.orbitControls.yaw += _iner.yawV;
    state.orbitControls.pitch += _iner.pitchV;
    state.orbitControls.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.orbitControls.pitch));
    
    updateOrbitCamera();
    prev = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mouseup', () => {
    if (dragging) _iner.active = true;
    dragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    if (dragging) _iner.active = true;
    dragging = false;
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    state.orbitControls.isAutoRotating = false;
    state.orbitControls.distance = Math.max(1, Math.min(
      state.orbitControls.distance * (e.deltaY < 0 ? 0.9 : 1.1), 10000
    ));
    updateOrbitCamera();
  }, { passive: false });

  // Touch support
  let lastT = [], lastPinch = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    state.orbitControls.isAutoRotating = false;
    _iner.active = false;
    lastT = [...e.touches];
    lastPinch = null;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = [...e.touches];
    if (t.length === 1 && lastT.length >= 1) {
      const dx = t[0].clientX - lastT[0].clientX;
      const dy = t[0].clientY - lastT[0].clientY;
      const s = (150 / state.orbitControls.distance) * ROT_SPD;
      state.orbitControls.yaw += dx * s;
      state.orbitControls.pitch += dy * s;
      state.orbitControls.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.orbitControls.pitch));
    } else if (t.length === 2 && lastT.length >= 2) {
      const pinch = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      if (lastPinch !== null) {
        state.orbitControls.distance = Math.max(1, Math.min(state.orbitControls.distance * (lastPinch / pinch), 10000));
      }
      lastPinch = pinch;
    }
    updateOrbitCamera();
    lastT = t;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    if (lastT.length > 0) _iner.active = true;
    lastT = [];
    lastPinch = null;
  }, { passive: false });
}

// Toggle helpers
export function toggleGrid(visible) {
  state.showGrid = visible;
  if (_grid) _grid.visible = visible;
}

export function toggleAxes(visible) {
  state.showAxes = visible;
  if (_axes) _axes.visible = visible;
}

export function toggleEnvironment(enabled) {
  if (state.mesh && state.mesh.children[0]) {
    const outerMesh = state.mesh.children[0];
    outerMesh.material.envMap = enabled ? _envMap : null;
    outerMesh.material.envMapIntensity = enabled ? 1.0 : 0.0;
    outerMesh.material.needsUpdate = true;
  }
}

