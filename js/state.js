// frontend/js/state.js

export const state = {
  modelData: null,
  originalVerts: [],
  currentVerts: [],
  currentFaces: [],
  seamEdgeSet: new Set(),
  unfoldResult: null,
  svgString: null,
  scene: null,
  camera: null,
  renderer: null,
  mesh: null,
  meshMaterial: null,
  meshWireframe: null,
  svgZoom: 1,
  svgPan: { x: 0, y: 0 },
  orbitControls: { 
    yaw: 0, 
    pitch: 0.5, 
    distance: 300,
    isAutoRotating: false
  },
  materialColor: 0x4a90e2,
  initialCameraPos: { x: 50, y: 40, z: 50 },
  isAutoRotating: false, // Global flag for auto-rotation
};

export const EdgeType = { CUT: 0, FOLD: 1, SEAM_CUT: 2 };
export const FoldDirection = { FLAT: 0, VALLEY: 1, MOUNTAIN: 2 };
