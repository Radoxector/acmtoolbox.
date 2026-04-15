// frontend/js/app.js

import { state } from './state.js';
import * as api from './api.js';
import * as viewer from './threejs-viewer.js';
import * as ui from './ui.js';

async function handleUnfold() {
  if (!state.modelData) {
    ui.showToast('No model loaded', 'error');
    return;
  }

  const payload = {
    model: {
      name: state.modelData.name,
      unit: state.modelData.unit,
      vertices: state.currentVerts,
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

    if (response.remaining_unfolds !== undefined) {
      const remaining = response.remaining_unfolds;
      if (typeof storeRemainingUnfolds === 'function') {
        storeRemainingUnfolds(remaining);
      }
      ui.updateRemainingUnfolds(remaining);
      
      if (remaining === 0) {
        ui.showToast(`Unfolded successfully! Limit reached - ${response.n_islands} island${response.n_islands !== 1 ? 's' : ''}`, 'warning');
      } else {
        const countText = remaining > 999 ? 'unlimited' : `${remaining} remaining`;
        ui.showToast(`Unfolded successfully! (${response.n_islands} island${response.n_islands !== 1 ? 's' : ''}, ${countText})`, 'success');
      }
    } else {
      ui.showToast(`Unfolded successfully (${response.n_islands} island${response.n_islands !== 1 ? 's' : ''})`, 'success');
    }
  } catch (err) {
    ui.showToast(`Unfold failed: ${err.message}`, 'error');
  }
}

function loadModel(modelData) {
  if (!modelData) {
    console.error('[MODEL] Invalid model data');
    ui.showToast('Invalid model data', 'error');
    return;
  }

  state.modelData = modelData;
  state.originalVerts = modelData.vertices;
  state.seamEdgeSet = new Set(modelData.seam_edges || []);

  applyScale();
  document.getElementById('fileName').textContent = modelData.name;
  document.getElementById('fileName').classList.add('ok');
  document.getElementById('unfoldBtn').disabled = false;
  document.getElementById('stV').textContent = modelData.vertices.length;
  document.getElementById('stF').textContent = modelData.faces.length;

  console.log(`[MODEL] Loaded: ${modelData.name} (V: ${modelData.vertices.length}, F: ${modelData.faces.length})`);
  ui.showToast(`Loaded: ${modelData.name}`, 'success');
}

function applyScale() {
  const x = parseFloat(document.getElementById('dimX').value) || 1;
  const y = parseFloat(document.getElementById('dimY').value) || 1;
  const z = parseFloat(document.getElementById('dimZ').value) || 1;

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
  document.getElementById('svgLayer').style.display = 'none';
  document.getElementById('empty2d').style.display = 'block';
  document.getElementById('downloadBtn').disabled = true;
}

function downloadSVG() {
  if (!state.svgString) return;
  const blob = new Blob([state.svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.modelData.name || 'unfold'}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

async function initApp() {
  console.log('[APP] Initializing application...');
  
  if (!isAuthenticated() || isTokenExpired()) {
    console.log('[APP] Not authenticated, redirecting to login');
    clearToken();
    redirectToLogin();
    return;
  }

  try {
    const username = getUsername();
    console.log(`[APP] User: ${username}`);
    document.getElementById('usernameDisplay').textContent = username || '?';

    const remaining = await (typeof fetchRemainingUnfolds === 'function' ? fetchRemainingUnfolds() : null) ?? getRemainingUnfolds();
    console.log(`[APP] Remaining unfolds: ${remaining}`);
    ui.updateRemainingUnfolds(remaining);

    setInterval(async () => {
      if (typeof fetchRemainingUnfolds === 'function') {
        const freshRemaining = await fetchRemainingUnfolds();
        if (freshRemaining !== null) {
          ui.updateRemainingUnfolds(freshRemaining);
        }
      }
    }, 30000);

    window.addEventListener('focus', async () => {
      if (typeof fetchRemainingUnfolds === 'function') {
        const freshRemaining = await fetchRemainingUnfolds();
        if (freshRemaining !== null) {
          ui.updateRemainingUnfolds(freshRemaining);
        }
      }
    });

    const models = await api.fetchModelList();
    console.log(`[APP] Got ${models.length} models`);

    viewer.init3D();

    const librarySlots = document.getElementById('librarySlots');
    if (models && models.length > 0) {
      models.forEach(modelInfo => {
        const slotEl = document.createElement('div');
        slotEl.className = 'library-slot';
         const hasImage = modelInfo.thumbnail && modelInfo.thumbnail.startsWith('data:');
         const imgPath = hasImage ? modelInfo.thumbnail : (modelInfo.id !== 'u-channel' && modelInfo.id !== 'box-tray' ? `${window.API_URL}/models/${modelInfo.id}.jpg` : null);
         
         slotEl.innerHTML = `
           <div class="library-slot-thumbnail">
             ${imgPath ? `<img src="${imgPath}" alt="${modelInfo.name}" onerror="this.style.display='none'; this.parentElement.querySelector('.library-slot-icon').style.display='block'">` : ''}
             <div class="library-slot-icon" style="display: ${imgPath ? 'none' : 'block'}">📦</div>
           </div>
           <div class="library-slot-name">${modelInfo.name}</div>
           <div class="library-slot-info">Ready</div>
         `;



        
        slotEl.addEventListener('click', async () => {
          ui.showToast('Loading model...', 'info');
          try {
            const model = await api.fetchModel(modelInfo.id);
            if (model) loadModel(model);
          } catch (err) {
            ui.showToast(`Failed to load model: ${err.message}`, 'error');
          }
        });
        librarySlots.appendChild(slotEl);
      });
    } else {
      const slotEl = document.createElement('div');
      slotEl.className = 'library-slot';
      slotEl.innerHTML = `
        <div class="library-slot-thumbnail">📦</div>
        <div class="library-slot-name">U-Channel Demo</div>
        <div class="library-slot-info">Ready</div>
      `;
      slotEl.addEventListener('click', async () => {
        ui.showToast('Loading demo model', 'info');
        try {
          const model = await api.fetchModel('u-channel');
          if (model) loadModel(model);
        } catch (err) {
          ui.showToast(`Failed to load demo: ${err.message}`, 'error');
        }
      });
      librarySlots.appendChild(slotEl);
    }

    document.getElementById('loadJsonBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const modelData = JSON.parse(text);
        loadModel(modelData);
      } catch (err) {
        ui.showToast(`Failed to parse JSON: ${err.message}`, 'error');
      }
    });

    document.getElementById('loadDemoBtn').addEventListener('click', async () => {
      ui.showToast('Loading demo model', 'info');
      try {
        const model = await api.fetchModel('u-channel');
        if (model) loadModel(model);
      } catch (err) {
        ui.showToast(`Failed to load demo: ${err.message}`, 'error');
      }
    });

    document.getElementById('unfoldBtn').addEventListener('click', handleUnfold);
    document.getElementById('downloadBtn').addEventListener('click', downloadSVG);

    ['dimX', 'dimY', 'dimZ'].forEach(id => {
      document.getElementById(id).addEventListener('change', applyScale);
    });

    document.getElementById('toolkitsBtn').addEventListener('click', () => {
      window.location.href = './dashboard.html';
    });

    document.getElementById('wireframeToggle').addEventListener('click', () => {
      if (state.meshWireframe) {
        state.meshWireframe.visible = !state.meshWireframe.visible;
        const btn = document.getElementById('wireframeToggle');
        btn.style.opacity = state.meshWireframe.visible ? '1' : '0.5';
      }
    });

    document.getElementById('colorInput').addEventListener('change', (e) => {
      state.materialColor = parseInt(e.target.value.slice(1), 16);
      if (state.meshMaterial) {
        state.meshMaterial.color.setHex(state.materialColor);
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        logoutUser();
      }
    });

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
      ui.showToast('Camera reset', 'info');
    });

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
      ui.updateSVGTransform();
    });

    let isPanning = false;
    document.getElementById('svgViewer').addEventListener('mousedown', () => {
      isPanning = true;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      state.svgPan.x += e.movementX;
      state.svgPan.y += e.movementY;
      ui.updateSVGTransform();
    });
    document.addEventListener('mouseup', () => {
      isPanning = false;
    });
    document.getElementById('svgViewer').addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = 1 + e.deltaY * -0.001;
      state.svgZoom *= factor;
      state.svgZoom = Math.max(0.1, Math.min(state.svgZoom, 10));
      ui.updateSVGTransform();
    }, { passive: false });

    let activeDivider = null;
    let pane1, pane2;
    const dividers = document.querySelectorAll('.divider');
    dividers.forEach((divider, index) => {
      divider.addEventListener('mousedown', (e) => {
        activeDivider = divider;
        if (index === 0) {
          pane1 = document.getElementById('pane3d');
          pane2 = document.getElementById('pane2d');
        } else if (index === 1) {
          pane1 = document.getElementById('pane2d');
          pane2 = document.getElementById('paneLibrary');
        }
        e.preventDefault();
      });
    });
    document.addEventListener('mousemove', (e) => {
      if (!activeDivider || !pane1 || !pane2) return;
      const container = document.getElementById('mainArea');
      const containerRect = container.getBoundingClientRect();
      const newX = e.clientX - containerRect.left;
      const flex1 = parseFloat(window.getComputedStyle(pane1).flex) || 1;
      const flex2 = parseFloat(window.getComputedStyle(pane2).flex) || 1;
      const width1 = pane1.offsetWidth;
      const width2 = pane2.offsetWidth;
      const totalWidth = width1 + width2;
      const ratio = newX / totalWidth;
      const newFlex1 = ratio * (flex1 + flex2);
      const newFlex2 = (flex1 + flex2) - newFlex1;
      pane1.style.flex = newFlex1;
      pane2.style.flex = newFlex2;
    });
    document.addEventListener('mouseup', () => {
      activeDivider = null;
      pane1 = null;
      pane2 = null;
    });

    ui.showToast('Welcome! Load a model or try the demo.', 'info');
  } catch (err) {
    console.error('[APP] Initialization error:', err);
    ui.showToast(`Error initializing app: ${err.message}`, 'error');
  }
}

initApp();
