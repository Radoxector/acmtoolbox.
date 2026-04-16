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

// ─── Display SVG ──────────────────────────────────────────────────────────
export function displaySVG(result) {
  const svg = renderSVG(result);
  state.svgString = svg;

  const svgLayer = document.getElementById('svgLayer');
  svgLayer.innerHTML = svg;

  // Make SVG fill the container (overrides the mm width/height)
  const svgElem = svgLayer.querySelector('svg');
  if (svgElem) {
    svgElem.style.width = '100%';
    svgElem.style.height = '100%';
    svgElem.style.display = 'block';
  }

  const empty2d = document.getElementById('empty2d');
  if (empty2d) empty2d.style.display = 'none';

  state.svgZoom = 1;
  state.svgPan  = { x: 0, y: 0 };

  // Wait for layout to settle before centering
  requestAnimationFrame(() => requestAnimationFrame(() => centerSVG()));
}

// ─── Center SVG to fit container with 10% padding ────────────────────────
export function centerSVG() {
  const svgLayer  = document.getElementById('svgLayer');
  const svgElem   = svgLayer?.querySelector('svg');
  const container = document.getElementById('svgViewer');
  if (!svgElem || !container) return;

  // Reset transform to measure natural size
  svgElem.style.transform = '';

  // Get container dimensions
  const cRect = container.getBoundingClientRect();
  if (cRect.width === 0 || cRect.height === 0) return;

  // Get SVG intrinsic dimensions from viewBox or fallback to getBoundingClientRect
  let svgWidth, svgHeight;
  const viewBox = svgElem.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/);
    if (parts.length === 4) {
      svgWidth  = parseFloat(parts[2]);
      svgHeight = parseFloat(parts[3]);
    }
  }
  if (!svgWidth || !svgHeight) {
    const sRect = svgElem.getBoundingClientRect();
    svgWidth  = sRect.width;
    svgHeight = sRect.height;
  }
  if (svgWidth === 0 || svgHeight === 0) return;

  // Compute scale to fit with 10% padding
  const scaleX = (cRect.width  * 0.9) / svgWidth;
  const scaleY = (cRect.height * 0.9) / svgHeight;
  let fitScale = Math.min(scaleX, scaleY);
  // Limit zoom to 10x maximum (prevents ridiculous enlargement)
  fitScale = Math.min(fitScale, 10);
  // Also ensure we don't zoom out below 0.1 (makes lines too thin)
  fitScale = Math.max(fitScale, 0.1);

  // Compute center offset
  // After scaling, the SVG's visual size will be svgWidth * fitScale, svgHeight * fitScale
  const visualWidth  = svgWidth  * fitScale;
  const visualHeight = svgHeight * fitScale;
  const panX = (cRect.width  - visualWidth)  / 2;
  const panY = (cRect.height - visualHeight) / 2;

  state.svgZoom = fitScale;
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

// ─── Render SVG string ────────────────────────────────────────────────────
function renderSVG(result, isDownload = false) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;
  const unit = state.modelData?.unit || 'mm';

  const padding = isDownload ? 2 : 8;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  let svg = `<svg width="${w + padding * 2}mm" height="${h + padding * 2}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  // Seam lines
  svg += `<g id="flat_seams">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.SEAM_CUT) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    const strokeWidth = isDownload ? 0.5 : 1.2;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  });
  svg += `</g>`;

  // Fold lines
  svg += `<g id="fold_lines">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.FOLD) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    const strokeWidth = isDownload ? 1 : 2;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  });
  svg += `</g>`;

  // Cut lines
  svg += `<g id="cut_lines">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.CUT) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    const strokeWidth = isDownload ? 1 : 2;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#dc2626" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  });
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}