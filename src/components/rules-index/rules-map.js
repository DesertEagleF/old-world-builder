import { useState, useEffect } from "react";
import resourceLoader from "../../utils/resourceLoader";
import patchState from "../../utils/patchState";

export const rulesMap = {};
export const synonyms = {};

let cached = null;
let lastAppliedPatches = null;

// Function to clear cache when patch state changes
export function clearRulesCache() {
  cached = null;
  lastAppliedPatches = null;
}

export async function loadRulesMap() {
  const currentAppliedPatches = patchState.getApplied();

  // If we have cached data and patch state hasn't changed, return cached
  if (cached && JSON.stringify(lastAppliedPatches) === JSON.stringify(currentAppliedPatches)) {
    return cached;
  }

  // Clear cache if patch state has changed
  if (cached && JSON.stringify(lastAppliedPatches) !== JSON.stringify(currentAppliedPatches)) {
    cached = null;
  }
  try {
    const [remote, additional, remoteSynonyms] = await Promise.all([
      resourceLoader.getJson("rules-index-export"),
      resourceLoader.getJson("rules-additional"),
      resourceLoader.getJson("rules-synonyms"),
    ]);
    const remoteMap = remote && typeof remote === "object" ? remote : {};
    const add = additional && typeof additional === "object" ? additional : {};
    const syn = remoteSynonyms && typeof remoteSynonyms === "object" ? remoteSynonyms : {};

    // Start with base rules
    const combinedRules = { ...remoteMap, ...add };

    // Load patch-specific rules from applied patches
    const appliedPatches = patchState.getApplied();

    if (appliedPatches && Array.isArray(appliedPatches) && appliedPatches.length > 0) {
      try {
        // Load patch-specific additional rules for each applied patch
        const patchRulePromises = appliedPatches.map(async (patch) => {
          const patchId = patch.id || patch;
          if (typeof patchId === 'string') {
            try {
              // Try to load patch-specific rules file first (for army composition)
              const patchRules = await resourceLoader.getJson(`patches-${patchId}-rules`);
              if (patchRules) {
                return patchRules;
              }
              // Fallback to patch-specific rules-additional file (for links)
              const patchRulesAdditional = await resourceLoader.getJson(`patches-${patchId}-rules-additional`);
              return patchRulesAdditional;
            } catch (e) {
              // Ignore if no rules file found for this patch
              return null;
            }
          }
          return null;
        });

        const patchRulesResults = await Promise.all(patchRulePromises);

        // Merge patch rules into combined rules
        patchRulesResults.forEach((patchRules, index) => {
          if (patchRules && typeof patchRules === "object") {
            const patchId = appliedPatches[index]?.id || appliedPatches[index];
            // Mark patch rules with __patchedBy
            const markedPatchRules = {};
            Object.keys(patchRules).forEach(key => {
              markedPatchRules[key] = {
                ...patchRules[key],
                __patchedBy: patchId
              };
            });
            Object.assign(combinedRules, markedPatchRules);
          }
        });
      } catch (e) {
        // Continue without patch rules if there's an error
        console.warn('Failed to load patch rules:', e);
      }
    }

    // populate exported containers so non-react utilities can access them
    Object.assign(rulesMap, combinedRules);
    Object.assign(synonyms, syn);

    // Update patch state with the combined rules map
    patchState.setRulesMap(combinedRules);

    // Cache the result and update the last applied patches reference
    cached = { rulesMap: { ...rulesMap }, synonyms: { ...synonyms } };
    lastAppliedPatches = currentAppliedPatches ? [...currentAppliedPatches] : null;
    return cached;
  } catch (e) {
    Object.assign(rulesMap, {});
    Object.assign(synonyms, {});
    cached = { rulesMap: {}, synonyms: {} };
    lastAppliedPatches = currentAppliedPatches ? [...currentAppliedPatches] : null;
    return cached;
  }
}

export function useRules() {
  const [state, setState] = useState({ rulesMap: {}, synonyms: {}, loading: true });

  useEffect(() => {
    let mounted = true;

    // Load initial rules
    loadRulesMap().then((data) => {
      if (mounted) setState({ ...data, loading: false });
    });

    // Subscribe to patch changes to clear cache and reload when patches change
    const unsubscribe = patchState.subscribeApplied(() => {
      if (mounted) {
        // Clear cache when patch state changes
        clearRulesCache();
        setState(prev => ({ ...prev, loading: true }));

        // Reload rules with new patch state
        loadRulesMap().then((data) => {
          if (mounted) setState({ ...data, loading: false });
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
