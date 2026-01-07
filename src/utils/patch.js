/**
 * Deeply merge base data and patch data, supporting $append, $remove, $replace operators.
 * @param {any} base - The base data
 * @param {any} patch - The patch data
 * @returns {any} The merged result
 */
import { getJson } from './resourceLoader';

/**
 * Deeply merge base data and patch data with new rules:
 * 1. If base exists:
 *    - Primitive (number, string, boolean): replace
 *    - Array: replace
 *    - Object (not array, not primitive): merge
 * 2. If base doesn't exist: add
 * 3. null value: delete the item
 * @param {any} base - The base data
 * @param {any} patch - The patch data
 * @param {string} patchId - Optional patch identifier
 * @returns {any} The merged result
 */
export function mergePatch(base, patch, patchId = null) {
    // If patch is null, delete from base
    if (patch === null) {
        return null;
    }

    // If base doesn't exist, add the patch value
    if (base === undefined || base === null) {
        // Clone patch to avoid mutating the original
        const result = JSON.parse(JSON.stringify(patch));
        return result;
    }

    // If patch is not an object (primitive), replace base
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
        return JSON.parse(JSON.stringify(patch));
    }

    // If base is not an object (primitive or array), replace with patch
    if (typeof base !== 'object' || base === null || Array.isArray(base)) {
        const result = JSON.parse(JSON.stringify(patch));
        return result;
    }

    // Both are objects: merge recursively (use deep clone to preserve immutability)
    const result = JSON.parse(JSON.stringify(base));

    for (const key of Object.keys(patch)) {
        const patchVal = patch[key];
        const baseVal = base[key];

        // If patch value is null, delete this key
        if (patchVal === null) {
            delete result[key];
            continue;
        }

        // Recursively merge
        result[key] = mergePatch(baseVal, patchVal, patchId);
    }

    return result;
}

// --- Rules patch utilities ---
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// --- Patch index cache ---
let _patchIndexCache = null;
let _patchIndexPromise = null;

/**
 * Load /games/patches/index.json once and cache the result. Pass true to force reload.
 * Returns an array (possibly empty) or null on failure.
 */
export async function loadPatchIndex(forceReload = false) {
    if (!forceReload && _patchIndexCache) return _patchIndexCache;
    if (!forceReload && _patchIndexPromise) return _patchIndexPromise;
    _patchIndexPromise = (async () => {
        try {
                const json = await getJson('patches');
            if (!json) return [];

            // Support multiple shapes for index.json:
            // - legacy: top-level array: [ {id, type, ...}, ... ]
            // - new hosted format: { patches: [ ... ] }
            // - mapping: { "id": { type, meta... }, ... }
            let entries = [];
            if (Array.isArray(json)) {
                entries = json;
            } else if (json && Array.isArray(json.patches)) {
                entries = json.patches;
            } else if (json && typeof json === 'object') {
                // treat object as map of id -> entry
                entries = Object.keys(json).map(k => {
                    const v = json[k];
                    if (v && typeof v === 'object') return { id: k, ...v };
                    return { id: k, type: 'patch' };
                });
            }

            _patchIndexCache = Array.isArray(entries) ? entries : [];
            return _patchIndexCache;
        } catch (e) {
            console.warn('Error loading patch index via resourceLoader:', e);
            return [];
        } finally {
            _patchIndexPromise = null;
        }
    })();
    return _patchIndexPromise;
}

export async function reloadPatchIndex() {
    _patchIndexCache = null;
    return loadPatchIndex(true);
}

export function mergeRulesWithPatches(baseRules, patches) {
    const merged = deepClone(baseRules);
    for (const p of patches || []) {
        const { id: patchId, type, data } = p;
        const patchRules = data.rules || data;
        if (!patchRules || typeof patchRules !== 'object') continue;

        for (const armyId of Object.keys(patchRules)) {
            const patchArmyRules = patchRules[armyId];
            // Use mergePatch so operator-only wrapper objects are handled
            if (!merged[armyId]) {
                merged[armyId] = mergePatch(undefined, patchArmyRules, patchId);
                if (patchId && typeof merged[armyId] === 'object') merged[armyId].__patchedBy = patchId;
                continue;
            }
            if (type === 'full') {
                merged[armyId] = mergePatch({}, patchArmyRules, patchId);
                if (patchId && typeof merged[armyId] === 'object') merged[armyId].__patchedBy = patchId;
                continue;
            }
            merged[armyId] = mergePatch(merged[armyId], patchArmyRules, patchId);
            if (patchId && typeof merged[armyId] === 'object') merged[armyId].__patchedBy = patchId;
        }
    }
    return merged;
}

export async function loadExternalRulePatches() {
    try {
        const index = await loadPatchIndex();
        if (!Array.isArray(index) || index.length === 0) return [];
        const patches = await Promise.all(index.map(async (entry) => {
            try {
                const data = await getJson(`patches-${entry.id}-rules`);
                if (!data) return { id: entry.id, type: entry.type || 'patch', data: null };
                return { id: entry.id, type: entry.type || 'patch', data };
            } catch (e) {
                return { id: entry.id, type: entry.type || 'patch', data: null };
            }
        }));
        return patches.filter(p => p.data);
    } catch (e) {
        return [];
    }
}

export async function getMergedRules(baseRules, forceReload = false, selectedPatchIds = null) {
    // If caller requests specific patch ids, load only those and bypass cache.
    if (Array.isArray(selectedPatchIds)) {
        const patches = await loadPatchesByIds(selectedPatchIds);
        return mergeRulesWithPatches(baseRules, patches);
    }
    // No specific selection: use global index + cache.
    if (getMergedRules._cached && !forceReload) return getMergedRules._cached;
    const patches = await loadExternalRulePatches();
    const merged = mergeRulesWithPatches(baseRules, patches);
    getMergedRules._cached = merged;
    return merged;
}

/**
 * Load specific patches by id. Returns array of { id, type, data } for found patches.
 */
export async function loadPatchesByIds(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    try {
        const index = await loadPatchIndex();
        const map = Object.fromEntries((index || []).map(e => [e.id, e]));
        const results = await Promise.all(ids.map(async (id) => {
            const entry = map[id] || { id, type: 'patch' };
            try {
                const data = await getJson(`patches-${id}-rules`);
                if (!data) return { id, type: entry.type || 'patch', data: null };
                return { id, type: entry.type || 'patch', data };
            } catch (e) {
                return { id, type: entry.type || 'patch', data: null };
            }
        }));
        return results.filter(p => p.data);
    } catch (e) {
        return [];
    }
}

/**
 * Merge arbitrary base data with an array of patch objects (each {id, type, data}).
 * This is a generic helper other modules can call to merge datasets provided by patches
 * (for example units, lores-of-magic, full datasets, etc.). It uses the operator-aware
 * mergePatch function so patches may contain $append/$modify/$delete/$replace semantics.
 *
 * @param {any} baseData - base dataset (object/array) to merge into
 * @param {Array<{id:string,type:string,data:any}>} patches - loaded patch objects
 * @returns {any} merged result
 */
export function mergeDataWithPatches(baseData, patches) {
    const merged = deepClone(baseData === undefined ? {} : baseData);
    for (const p of patches || []) {
        const patchId = p && p.id;
        const pdata = p && p.data;
        if (!pdata || typeof pdata !== 'object') continue;
        // patches may contain multiple top-level keys (rules, units, locale, etc.)
        for (const key of Object.keys(pdata)) {
            merged[key] = mergePatch(merged[key], pdata[key], patchId);
        }
    }
    return merged;
}

/**
 * Load arbitrary files from patch folders for a set of ids.
 * filename defaults to 'rules.json' but callers can pass 'patch.json', 'full.json', etc.
 * Returns array of { id, type, data } for found files (data is parsed JSON or null).
 */
export async function loadPatchFilesByIds(ids = [], filename = 'rules.json') {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    try {
        const index = await loadPatchIndex();
        const map = Object.fromEntries((index || []).map(e => [e.id, e]));
        const results = await Promise.all(ids.map(async (id) => {
            const entry = map[id] || { id, type: 'patch' };
            try {
                const key = `patches-${id}-${String(filename || '').replace(/\.json$/, '')}`;
                const data = await getJson(key);
                if (!data) return { id, type: entry.type || 'patch', data: null };
                return { id, type: entry.type || 'patch', data };
            } catch (e) {
                return { id, type: entry.type || 'patch', data: null };
            }
        }));
        return results.filter(p => p.data);
    } catch (e) {
        return [];
    }
}

/**
 * Load a base file (e.g. /games/the-old-world/<id>.json) and merge any patch files
 * from /games/patches/<patchId>/<filename> for the provided patch ids.
 * If no patch file exists for an id, that id is ignored. If no patches provided
 * or none contain the file, returns the base file content. Does not throw on 404.
 *
 * @param {string} basePath - path to base file without extension, e.g. 'games/the-old-world/vampire-counts'
 * @param {Array<string>} patchIds - array of patch ids to attempt to load
 * @param {string} filename - filename under the patch folder (defaults to same as base file name)
 */
export async function loadAndMergeBaseWithPatches(basePath, patchIds = [], filename = null) {
    // determine filename if not provided
    const fileName = filename || basePath.split('/').pop();// + '.json'

    // load base
    let baseData = null;
    try {
        baseData = await getJson(`${basePath}`);
        if (!baseData) return null;
    } catch (e) {
        return null;
    }

    // no patches requested -> return base
    if (!Array.isArray(patchIds) || patchIds.length === 0) return baseData;

    // attempt to load patch files for provided ids
    const patches = await loadPatchFilesByIds(patchIds, fileName);
    if (!Array.isArray(patches) || patches.length === 0) return baseData;

    // merge using mergeDataWithPatches so operator semantics apply
    return mergeDataWithPatches(baseData, patches.map(p => ({ id: p.id, type: p.type, data: p.data })));
}

/**
 * Merge gameSystems.armies with patches provided by patchList and return
 * { armies: mergedArmies, compositionSourcesMap }
 * patchList is an array of objects with shape { id, type, data }
 * This function contains the same behavior as the previous inline
 * implementation but centralizes the logic here.
 */
export function mergeGameSystemsWithPatches(gameSystems, patchList, gameId) {
    // Ensure patchList is always an array
    const patches = Array.isArray(patchList) ? patchList : [];

    // Find the base system
    const baseSystem = (gameSystems || []).find(({ id }) => id === gameId);
    if (!baseSystem) return { armies: [], compositionSourcesMap: {} };

    // Deep copy armies
    let mergedArmies = (baseSystem.armies || []).map(a => JSON.parse(JSON.stringify(a)));
    let compositionSourcesMap = {};

    for (const entry of patches) {
        const patchId = entry && entry.id;
        const type = entry && entry.type;
        const data = entry && entry.data;
        if (!data || !data.armies) continue;

        if (type === 'patch' || !type) {
            // Patch: merge each army by id
            // New structure: armies is an object instead of array
            const patchArmies = data.armies;
            if (patchArmies && typeof patchArmies === 'object' && !Array.isArray(patchArmies)) {
                for (const [armyId, patchArmy] of Object.entries(patchArmies)) {
                    const idx = mergedArmies.findIndex(a => a.id === armyId);
                    if (idx !== -1) {
                        // Record old armyComposition before merge
                        const oldArmyComposition = mergedArmies[idx].armyComposition;
                        mergedArmies[idx] = mergePatch(mergedArmies[idx], patchArmy, patchId);
                        const newArmyComposition = mergedArmies[idx].armyComposition;

                        // If armyComposition was modified, record the source
                        if (patchArmy.armyComposition && newArmyComposition && oldArmyComposition !== newArmyComposition) {
                            if (!compositionSourcesMap[armyId]) compositionSourcesMap[armyId] = {};
                            if (Array.isArray(newArmyComposition) && Array.isArray(oldArmyComposition)) {
                                // Find newly added items
                                newArmyComposition.forEach(item => {
                                    if (!oldArmyComposition.includes(item)) {
                                        compositionSourcesMap[armyId][item] = patchId;
                                    }
                                });
                            }
                        }
                    }
                }
            }
        } else if (type === 'full') {
            // Full: replace all matching armies
            const fullArmies = data.armies;
            if (fullArmies && typeof fullArmies === 'object' && !Array.isArray(fullArmies)) {
                for (const [armyId, fullArmy] of Object.entries(fullArmies)) {
                    const idx = mergedArmies.findIndex(a => a.id === armyId);
                    if (idx !== -1) {
                        mergedArmies[idx] = mergePatch(mergedArmies[idx], fullArmy, patchId);
                        if (patchId && typeof mergedArmies[idx] === 'object') mergedArmies[idx].__patchedBy = patchId;

                        // Record composition sources
                        const newArmyComposition = mergedArmies[idx].armyComposition;
                        if (fullArmy.armyComposition && newArmyComposition) {
                            if (!compositionSourcesMap[armyId]) compositionSourcesMap[armyId] = {};
                            if (Array.isArray(newArmyComposition)) {
                                newArmyComposition.forEach(item => {
                                    compositionSourcesMap[armyId][item] = patchId;
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Mark base for items not from patch/full
    mergedArmies.forEach(army => {
        if (army.armyComposition) {
            if (!compositionSourcesMap[army.id]) compositionSourcesMap[army.id] = {};
            // Handle different armyComposition types: array or object
            if (Array.isArray(army.armyComposition)) {
                army.armyComposition.forEach(item => {
                    if (!compositionSourcesMap[army.id][item]) compositionSourcesMap[army.id][item] = 'base';
                });
            }
        }
    });

    return { armies: mergedArmies, compositionSourcesMap };
}

// --- Patch manager state & convenience APIs (migrated from patchManager) ---
const _managerState = {
    available: null,
    selectedIds: [],
    lastApplied: null,
    baseSnapshot: null,
};

export function initBaseSnapshot(baseRules) {
    _managerState.baseSnapshot = deepClone(baseRules || {});
}

export async function getPatchesForIds(ids = []) {
    return await loadPatchesByIds(ids);
}

export async function getMergedPatchDataForIds(baseData, ids = [], filename = 'patch.json') {
    if (!Array.isArray(ids) || ids.length === 0) return JSON.parse(JSON.stringify(baseData));
    const patches = await loadPatchFilesByIds(ids, filename);
    return mergeDataWithPatches(baseData, patches);
}

export async function getMergedRulesForSelection(selectedIds = []) {
    if (!_managerState.baseSnapshot) throw new Error('patchManager: baseSnapshot not initialized. Call initBaseSnapshot(baseRules) first.');
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return deepClone(_managerState.baseSnapshot);

    const patches = await loadPatchesByIds(selectedIds);
    const merged = mergeRulesWithPatches(_managerState.baseSnapshot, patches);
    return merged;
}

const patchManager = {
    initBaseSnapshot,
    getPatchesForIds,
    getMergedRulesForSelection,
};

export default patchManager;