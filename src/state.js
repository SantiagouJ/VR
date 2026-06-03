export const state = {
  loadedModel: null,
  meshParts: [],
  originalMaterials: new Map(),
  appliedFinishes: new Map(),

  selectedMesh: null,
  selectedIndex: -1,
  selectedGroup: null,
  meshGroups: [],

  isInVR: false,
  modelFinishesLocked: false,

  activeCategory: null,
  uploadedTextures: [],
  audioMuted: false,
};
