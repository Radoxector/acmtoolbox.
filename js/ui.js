// frontend/js/ui.js

import { state, EdgeType } from './state.js';

// ─── Toast ────────────────────────────────────────────────────────────────
export function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Status stats ─────────────────────────────────────────────────────────
export function updateStatus(data) {
  if (data.edges !== undefined) {
    document.getElementById('stE').textContent = data.edges.length;
  }
  if (data.n_islands !== undefined) {
    document.getElementById('stI').textContent = data.n_islands;
  }
}

// ─── Remaining unfolds ────────────────────────────────────────────────────
export function updateRemainingUnfolds(remaining) {
  const displayText = remaining > 999 ? '∞' : String(remaining);
  const badge = document.getElementById('unfoldCounter');
  if (badge) {
    badge.textContent = displayText;
    badge.className = 'unfold-badge';
    if (remaining === 0)      badge.classList.add('danger');
    else if (remaining <= 2)  badge.classList.add('warn');
  }
  const pip = document.getElementById('counterPip');
  if (pip) {
    pip.textContent = displayText;
    pip.className = 'counter-pip';
    if (remaining === 0)      pip.classList.add('danger');
    else if (remaining <= 2)  pip.classList.add('warn');
  }
  const unfoldBtn = document.getElementById('unfoldBtn');
  if (unfoldBtn) unfoldBtn.disabled = remaining === 0;
}

// ─── Display SVG with centering & non‑scaling strokes ─────────────────────
export function displaySVG(result) {
  const svg = renderPreviewSVG(result);
  state.svgString = svg;

  const svgLayer = document.getElementById('svgLayer');
  svgLayer.innerHTML = svg;
  svgLayer.style.display = 'block';

  const svgElem = svgLayer.querySelector('svg');
  if (svgElem) {
    // Ensure the SVG is visible and takes up space for measurement
    svgElem.style.display = 'block';
    // Use width/height 100% to ensure it actually expands to the layer size
    svgElem.style.width = '100%';
    svgElem.style.height = '100%';
    svgElem.style.maxWidth = 'none';
    svgElem.style.maxHeight = 'none';
  }

  const empty2d = document.getElementById('empty2d');
  if (empty2d) empty2d.style.display = 'none';

  state.svgZoom = 1;
  state.svgPan  = { x: 0, y: 0 };

  // Use a slightly longer delay to ensure browser has rendered the SVG content for bounding box calculation
  setTimeout(() => centerSVG(), 100);
}

// ─── Center SVG to fit container with 10% padding ─────────────────────────
export function centerSVG() {
  const svgLayer  = document.getElementById('svgLayer');
  const svgElem   = svgLayer?.querySelector('svg');
  const container = document.getElementById('svgViewer');
  if (!svgElem || !container) return;

  // Reset transform to measure natural size
  svgElem.style.transform = '';

  const cRect = container.getBoundingClientRect();
  if (cRect.width === 0 || cRect.height === 0) return;

  // Get the SVG's bounding box from its viewBox
  const viewBox = svgElem.getAttribute('viewBox');
  if (!viewBox) return;

  const parts = viewBox.trim().split(/\s+/);
  if (parts.length < 4) return;

  const vMinX = parseFloat(parts[0]);
  const vMinY = parseFloat(parts[1]);
  const vWidth = parseFloat(parts[2]);
  const vHeight = parseFloat(parts[3]);

  // Compute scale to fit viewBox into container with 10% padding
  const scaleX = (cRect.width * 0.9) / vWidth;
  const scaleY = (cRect.height * 0.9) / vHeight;
  let scale = Math.min(scaleX, scaleY, 10);

  // Calculate pan to center the viewBox content
  // We want the (vMinX, vMinY) to be at the visual center of the container after scaling
  // but since we use transform-origin: 0 0, we need to calculate the offset.
  
  // The center of the container in coordinate space:
  // cRect.width/2, cRect.height/2
  
  // The center of the SVG content in coordinate space:
  // vMinX + vWidth/2, vMinY + vHeight/2
  
  // To center it, we want:
  // panX + (vMinX + vWidth/2) * scale = cRect.width / 2
  // panY + (vMinY + vHeight/2) * scale = cRect.height / 2

  const panX = (cRect.width / 2) - (vMinX + vWidth / 2) * scale;
  const panY = (cRect.height / 2) - (vMinY + vHeight / 2) * scale;

  state.svgZoom = scale;
  state.svgPan  = { x: panX, y: panY };
  updateSVGTransform();
}

// ─── Apply CSS transform to SVG ───────────────────────────────────────────
export function updateSVGTransform() {
  const layer = document.getElementById('svgLayer');
  const svg   = layer?.querySelector('svg');
  if (svg) {
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `translate(${state.svgPan.x}px, ${state.svgPan.y}px) scale(${state.svgZoom})`;
  }
}

// ─── Render Preview SVG (web / screen) ────────────────────────────────────
export function renderPreviewSVG(result) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;
  const padding = 8;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  let svg = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  const addLines = (stroke, strokeWidth, type) => {
    edges.forEach((edge, i) => {
      if (edge_types[i] !== type) return;
      const [x1, y1] = verts2d[edge[0]];
      const [x2, y2] = verts2d[edge[1]];
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    });
  };

  addLines('#ff0000', 2, EdgeType.SEAM_CUT);
  addLines('#2563eb', 2, EdgeType.FOLD);
  addLines('#dc2626', 2, EdgeType.CUT);

  svg += `</svg>`;
  return svg;
}

// ─── Render Download SVG (CNC / mm based) ─────────────────────────────────
export function renderDownloadSVG(result) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;
  const padding = 2;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;
  const scale = 10; // 1 internal mm → 10 mm in file (so that 1 unit = 1 cm)

  let svg = `<svg width="${(w + padding * 2) * scale}mm" height="${(h + padding * 2) * scale}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  const addLines = (stroke, strokeWidth, type) => {
    edges.forEach((edge, i) => {
      if (edge_types[i] !== type) return;
      const [x1, y1] = verts2d[edge[0]];
      const [x2, y2] = verts2d[edge[1]];
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    });
  };

  addLines('#ff0000', 2, EdgeType.SEAM_CUT);
  addLines('#2563eb', 2, EdgeType.FOLD);
  addLines('#dc2626', 2, EdgeType.CUT);

  svg += `</svg>`;
  return svg;
}

// ─── Helper for download ──────────────────────────────────────────────────
export function renderSVGForDownload(result) {
  return renderDownloadSVG(result);
}