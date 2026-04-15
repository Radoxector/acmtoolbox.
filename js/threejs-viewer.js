// frontend/js/threejs-viewer.js

import { state } from './state.js';

// ── Inertia ───────────────────────────────────────────────────────────────────
const _iner = { yawV: 0, pitchV: 0, panXV: 0, panYV: 0, damping: 0.87, active: false };

// ── Scene helpers ─────────────────────────────────────────────────────────────
let _grid = null;
let _axes = null;
let _ground = null;
let _controlsReady = false; 

// ─────────────────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────────────────
export function init3D() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) { console.error('[3D] Canvas not found'); return; }

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(0x808080, 1);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  state.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.1;
  if (THREE.SRGBColorSpace !== undefined) {
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.FogExp2(0x808080, 0.0008);

  const w = canvas.offsetWidth || 800;
  const h = canvas.offsetHeight || 600;
  state.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 20000);
  state.camera.position.set(150, 120, 150);
  state.camera.lookAt(0, 0, 0);
  state.initialCameraPos = { x: 150, y: 150, z: 150 };

  _setupLighting();

  // Ground Plane (for shadows)
  _ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  );
  _ground.receiveShadow = true;
  _ground.rotation.x = -Math.PI / 2;
  _ground.position.y = 0; 
  state.scene.add(_ground);

  // Grid
  _grid = new THREE.GridHelper(1000, 100, 0x444444, 0x333333);
  _grid.material.transparent = true;
  _grid.material.opacity = 0.3;
  _grid.visible = state.showGrid ?? true;
  state.scene.add(_grid);

  _axes = new THREE.AxesHelper(20);
  _axes.visible = state.showAxes ?? true;
  state.scene.add(_axes);

  window.addEventListener('resize', _onResize);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  _setupOrbitControls();
  _onResize();
  _animate();

  console.log('[3D] Enhanced viewer initialised');
}

function _setupLighting() {
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
      state.orbitControls.pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.orbitControls.pitch));
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
  [state.mesh, state.meshWireframe, state.bbPoints].forEach(obj => {
    if (obj) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material?.dispose();
      state.scene.remove(obj);
    }
  });
  state.bbPoints = null;

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
    metalness: 0.15,
    roughness: 0.7,
    side:      THREE.DoubleSide,
  });

  state.mesh = new THREE.Mesh(geo, state.meshMaterial);
  state.mesh.castShadow = state.mesh.receiveShadow = true;
  state.scene.add(state.mesh);

  state.meshWireframe = new THREE.LineSegments(
    _buildWireframeGeo(faces, vertices),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, fog: false })
  );
  state.meshWireframe.visible = true;
  state.scene.add(state.meshWireframe);

  const box = new THREE.Box3().setFromObject(state.mesh);
  const center = box.getCenter(new THREE.Vector3());
  
  // 1. Move the mesh so that its bottom is exactly at Y = 0
  const bottomY = box.min.y;
  state.mesh.position.y -= bottomY;

  // 2. We also want to center the model on X and Z to keep it in the middle of the view
  // The current mesh position is (original_center + translation_to_bottom_y)
  // We want the final position to be (0, center_of_height_from_bottom, 0)
  // Wait, if we want the bottom at 0, the new center.y will be (max.y - min.y) / 2
  const height = box.max.y - box.min.y;
  const newCenterY = height / 2;

  // The current mesh position is (original_center.x, original_center.y - bottomY, original_center.z)
  // We want it to be (0, newCenterY, 0)
  state.mesh.position.x -= center.x;
  state.mesh.position.z -= center.z;
  state.mesh.position.y = newCenterY;

  // 3. Update the wireframe to match the new mesh position
  state.meshWireframe.position.copy(state.mesh.position);

  // 4. Re-calculate the bounding box based on the new position for BB points and Camera
  const newBox = new THREE.Box3().setFromObject(state.mesh);
  
  // Bounding Box Points (local to the new position)
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
  state.scene.add(state.bbPoints);

  _alignEnvironment(newBox);
  fitCameraToBox(newBox);
}


function _alignEnvironment(box) {
  const bottomY = box.min.y;

  if (_grid) {
    _grid.position.y = bottomY;
  }
  if (_ground) {
    _ground.position.y = bottomY;
  }
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

export function fitCameraToBox(box) {
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  const fovRad = (state.camera.fov * Math.PI) / 180;
  const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.5;
  
  state.orbitControls.distance = dist;
  state.orbitControls.panX = 0;
  state.orbitControls.panY = 0;
  updateOrbitCamera();
}

function _setupOrbitControls() {
  if (_controlsReady) return;
  _controlsReady = true;

  const canvas  = document.getElementById('canvas3d');
  const ROT_SPD = 0.008;
  const PAN_SPD = 0.4;

  let dragging = false, panning = false;
  let prev = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', e => {
    state.orbitControls.isAutoRotating = false;
    _iner.active = false;
    if (e.button === 1 || e.button === 2) panning  = true;
    else                                   dragging = true;
    prev = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', e => {
    if (!dragging && !panning) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;

    if (dragging) {
      const s = (300 / state.orbitControls.distance) * ROT_SPD;
      _iner.yawV = dx * s;  _iner.pitchV = dy * s;
      state.orbitControls.yaw   += _iner.yawV;
      state.orbitControls.pitch += _iner.pitchV;
      state.orbitControls.pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.orbitControls.pitch));
    }
    if (panning) {
      const s = (state.orbitControls.distance / 500) * PAN_SPD;
      _iner.panXV = -dx * s;  _iner.panYV = dy * s;
      state.orbitControls.panX += _iner.panXV;
      state.orbitControls.panY += _iner.panYV;
    }
    updateOrbitCamera();
    prev = { x: e.clientX, y: e.clientY };
  });

   canvas.addEventListener('mouseup', (e) => {
     if (dragging || panning) _iner.active = true;
     dragging = panning = false;
   });
   canvas.addEventListener('mouseleave', (e) => { 
     if (dragging || panning) _iner.active = true;
     dragging = panning = false; 
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
    lastT = [...e.touches]; lastPinch = null;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = [...e.touches];
    if (t.length === 1 && lastT.length >= 1) {
      const dx = t[0].clientX - lastT[0].clientX;
      const dy = t[0].clientY - lastT[0].clientY;
      const s  = (300 / state.orbitControls.distance) * ROT_SPD;
      state.orbitControls.yaw   += dx * s;
      state.orbitControls.pitch += dy * s;
      state.orbitControls.pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.orbitControls.pitch));
    } else if (t.length === 2 && lastT.length >= 2) {
      const avgDx = ((t[0].clientX - lastT[0].clientX) + (t[1].clientX - lastT[0].clientX)) / 2;
      const avgDy = ((t[0].clientY - lastT[0].clientY) + (t[1].clientY - lastT[1].clientY)) / 2;
      const ps = (state.orbitControls.distance / 500) * PAN_SPD;
      state.orbitControls.panX += -avgDx * ps;
      state.orbitControls.panY += avgDy * ps;
      const pinch = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      if (lastPinch !== null) {
        state.orbitControls.distance = Math.max(1, Math.min(state.orbitControls.distance * (lastPinch / pinch), 10000));
      }
      lastPinch = pinch;
    }
    updateOrbitCamera();
    lastT = t;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (lastT.length > 0) _iner.active = true;
    lastT = []; lastPinch = null;
  }, { passive: false });
}

export function updateOrbitCamera() {
  const { distance, yaw, pitch, panX = 0, panY = 0 } = state.orbitControls;
  const x = distance * Math.sin(yaw)  * Math.cos(pitch);
  const y = distance * Math.sin(pitch);
  const z = distance * Math.cos(yaw)  * Math.cos(pitch);

  const fwd   = new THREE.Vector3(-x, -y, -z).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up    = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const target = right.multiplyScalar(panX).add(up.multiplyScalar(panY));

  state.camera.position.set(x + target.x, y + target.y, z + target.z);
  state.camera.lookAt(target);
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

export function setAutoRotate(enabled) {
  state.orbitControls.isAutoRotating = enabled;
}
