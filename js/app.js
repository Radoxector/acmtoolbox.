// frontend/js/app.js

import { state } from './state.js';
import * as api from './api.js';
import * as viewer from './threejs-viewer.js';
import * as ui from './ui.js';

// ─── Sync dual dim inputs (desktop + mobile) ──────────────────────────────
function getDim(axis) {
  const desktop = document.getElementById(`dim${axis}d`);
  const mobile  = document.getElementById(`dim${axis}`);
  return parseFloat((desktop || mobile).value) || 1;
}

function syncDims(sourceId) {
  const map = { dimX: 'dimXd', dimXd: 'dimX', dimY: 'dimYd', dimYd: 'dimY', dimZ: 'dimZd', dimZd: 'dimZ' };
  const src = document.getElementById(sourceId);
  const dst = document.getElementById(map[sourceId]);
  if (src && dst) dst.value = src.value;
}

// ─── Unfold ───────────────────────────────────────────────────────────────
async function handleUnfold() {
  if (!state.modelData) {
    ui.showToast('No model loaded', 'error');
    return;
  }

  const x = getDim('X');
  const y = getDim('Y');
  const z = getDim('Z');

  const origBB = {
    minX: Math.min(...state.originalVerts.map(v => v[0])),
    maxX: Math.max(...state.originalVerts.map(v => v[0])),
    minY: Math.min(...state.originalVerts.map(v => v[1])),
    maxY: Math.max(...state.originalVerts.map(v => v[1])),
    minZ: Math.min(...state.originalVerts.map(v => v[2])),
    maxZ: Math.max(...state.originalVerts.map(v => v[2])),
  };

  const sx = x / (origBB.maxX - origBB.minX || 1);
  const sy = y / (origBB.maxY - origBB.minY || 1);
  const sz = z / (origBB.maxZ - origBB.minZ || 1);

  const payload = {
    model: {
      name: state.modelData.name,
      unit: state.modelData.unit,
      vertices: state.originalVerts.map(v => [
        origBB.minX + (v[0] - origBB.minX) * sx,
        origBB.minY + (v[1] - origBB.minY) * sy,
        origBB.minZ + (v[2] - origBB.minZ) * sz,
      ]),
      faces: state.currentFaces,
      seam_edges: Array.from(state.seamEdgeSet),
    },
  };

  try {
    const response = await api.unfold(payload);
    if (response.error) {
      ui.showToast(response.message || response.error, 'error');
      return;
    }

    state.unfoldResult = response;
    ui.displaySVG(response);
    document.getElementById('downloadBtn').disabled = false;
    ui.updateStatus(response);

    // Switch to 2D panel after successful unfold
    if (typeof switchTab === 'function') switchTab('2d');

    if (response.remaining_unfolds !== undefined) {
      const remaining = response.remaining_unfolds;
      if (typeof storeRemainingUnfolds === 'function') storeRemainingUnfolds(remaining);
      ui.updateRemainingUnfolds(remaining);
      if (remaining === 0) {
        ui.showToast(`Done — ${response.n_islands} island${response.n_islands !== 1 ? 's' : ''} · Limit reached`, 'warning');
      } else {
        const countText = remaining > 999 ? 'unlimited' : `${remaining} left`;
        ui.showToast(`Done — ${response.n_islands} island${response.n_islands !== 1 ? 's' : ''} (${countText})`, 'success');
      }
    } else {
      ui.showToast(`Done — ${response.n_islands} island${response.n_islands !== 1 ? 's' : ''}`, 'success');
    }
  } catch (err) {
    ui.showToast(`Unfold failed: ${err.message}`, 'error');
  }
}

// ─── Load model ───────────────────────────────────────────────────────────
function loadModel(modelData) {
  if (!modelData) {
    ui.showToast('Invalid model data', 'error');
    return;
  }

  state.modelData = modelData;
  state.originalVerts = modelData.vertices;
  state.seamEdgeSet = new Set(modelData.seam_edges || []);

  applyScale();

  const fileName = document.getElementById('fileName');
  fileName.textContent = modelData.name;
  fileName.classList.add('ok');

  document.getElementById('unfoldBtn').disabled = false;
  document.getElementById('stV').textContent = modelData.vertices.length;
  document.getElementById('stF').textContent = modelData.faces.length;

  // Auto-switch to 3D on model load
  if (typeof switchTab === 'function') switchTab('3d');

  console.log(`[MODEL] Loaded: ${modelData.name} (V:${modelData.vertices.length} F:${modelData.faces.length})`);
  ui.showToast(`Loaded: ${modelData.name}`, 'success');
}

// ─── Apply scale ──────────────────────────────────────────────────────────
function applyScale() {
  const x = getDim('X');
  const y = getDim('Y');
  const z = getDim('Z');

  const origBB = {
    minX: Math.min(...state.originalVerts.map(v => v[0])),
    maxX: Math.max(...state.originalVerts.map(v => v[0])),
    minY: Math.min(...state.originalVerts.map(v => v[1])),
    maxY: Math.max(...state.originalVerts.map(v => v[1])),
    minZ: Math.min(...state.originalVerts.map(v => v[2])),
    maxZ: Math.max(...state.originalVerts.map(v => v[2])),
  };

  const sx = x / (origBB.maxX - origBB.minX || 1);
  const sy = y / (origBB.maxY - origBB.minY || 1);
  const sz = z / (origBB.maxZ - origBB.minZ || 1);

  state.currentVerts = state.originalVerts.map(v => [
    origBB.minX + (v[0] - origBB.minX) * sx,
    origBB.minY + (v[1] - origBB.minY) * sy,
    origBB.minZ + (v[2] - origBB.minZ) * sz,
  ]);

  state.currentFaces = state.modelData.faces;
  viewer.buildModel3D(state.currentVerts, state.currentFaces);

  state.unfoldResult = null;
  document.getElementById('svgLayer').innerHTML = '';
  document.getElementById('empty2d').style.display = '';
  document.getElementById('downloadBtn').disabled = true;
}

// ─── Download SVG ─────────────────────────────────────────────────────────
function downloadSVG() {
  if (!state.svgString) return;
  const blob = new Blob([state.svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.modelData?.name || 'unfold'}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Build library card ───────────────────────────────────────────────────
function buildLibraryCard(modelInfo, container) {
  const card = document.createElement('div');
  card.className = 'model-card';

  let imgUrl = null;
  if (modelInfo.thumbnail && (modelInfo.thumbnail.startsWith('data:') || modelInfo.thumbnail.startsWith('http'))) {
    imgUrl = modelInfo.thumbnail;
  } else if (modelInfo.id !== 'u-channel' && modelInfo.id !== 'box-tray') {
    imgUrl = `${window.API_URL}/models/${modelInfo.id}.jpg`;
  }

  card.innerHTML = `
    <div class="model-card-thumb">
      ${imgUrl ? `<img src="${imgUrl}" alt="${modelInfo.name}" onerror="this.style.display='none'">` : ''}
      <div class="thumb-placeholder">📦</div>
    </div>
    <div class="model-card-info">
      <div class="model-card-name">${modelInfo.name}</div>
    </div>
  `;

  card.addEventListener('click', async () => {
    ui.showToast('Loading…', 'info');
    try {
      const model = await api.fetchModel(modelInfo.id);
      if (model) loadModel(model);
    } catch (err) {
      ui.showToast(`Failed: ${err.message}`, 'error');
    }
  });

  container.appendChild(card);
}

// ─── Init ─────────────────────────────────────────────────────────────────
async function initApp() {
  console.log('[APP] Initializing…');

  if (!isAuthenticated() || isTokenExpired()) {
    clearToken();
    redirectToLogin();
    return;
  }

  try {
    const username = getUsername();
    document.getElementById('usernameDisplay').textContent = username || '?';

    const remaining = await (typeof fetchRemainingUnfolds === 'function' ? fetchRemainingUnfolds() : null) ?? getRemainingUnfolds();
    ui.updateRemainingUnfolds(remaining);

    setInterval(async () => {
      if (typeof fetchRemainingUnfolds === 'function') {
        const r = await fetchRemainingUnfolds();
        if (r !== null) ui.updateRemainingUnfolds(r);
      }
    }, 30000);

    window.addEventListener('focus', async () => {
      if (typeof fetchRemainingUnfolds === 'function') {
        const r = await fetchRemainingUnfolds();
        if (r !== null) ui.updateRemainingUnfolds(r);
      }
    });

    const models = await api.fetchModelList();
    const librarySlots = document.getElementById('librarySlots');

    viewer.init3D();

    if (models && models.length > 0) {
      models.forEach(m => buildLibraryCard(m, librarySlots));
    } else {
      buildLibraryCard({ id: 'u-channel', name: 'U-Channel Demo' }, librarySlots);
    }

    // ── Listeners ────────────────────────────────────────────────────────
    document.getElementById('loadJsonBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        loadModel(JSON.parse(text));
      } catch (err) {
        ui.showToast(`Parse error: ${err.message}`, 'error');
      }
      e.target.value = '';
    });

    document.getElementById('unfoldBtn').addEventListener('click', handleUnfold);
    document.getElementById('downloadBtn').addEventListener('click', downloadSVG);

    // Dim inputs — desktop + mobile
    ['dimX', 'dimXd', 'dimY', 'dimYd', 'dimZ', 'dimZd'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        syncDims(id);
        if (state.modelData) applyScale();
      });
    });

    // Mobile size toggle
    const sizeToggleBtn = document.getElementById('sizeToggleBtn');
    const dimsExpanded  = document.getElementById('dimsExpanded');
    if (sizeToggleBtn && dimsExpanded) {
      sizeToggleBtn.addEventListener('click', () => {
        const open = dimsExpanded.classList.toggle('open');
        sizeToggleBtn.textContent = open ? '✕ Close' : '⚙ Size';
      });
    }

    // Stats toggle
    const statsToggle = document.getElementById('statsToggle');
    const statsRow    = document.getElementById('statsRow');
    if (statsToggle && statsRow) {
      statsToggle.addEventListener('click', () => {
        const open = statsRow.classList.toggle('open');
        statsToggle.classList.toggle('open', open);
      });
    }

    // 3D toolbar
    document.getElementById('resetCameraBtn').addEventListener('click', () => {
      state.orbitControls.yaw = 0;
      state.orbitControls.pitch = 0.5;
      if (state.mesh) {
        const box = new THREE.Box3().setFromObject(state.mesh);
        viewer.fitCameraToBox(box);
      } else {
        state.orbitControls.distance = 300;
        viewer.updateOrbitCamera();
      }
    });

    document.getElementById('wireframeToggle').addEventListener('click', () => {
      if (state.meshWireframe) {
        state.meshWireframe.visible = !state.meshWireframe.visible;
        document.getElementById('wireframeToggle').classList.toggle('active', state.meshWireframe.visible);
      }
    });

    document.getElementById('colorInput').addEventListener('input', (e) => {
      const hex = e.target.value;
      const dot = document.getElementById('colorDot');
      if (dot) dot.style.background = hex;
      state.materialColor = parseInt(hex.slice(1), 16);
      if (state.meshMaterial) state.meshMaterial.color.setHex(state.materialColor);
    });

    document.getElementById('toolkitsBtn').addEventListener('click', () => {
      window.location.href = './dashboard.html';
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Log out?')) logoutUser();
    });

    // 2D zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => {
      state.svgZoom *= 1.2;
      ui.updateSVGTransform();
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
      state.svgZoom /= 1.2;
      ui.updateSVGTransform();
    });
    document.getElementById('zoomFit').addEventListener('click', () => {
      state.svgZoom = 1;
      state.svgPan = { x: 0, y: 0 };
      ui.centerSVG();
    });

    // SVG pan — mouse
    let isPanning = false;
    const svgViewer = document.getElementById('svgViewer');
    svgViewer.addEventListener('mousedown', () => { isPanning = true; });
    document.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      state.svgPan.x += e.movementX;
      state.svgPan.y += e.movementY;
      ui.updateSVGTransform();
    });
    document.addEventListener('mouseup', () => { isPanning = false; });

    // SVG pan — touch
    let lastTouch = null;
    svgViewer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    svgViewer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && lastTouch) {
        state.svgPan.x += e.touches[0].clientX - lastTouch.x;
        state.svgPan.y += e.touches[0].clientY - lastTouch.y;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        ui.updateSVGTransform();
      }
    }, { passive: true });
    svgViewer.addEventListener('touchend', () => { lastTouch = null; }, { passive: true });

    // SVG wheel zoom
    svgViewer.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.svgZoom *= 1 + e.deltaY * -0.001;
      state.svgZoom = Math.max(0.1, Math.min(state.svgZoom, 10));
      ui.updateSVGTransform();
    }, { passive: false });

    ui.showToast('Welcome — pick a model from the Library', 'info');

  } catch (err) {
    console.error('[APP] Init error:', err);
    ui.showToast(`Init error: ${err.message}`, 'error');
  }
}

initApp();
