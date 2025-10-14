import { listAvailablePatches, loadPatchesByIds, mergeRulesWithPatches } from './patch';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const state = {
  available: null,
  selectedIds: [],
  lastApplied: null,
  baseSnapshot: null,
};

/**
 * Initialize the manager with a base rules snapshot. Call from rules.js at module init.
 */
export function initBaseSnapshot(baseRules) {
  state.baseSnapshot = deepClone(baseRules || {});
}

export async function getAvailablePatches(forceReload = false) {
  if (state.available && !forceReload) return state.available;
  const entries = await listAvailablePatches();
  state.available = entries;
  return entries;
}

export async function getPatchesForIds(ids = []) {
  return await loadPatchesByIds(ids);
}

export async function getMergedRulesForSelection(selectedIds = []) {
  if (!state.baseSnapshot) throw new Error('patchManager: baseSnapshot not initialized. Call initBaseSnapshot(baseRules) first.');
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return deepClone(state.baseSnapshot);

  const patches = await loadPatchesByIds(selectedIds);
  // mergeRulesWithPatches expects patches in the shape [{id,type,data}, ...]
  const merged = mergeRulesWithPatches(state.baseSnapshot, patches);
  return merged;
}

export function getSelectionState() {
  return { selectedIds: [...state.selectedIds], lastApplied: state.lastApplied };
}

export default {
  initBaseSnapshot,
  getAvailablePatches,
  getPatchesForIds,
  getMergedRulesForSelection,
  getSelectionState,
};

