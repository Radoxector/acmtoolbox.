// frontend/js/ui.js

import { state, EdgeType } from './state.js';

export function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

export function updateStatus(data) {
  if (data.edges !== undefined) {
    document.getElementById('stE').textContent = data.edges.length;
  }
  if (data.n_islands !== undefined) {
    document.getElementById('stI').textContent = data.n_islands;
  }
}

export function updateRemainingUnfolds(remaining) {
  const displayText = remaining > 999 ? '∞' : remaining;
  document.getElementById('unfoldCounter').textContent = displayText;
  
  const unfoldBtn = document.getElementById('unfoldBtn');
  if (unfoldBtn) {
    unfoldBtn.disabled = remaining === 0;
  }
}

export function displaySVG(result) {
  const svg = renderSVG(result);
  state.svgString = svg;
  const svgLayer = document.getElementById('svgLayer');
  svgLayer.innerHTML = svg;
  svgLayer.style.display = 'block';
  document.getElementById('empty2d').style.display = 'none';
  
  const svgElem = svgLayer.querySelector('svg');
  if (svgElem) {
    const container = svgLayer.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const svgWidth = svgElem.getBBox().width;
    const svgHeight = svgElem.getBBox().height;
    
    const offsetX = (containerWidth - svgWidth) / 2;
    const offsetY = (containerHeight - svgHeight) / 2;
    
    svgElem.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }
  
  state.svgZoom = 1;
  state.svgPan = { x: 0, y: 0 };
}

function renderSVG(result) {
  const { verts2d, edges, edge_types, fold_angles, fold_directions, bounding_box } = result;
  const [minX, minY, maxX, maxY] = bounding_box;
  const w = maxX - minX + 40;
  const h = maxY - minY + 40;
  const unit = state.modelData?.unit || 'mm';

  let svg = `<svg width="${w}${unit}" height="${h}${unit}" viewBox="${minX - 20} ${minY - 20} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<!-- Scale: 1 unit = 1${unit} -->\n`;
  svg += `<defs><style>svg { display: flex; align-items: center; justify-content: center; }</style></defs>\n`;
  svg += `<rect width="${w}" height="${h}" fill="white"/>`;

  // Seams layer
  svg += `<g id="flat_seams">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.SEAM_CUT) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="1.5,1.5"/>`;
  });
  svg += `</g>`;

  // Fold lines layer
  svg += `<g id="fold_lines">`;
  edges.forEach((edge, i) => {
    if (edge_types[i] !== EdgeType.FOLD) return;
    const [x1, y1] = verts2d[edge[0]];
    const [x2, y2] = verts2d[edge[1]];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="1"/>`;
  });
  svg += `</g>`;

  // Cut lines layer
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

export function updateSVGTransform() {
  const layer = document.getElementById('svgLayer');
  const svg = layer.querySelector('svg');
  if (svg) {
    svg.style.transform = `translate(${state.svgPan.x}px, ${state.svgPan.y}px) scale(${state.svgZoom})`;
  }
}
