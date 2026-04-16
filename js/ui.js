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
  // Generate preview SVG (no mm dimensions, stroke widths for screen)
  const svg = renderSVG(result, false);
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

  requestAnimationFrame(() => requestAnimationFrame(() => centerSVG()));
}

// ─── Center SVG content (accounts for viewBox offset) ────────────────────
export function centerSVG() {
  const svgLayer  = document.getElementById('svgLayer');
  const svgElem   = svgLayer?.querySelector('svg');
  const container = document.getElementById('svgViewer');
  if (!svgElem || !container) return;

  svgElem.style.transform = '';
  const cRect = container.getBoundingClientRect();
  if (cRect.width === 0 || cRect.height === 0) return;

  const viewBox = svgElem.getAttribute('viewBox');
  if (!viewBox) return;
  const parts = viewBox.trim().split(/\s+/);
  if (parts.length !== 4) return;
  const [vbMinX, vbMinY, vbW, vbH] = parts.map(parseFloat);
  if (vbW === 0 || vbH === 0) return;

  const scaleX = (cRect.width  * 0.9) / vbW;
  const scaleY = (cRect.height * 0.9) / vbH;
  let fitScale = Math.min(scaleX, scaleY);
  fitScale = Math.max(0.01, Math.min(fitScale, 10));

  const contentCenterX = vbMinX + vbW / 2;
  const contentCenterY = vbMinY + vbH / 2;
  const targetX = cRect.width  / 2;
  const targetY = cRect.height / 2;

  const panX = targetX - contentCenterX * fitScale;
  const panY = targetY - contentCenterY * fitScale;

  state.svgZoom = fitScale;
  state.svgPan  = { x: panX, y: panY };
  updateSVGTransform();
}

export function updateSVGTransform() {
  const layer = document.getElementById('svgLayer');
  const svg   = layer?.querySelector('svg');
  if (svg) {
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `translate(${state.svgPan.x}px, ${state.svgPan.y}px) scale(${state.svgZoom})`;
  }
}

// ─── Render SVG (unified for preview and download) ───────────────────────
function renderSVG(result, isDownload = false) {
  const { verts2d, edges, edge_types, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX;
  const h = maxY - minY;
  const padding = isDownload ? 2 : 8;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  // For download, we need width/height in mm; for preview we omit them (CSS handles sizing)
  let svg = isDownload
    ? `<svg width="${(w + padding * 2)}mm" height="${(h + padding * 2)}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`
    : `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;

  // Stroke widths: preview uses thin lines; download scales strokes by 10x
  // because the whole file will be scaled by 10 later in app.js.
  const getStroke = (baseWidth) => isDownload ? baseWidth * 10 : baseWidth;

  edges.forEach((edge, i) => {
    const type = edge_types[i];
    if (type === undefined) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    let stroke, width;
    switch (type) {
      case EdgeType.SEAM_CUT:
        stroke = '#94a3b8';
        width = getStroke(0.8);
        break;
      case EdgeType.FOLD:
        stroke = '#2563eb';
        width = getStroke(1.5);
        break;
      case EdgeType.CUT:
        stroke = '#dc2626';
        width = getStroke(1.5);
        break;
      default: return;
    }
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
  });

  svg += `</svg>`;
  return svg;
}