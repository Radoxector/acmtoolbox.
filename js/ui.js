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
     
     const bbox = svgElem.getBBox();
     const svgWidth = bbox.width;
     const svgHeight = bbox.height;
     
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
  const w = maxX - minX;
  const h = maxY - minY;
  const unit = state.modelData?.unit || 'mm';

  // To ensure scaling is correct, use viewBox based on bounding box.
  // We add a small padding to the viewBox so lines aren't clipped.
  const padding = 2;
  const viewBox = `${minX - padding} ${minY - padding} ${w + padding * 2} ${h + padding * 2}`;

  let svg = `<svg width="${w + padding * 2}mm" height="${h + padding * 2}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`;
  

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
