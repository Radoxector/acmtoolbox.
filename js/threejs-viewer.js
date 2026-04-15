// frontend/js/threejs-viewer.js

import { state } from './state.js';

export function init3D() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) {
    console.error('[3D] Canvas element not found!');
    return;
  }

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(0x808080, 1); 
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  state.scene = new THREE.Scene();

  const canvas_width = canvas.offsetWidth;
  const canvas_height = canvas.offsetHeight;
  state.camera = new THREE.PerspectiveCamera(
    45,
    canvas_width / canvas_height,
    0.1,
    20000 
  );
  state.camera.position.set(50, 40, 50);
  state.camera.lookAt(0, 0, 0);
  state.initialCameraPos = { x: 50, y: 40, z: 50 };

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  state.scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.1);
  state.scene.add(hemisphereLight);

  state.shadowLight = new THREE.DirectionalLight(0xffffff, 0.1);
  state.shadowLight.castShadow = true;
  state.scene.add(state.shadowLight);

  const fillLight1 = new THREE.PointLight(0x8899ff, 0.4, 1000);
  fillLight1.position.set(-80, 50, -80);
  state.scene.add(fillLight1);

  const fillLight2 = new THREE.PointLight(0xff9988, 0.3, 1000);
  fillLight2.position.set(80, 30, -60);
  state.scene.add(fillLight2);

  const groundGeometry = new THREE.PlaneGeometry(10000, 10000, 1, 1);
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;
  ground.position.y = 0;
  ground.rotation.x = -Math.PI / 2;
  state.scene.add(ground);

  window.addEventListener('resize', onWindowResize);
  onWindowResize();
  animate();

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  console.log('[3D] Perspective 3D viewer initialized successfully');
}

function onWindowResize() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) return;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  if (w > 0 && h > 0) {
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(w, h);
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (state.orbitControls.isAutoRotating && state.mesh) {
    state.orbitControls.yaw += 0.005; 
    updateOrbitCamera();
  }
  state.renderer.render(state.scene, state.camera);
}

function createFaceWireframeGeometry(faces, vertices) {
  const edgeSet = new Set();
  const edgePositions = [];
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    for (let j = 0; j < face.length; j++) {
      const v1 = face[j];
      const v2 = face[(j + 1) % face.length];
      const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const vertex1 = vertices[v1];
        const vertex2 = vertices[v2];
        edgePositions.push(vertex1[0], vertex1[1], vertex1[2]);
        edgePositions.push(vertex2[0], vertex2[1], vertex2[2]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgePositions), 3));
  return geometry;
}

export function buildModel3D(vertices, faces) {
  if (state.mesh) {
    state.scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    if (state.meshWireframe) {
      state.scene.remove(state.meshWireframe);
      state.meshWireframe.geometry.dispose();
      state.meshWireframe.material.dispose();
    }
    if (state.bbPoints) {
      state.scene.remove(state.bbPoints);
      state.bbPoints.geometry.dispose();
      state.bbPoints.material.dispose();
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices.flat()), 3));
  const indices = [];
  faces.forEach(face => {
    for (let i = 0; i < face.length - 2; i++) {
      indices.push(face[0], face[i + 1], face[i + 2]);
    }
  });
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  state.meshMaterial = new THREE.MeshStandardMaterial({
    color: state.materialColor,
    metalness: 0.3,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  state.mesh = new THREE.Mesh(geometry, state.meshMaterial);
  state.mesh.castShadow = true;
  state.mesh.receiveShadow = true;
  state.scene.add(state.mesh);

  const wireframeGeometry = createFaceWireframeGeometry(faces, vertices);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    linewidth: 2,
    fog: false,
  });

  state.meshWireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
  state.meshWireframe.visible = true; 
  state.scene.add(state.meshWireframe);

  // Bounding Box Points Visualization
  const box = new THREE.Box3().setFromObject(state.mesh);
  const bbGeometry = new THREE.BufferGeometry();
  const bbPositions = [];
  const min = box.min.clone();
  const max = box.max.clone();
  const corners = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, max.y, min.z], [min.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [max.x, max.y, max.z], [min.x, max.y, max.z]
  ];
  corners.forEach(c => bbPositions.push(c[0], c[1], c[2]));
  bbGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bbPositions), 3));
  const bbMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
  state.bbPoints = new THREE.Points(bbGeometry, bbMaterial);
  state.scene.add(state.bbPoints);

  // IMPORTANT: Center mesh around origin
  const center = box.getCenter(new THREE.Vector3());
  state.mesh.position.sub(center);
  state.meshWireframe.position.sub(center);
  state.bbPoints.position.sub(center);

  updateShadows(box);
  fitCameraToBox(box);
  setupOrbitControls();
}

function updateShadows(box) {
  if (!state.shadowLight) return;
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const pad = maxDim * 1.5;

  state.shadowLight.position.set(pad, pad, pad);
  state.shadowLight.shadow.camera.left = -pad;
  state.shadowLight.shadow.camera.right = pad;
  state.shadowLight.shadow.camera.top = pad;
  state.shadowLight.shadow.camera.bottom = -pad;
  state.shadowLight.shadow.mapSize.width = 2048;
  state.shadowLight.shadow.mapSize.height = 2048;
  state.shadowLight.shadow.updateProjectionMatrix();
}

export function fitCameraToBox(box) {
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = state.camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
  cameraZ *= 1.8;

  state.orbitControls.distance = cameraZ;
  updateOrbitCamera();
}

export function setupOrbitControls() {
  const canvas = document.getElementById('canvas3d');
  if (!canvas) return;

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  const rotationSpeed = 0.008;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) return; 
    isDragging = true;
    state.orbitControls.isAutoRotating = false; 
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !state.mesh) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    // FIX: Removed the broken scaleAdjustment. 
    // We want standard rotation speed. To make it scale-independent, 
    // we use the yaw/pitch approach which is inherently distance-relative
    // if we use the same rotationSpeed.
    state.orbitControls.yaw += deltaX * rotationSpeed;
    state.orbitControls.pitch += deltaY * rotationSpeed;
    state.orbitControls.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.orbitControls.pitch));

    updateOrbitCamera();
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.orbitControls.isAutoRotating = false; 
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
      state.orbitControls.distance /= zoomFactor;
    } else {
      state.orbitControls.distance *= zoomFactor;
    }
    state.orbitControls.distance = Math.max(1, Math.min(state.orbitControls.distance, 10000));
    updateOrbitCamera();
  }, { passive: false });

  updateOrbitCamera();
}

export function updateOrbitCamera() {
  const radius = state.orbitControls.distance;
  const x = radius * Math.sin(state.orbitControls.yaw) * Math.cos(state.orbitControls.pitch);
  const y = radius * Math.sin(state.orbitControls.pitch);
  const z = radius * Math.cos(state.orbitControls.yaw) * Math.cos(state.orbitControls.pitch);

  state.camera.position.set(x, y, z);
  state.camera.lookAt(0, 0, 0);
}
