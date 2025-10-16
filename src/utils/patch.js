/**
 * Deeply merge base data and patch data, supporting $append, $remove, $replace operators.
 * @param {any} base - The base data
 * @param {any} patch - The patch data
 * @returns {any} The merged result
 */
export function mergePatch(base, patch, patchId = null) {
    // Support top-level operator objects on the patch itself
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
        if ('$append' in patch && Object.keys(patch).length === 1) {
            const app = patch['$append'];
            // array append: concatenate
            if (Array.isArray(app)) {
                return Array.isArray(base) ? [...base, ...app] : [...app];
            }
            // object append: merge per-key into object base
            if (app && typeof app === 'object') {
                const cloned = JSON.parse(JSON.stringify(base || {}));
                for (const k of Object.keys(app)) {
                    // if both sides are arrays, concatenate, else recursively merge
                    if (Array.isArray(cloned[k]) && Array.isArray(app[k])) {
                        cloned[k] = [...cloned[k], ...app[k]];
                    } else {
                        cloned[k] = mergePatch(cloned[k], app[k], patchId);
                    }
                }
                return cloned;
            }
            // fallback: treat as empty
            return Array.isArray(base) ? base : {};
        }
        // $modify: perform a recursive partial merge (fall back to clone when base undefined)
        if ('$modify' in patch && Object.keys(patch).length === 1) {
            return mergePatch(base, patch['$modify'], patchId);
        }
        // support $delete (preferred) and $remove (legacy alias)
        if (('$delete' in patch || '$remove' in patch) && Object.keys(patch).length === 1) {
            const del = patch['$delete'] || patch['$remove'];
            if (Array.isArray(base)) {
                // arrays: remove primitives or objects by id
                if (base.length > 0 && base[0] && typeof base[0] === 'object' && 'id' in base[0]) {
                    const ids = Array.isArray(del) ? del : [];
                    return base.filter(b => !(b && b.id && ids.includes(b.id)));
                }
                return Array.isArray(del) ? base.filter(x => !del.includes(x)) : base;
            }
            // objects: if del is array of keys, remove those fields
            if (del && Array.isArray(del)) {
                const cloned = JSON.parse(JSON.stringify(base || {}));
                for (const k of del) delete cloned[k];
                return cloned;
            }
            return Array.isArray(base) ? base : {};
        }
        // $replace: apply partial modifications to existing structure
        if ('$replace' in patch && Object.keys(patch).length === 1) {
            const mod = patch['$replace'];
            if (typeof base === 'object' && base !== null) {
                return mergePatch(base, mod, patchId);
            }
            return deepClone(mod);
        }
    }

    // Arrays: merge by id when both sides are arrays of objects with ids, otherwise patch replaces
    if (Array.isArray(base) && Array.isArray(patch)) {
        // If elements look like objects with id fields, merge by id
        const hasId = base.some(b => b && typeof b === 'object' && 'id' in b) || patch.some(p => p && typeof p === 'object' && 'id' in p);
        if (hasId) {
            const baseMap = Object.fromEntries(base.map(item => [item.id, item]));
            patch.forEach(p => {
                if (p && typeof p === 'object' && 'id' in p && baseMap[p.id]) {
                    baseMap[p.id] = mergePatch(baseMap[p.id], p, patchId);
                    if (patchId && baseMap[p.id] && typeof baseMap[p.id] === 'object') baseMap[p.id].__patchedBy = patchId;
                } else if (p && typeof p === 'object' && 'id' in p) {
                    // clone patch object to avoid mutating original
                    const cloned = JSON.parse(JSON.stringify(p));
                    if (patchId && cloned && typeof cloned === 'object') cloned.__patchedBy = patchId;
                    baseMap[p.id] = cloned;
                } else {
                    // non-id items appended
                    const key = `__append_${Math.random().toString(36).slice(2)}`;
                    baseMap[key] = p;
                }
            });
            // Return array preserving original base order and then new items from patch (stable)
            const result = [];
            for (const b of base) {
                if (b && typeof b === 'object' && 'id' in b) {
                    result.push(baseMap[b.id]);
                    delete baseMap[b.id];
                } else {
                    // non-id base element: pick first matching key
                    const keys = Object.keys(baseMap);
                    if (keys.length) {
                        result.push(baseMap[keys[0]]);
                        delete baseMap[keys[0]];
                    }
                }
            }
            // remaining patch-added items
            for (const k of Object.keys(baseMap)) result.push(baseMap[k]);
            return result;
        }
        // default: concatenation
        return [...base, ...patch];
    }

        // Objects: merge recursively, supporting per-field operators
    if (typeof base === 'object' && base !== null && typeof patch === 'object' && patch !== null) {
        const result = { ...base };
        for (const key of Object.keys(patch)) {
            const pVal = patch[key];
            // operator object for this field
            if (pVal && typeof pVal === 'object' && !Array.isArray(pVal)) {
                    // support $modify at field level
                    if ('$modify' in pVal && Object.keys(pVal).length === 1) {
                        result[key] = mergePatch(base[key], pVal['$modify'], patchId);
                        continue;
                    }
                if ('$replace' in pVal && Object.keys(pVal).length === 1) {
                    // Apply partial modifications to existing field
                    result[key] = mergePatch(base[key], pVal['$replace'], patchId);
                    continue;
                }
                if ('$append' in pVal && Object.keys(pVal).length === 1) {
                    const app = pVal['$append'];
                    if (Array.isArray(app)) {
                        result[key] = Array.isArray(base[key]) ? [...base[key], ...app] : [...app];
                    } else if (app && typeof app === 'object') {
                        const cloned = JSON.parse(JSON.stringify(base[key] || {}));
                        for (const ak of Object.keys(app)) {
                            if (Array.isArray(cloned[ak]) && Array.isArray(app[ak])) {
                                cloned[ak] = [...cloned[ak], ...app[ak]];
                            } else {
                                cloned[ak] = mergePatch(cloned[ak], app[ak], patchId);
                            }
                        }
                        result[key] = cloned;
                    } else {
                        result[key] = Array.isArray(base[key]) ? base[key] : (Array.isArray(app) ? app : base[key]);
                    }
                    continue;
                }
                if (('$remove' in pVal) && Object.keys(pVal).length === 1) {
                    const del = pVal['$remove'];
                    if (Array.isArray(base[key])) {
                        if (base[key].length > 0 && base[key][0] && typeof base[key][0] === 'object' && 'id' in base[key][0]) {
                            const ids = Array.isArray(del) ? del : [];
                            result[key] = base[key].filter(b => !(b && b.id && ids.includes(b.id)));
                        } else {
                            result[key] = Array.isArray(del) ? base[key].filter(x => !del.includes(x)) : base[key];
                        }
                    } else if (typeof base[key] === 'object' && base[key] !== null && Array.isArray(del)) {
                        const cloned = JSON.parse(JSON.stringify(base[key]));
                        for (const k of del) delete cloned[k];
                        result[key] = cloned;
                    } else {
                        result[key] = {};
                    }
                    continue;
                }
            }
            result[key] = mergePatch(base[key], pVal, patchId);
        }
        return result;
    }

    // primitives: patch overrides
    // If patch is an object and we have a patchId, clone and annotate
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
        const cloned = JSON.parse(JSON.stringify(patch));
        if (patchId) cloned.__patchedBy = patchId;
        return cloned;
    }
    return patch;
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
            const res = await fetch('/games/patches/index.json');
            if (!res.ok) return [];
            const json = await res.json();
            if (!Array.isArray(json)) return [];
            _patchIndexCache = json;
            return json;
        } catch (e) {
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

export function clearPatchIndexCache() {
    _patchIndexCache = null;
    _patchIndexPromise = null;
}

function mergeObjectsConcatArrays(baseObj, patchObj, patchId = null) {
    if (baseObj === undefined) return deepClone(patchObj);
    if (patchObj === undefined) return deepClone(baseObj);
    if (typeof baseObj !== 'object' || baseObj === null) return deepClone(patchObj);
    if (typeof patchObj !== 'object' || patchObj === null) return deepClone(patchObj);

    const result = Array.isArray(baseObj) ? [] : { ...baseObj };
    for (const key of Object.keys(baseObj)) result[key] = deepClone(baseObj[key]);

    for (const key of Object.keys(patchObj)) {
        const pVal = patchObj[key];
        const bVal = result[key];
        if (Array.isArray(bVal) && Array.isArray(pVal)) {
            // If arrays of objects with ids, merge by id and mark last-patcher
            const hasId = bVal.some(b => b && typeof b === 'object' && 'id' in b) || pVal.some(p => p && typeof p === 'object' && 'id' in p);
            if (hasId) {
                const baseMap = Object.fromEntries((bVal || []).map(item => [item.id, deepClone(item)]));
                for (const p of pVal) {
                    if (p && typeof p === 'object' && 'id' in p) {
                        if (baseMap[p.id]) {
                            baseMap[p.id] = mergeObjectsConcatArrays(baseMap[p.id], p, patchId);
                        } else {
                            baseMap[p.id] = deepClone(p);
                        }
                        if (patchId) baseMap[p.id].__patchedBy = patchId;
                    } else {
                        // non-id items: append as-is
                        const keyApp = `__append_${Math.random().toString(36).slice(2)}`;
                        baseMap[keyApp] = p;
                    }
                }
                const resArr = [];
                for (const b of bVal) {
                    if (b && typeof b === 'object' && 'id' in b) {
                        resArr.push(baseMap[b.id]);
                        delete baseMap[b.id];
                    } else {
                        const keys = Object.keys(baseMap);
                        if (keys.length) {
                            resArr.push(baseMap[keys[0]]);
                            delete baseMap[keys[0]];
                        }
                    }
                }
                for (const k of Object.keys(baseMap)) resArr.push(baseMap[k]);
                result[key] = resArr;
            } else {
                result[key] = [...bVal, ...pVal];
            }
        } else if (Array.isArray(pVal) && bVal === undefined) {
            result[key] = deepClone(pVal);
        } else if (typeof bVal === 'object' && bVal !== null && typeof pVal === 'object' && pVal !== null) {
            result[key] = mergeObjectsConcatArrays(bVal, pVal, patchId);
        } else {
            // If a primitive or replacement object, clone and annotate if object
            const cloned = deepClone(pVal);
            if (patchId && cloned && typeof cloned === 'object' && !Array.isArray(cloned)) {
                cloned.__patchedBy = patchId;
            }
            result[key] = cloned;
        }
    }
    return result;
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
                const path = `/games/patches/${entry.id}/rules.json`;
                const res = await fetch(path);
                if (!res.ok) return { id: entry.id, type: entry.type || 'patch', data: null };
                const data = await res.json();
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
 * Return list of available patch entries from the index file.
 * Each entry is expected to have { id, type }.
 * If the index file is missing or invalid, returns an empty array.
 */
export async function listAvailablePatches() {
    try {
        const index = await loadPatchIndex();
        if (!Array.isArray(index)) return [];
        return index.map(e => ({ id: e.id, type: e.type || 'patch', meta: e.meta || null }));
    } catch (e) {
        return [];
    }
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
                const path = `/games/patches/${id}/rules.json`;
                const res = await fetch(path);
                if (!res.ok) return { id, type: entry.type || 'patch', data: null };
                const data = await res.json();
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
                const path = `/games/patches/${id}/${filename}`;
                const res = await fetch(path);
                if (!res.ok) return { id, type: entry.type || 'patch', data: null };
                const data = await res.json();
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
 * Merge gameSystems.armies with patches provided by patchList and return
 * { armies: mergedArmies, compositionSourcesMap }
 * patchList is an array of objects with shape { id, type, data }
 * This function contains the same behavior as the previous inline
 * implementation but centralizes the logic here.
 */
export function mergeGameSystemsWithPatches(gameSystems, patchList, gameId) {
    // Find the base system
    const baseSystem = (gameSystems || []).find(({ id }) => id === gameId);
    if (!baseSystem) return { armies: [], compositionSourcesMap: {} };

    // Deep copy armies
    let mergedArmies = (baseSystem.armies || []).map(a => JSON.parse(JSON.stringify(a)));
    let compositionSourcesMap = {};

    for (const entry of (patchList || [])) {
        const patchId = entry && entry.id;
        const type = entry && entry.type;
        const data = entry && entry.data;
        if (!data || !data.armies) continue;

        if (type === 'patch' || !type) {
            // Patch: merge each army by id
            (data.armies || []).forEach(patchArmy => {
                const idx = mergedArmies.findIndex(a => a.id === patchArmy.id);
                if (idx !== -1) {
                    // Record $append source if present
                    if (patchArmy.armyComposition) {
                        Object.entries(patchArmy.armyComposition).forEach(([op, arr]) => {
                            if (op === '$append') {
                                if (Array.isArray(arr)) {
                                    arr.forEach(item => {
                                        if (!compositionSourcesMap[patchArmy.id]) compositionSourcesMap[patchArmy.id] = {};
                                        compositionSourcesMap[patchArmy.id][item] = patchId;
                                    });
                                } else if (arr && typeof arr === 'object') {
                                    Object.keys(arr).forEach(itemKey => {
                                        if (!compositionSourcesMap[patchArmy.id]) compositionSourcesMap[patchArmy.id] = {};
                                        compositionSourcesMap[patchArmy.id][itemKey] = patchId;
                                    });
                                }
                            }
                        });
                    }
                    mergedArmies[idx] = mergePatch(mergedArmies[idx], patchArmy, patchId);
                }
            });
        } else if (type === 'full') {
            // Full: replace all matching armies
            (data.armies || []).forEach(fullArmy => {
                const idx = mergedArmies.findIndex(a => a.id === fullArmy.id);
                if (idx !== -1) {
                    mergedArmies[idx] = JSON.parse(JSON.stringify(fullArmy));
                    if (patchId && typeof mergedArmies[idx] === 'object') mergedArmies[idx].__patchedBy = patchId;
                    // All composition from this patch
                    if (fullArmy.armyComposition) {
                        if (!compositionSourcesMap[fullArmy.id]) compositionSourcesMap[fullArmy.id] = {};
                        // assume fullArmy.armyComposition is array
                        (fullArmy.armyComposition || []).forEach(item => {
                            compositionSourcesMap[fullArmy.id][item] = patchId;
                        });
                    }
                }
            });
        }
    }

    // Mark base for items not from patch/full
    mergedArmies.forEach(army => {
        if (army.armyComposition) {
            if (!compositionSourcesMap[army.id]) compositionSourcesMap[army.id] = {};
            (army.armyComposition || []).forEach(item => {
                if (!compositionSourcesMap[army.id][item]) compositionSourcesMap[army.id][item] = 'base';
            });
        }
    });

    return { armies: mergedArmies, compositionSourcesMap };
}