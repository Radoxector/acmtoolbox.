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

  // Header badge
  const badge = document.getElementById('unfoldCounter');
  if (badge) {
    badge.textContent = displayText;
    badge.className = 'unfold-badge';
    if (remaining === 0)      badge.classList.add('danger');
    else if (remaining <= 2)  badge.classList.add('warn');
  }

  // Pip on unfold button
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

  const empty2d = document.getElementById('empty2d');
  if (empty2d) empty2d.style.display = 'none';

  state.svgZoom = 1;
  state.svgPan  = { x: 0, y: 0 };

  // Wait two frames for layout to settle before centering
  requestAnimationFrame(() => requestAnimationFrame(() => centerSVG()));
}

// ─── Center SVG to fit container with 10% padding ────────────────────────
export function centerSVG() {
  const svgLayer  = document.getElementById('svgLayer');
  const svgElem   = svgLayer?.querySelector('svg');
  const container = document.getElementById('svgViewer');
  if (!svgElem || !container) return;

  // Clear transform for a clean measurement
  svgElem.style.transform = '';

  const cRect    = container.getBoundingClientRect();
  const sRect    = svgElem.getBoundingClientRect();
  if (!sRect.width || !sRect.height) return;

  const scaleX   = (cRect.width  * 0.9) / sRect.width;
  const scaleY   = (cRect.height * 0.9) / sRect.height;
  const fitScale = Math.min(scaleX, scaleY, 1);

  state.svgZoom = fitScale;
  state.svgPan  = { x: 0, y: 0 };
  updateSVGTransform();
}

// ─── Apply CSS transform to SVG ───────────────────────────────────────────
export function updateSVGTransform() {
  const layer = document.getElementById('svgLayer');
  const svg   = layer?.querySelector('svg');
  if (svg) {
    svg.style.transformOrigin = 'center center';
    svg.style.transform = `translate(${state.svgPan.x}px, ${state.svgPan.y}px) scale(${state.svgZoom})`;
  }
}

// ─── Render SVG string ────────────────────────────────────────────────────
function renderSVG(result) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;
  const unit = state.modelData?.unit || 'mm';

  const padding = 2;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  let svg = `<svg width="${w + padding * 2}mm" height="${h + padding * 2}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  // Seam lines — solid, no dash
  svg += `<g id="flat_seams">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.SEAM_CUT) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="0.5"/>`;
  });
  svg += `</g>`;

  // Fold lines — solid blue
  svg += `<g id="fold_lines">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.FOLD) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="1"/>`;
  });
  svg += `</g>`;

  // Cut lines — solid red
  svg += `<g id="cut_lines">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.CUT) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#dc2626" stroke-width="1"/>`;
  });
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}
