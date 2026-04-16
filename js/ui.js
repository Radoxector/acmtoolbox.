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
  const svg = renderSVG(result, false); // false = preview mode
  state.svgString = svg;

  const svgLayer = document.getElementById('svgLayer');
  svgLayer.innerHTML = svg;

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

  // Wait for layout to settle (two frames)
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

  // Get SVG intrinsic dimensions from viewBox (most reliable)
  let svgWidth, svgHeight;
  const viewBox = svgElem.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/);
    if (parts.length === 4) {
      svgWidth  = parseFloat(parts[2]);
      svgHeight = parseFloat(parts[3]);
    }
  }
  
  // Fallback to getBoundingClientRect if viewBox is somehow invalid
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
  
  // Limit zoom range
  fitScale = Math.max(0.01, Math.min(fitScale, 10));

  // Compute center offset
  const visualWidth  = svgWidth  * fitScale;
  const visualHeight = svgHeight * fitScale;
  
  const panX = (cRect.width - visualWidth) / 2;
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

// ─── Render SVG string (preview or download) ──────────────────────────────
export function renderSVG(result, isDownload = false) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;

  const padding = isDownload ? 2 : 8;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  // For preview: no explicit width/height – CSS will size it
  // For download: use mm units so the file is ready for CNC
  let svg = isDownload
    ? `<svg width="${w + padding * 2}mm" height="${h + padding * 2}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`
    : `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  // Helper to add lines
  const addLines = (edgeIndices, stroke, strokeWidth, type) => {
    edges.forEach((edge, i) => {
      if (edge_types[i] !== type) return;
      const [x1, y1] = verts2d[edge[0]];
      const [x2, y2] = verts2d[edge[1]];
      // If downloading, the scale is multiplied by 10, so we must also multiply stroke-width by 10 to keep it visually same
      const finalStrokeWidth = isDownload ? strokeWidth * 10 : strokeWidth;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${finalStrokeWidth}" stroke-linecap="round"/>`;
    });
  };

  // Seam lines (light gray)
  addLines(edges, '#b89494', isDownload ? 0.5 : 1.2, EdgeType.SEAM_CUT);
  // Fold lines (blue)
  addLines(edges, '#2563eb', isDownload ? 1 : 2, EdgeType.FOLD);
  // Cut lines (red)
  addLines(edges, '#dc2626', isDownload ? 1 : 2, EdgeType.CUT);

  svg += `</svg>`;
  return svg;
}

// ─── Helper for download ──────────────────────────────────────────────────
export function renderSVGForDownload(result) {
  return renderSVG(result, true);
}