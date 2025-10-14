/**
 * Deeply merge base data and patch data, supporting $append, $remove, $replace operators.
 * @param {any} base - The base data
 * @param {any} patch - The patch data
 * @returns {any} The merged result
 */
export function mergePatch(base, patch) {
    // Support top-level operator objects on the patch itself
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
        // If patch is an operator-only object (e.g. {"$replace": ...}) apply operator
        if ('$replace' in patch && Object.keys(patch).length === 1) {
            return patch['$replace'];
        }
        if ('$append' in patch && Object.keys(patch).length === 1) {
            return Array.isArray(base) ? [...base, ...patch['$append']] : [...patch['$append']];
        }
        if ('$remove' in patch && Object.keys(patch).length === 1) {
            return Array.isArray(base) ? base.filter(x => !patch['$remove'].includes(x)) : [];
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
                    baseMap[p.id] = mergePatch(baseMap[p.id], p);
                } else if (p && typeof p === 'object' && 'id' in p) {
                    baseMap[p.id] = p;
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
                if ('$replace' in pVal && Object.keys(pVal).length === 1) {
                    result[key] = pVal['$replace'];
                    continue;
                }
                if ('$append' in pVal && Object.keys(pVal).length === 1) {
                    result[key] = Array.isArray(base[key]) ? [...base[key], ...pVal['$append']] : [...pVal['$append']];
                    continue;
                }
                if ('$remove' in pVal && Object.keys(pVal).length === 1) {
                    result[key] = Array.isArray(base[key]) ? base[key].filter(x => !pVal['$remove'].includes(x)) : [];
                    continue;
                }
            }
            result[key] = mergePatch(base[key], pVal);
        }
        return result;
    }

    // primitives: patch overrides
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

function mergeObjectsConcatArrays(baseObj, patchObj) {
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
            result[key] = [...bVal, ...pVal];
        } else if (Array.isArray(pVal) && bVal === undefined) {
            result[key] = deepClone(pVal);
        } else if (typeof bVal === 'object' && bVal !== null && typeof pVal === 'object' && pVal !== null) {
            result[key] = mergeObjectsConcatArrays(bVal, pVal);
        } else {
            result[key] = deepClone(pVal);
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
            if (!merged[armyId]) {
                merged[armyId] = deepClone(patchArmyRules);
                continue;
            }
            if (type === 'full') {
                merged[armyId] = deepClone(patchArmyRules);
                continue;
            }
            merged[armyId] = mergeObjectsConcatArrays(merged[armyId], patchArmyRules);
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