import { useState, useEffect } from "react";
import resourceLoader from "../../utils/resourceLoader";

export const rulesMap = {};
export const synonyms = {};

let cached = null;
export async function loadRulesMap() {
  if (cached) return cached;
  try {
    const [remote, additional, remoteSynonyms] = await Promise.all([
      resourceLoader.getJson("rules-index-export"),
      resourceLoader.getJson("rules-additional"),
      resourceLoader.getJson("rules-synonyms"),
    ]);
    const remoteMap = remote && typeof remote === "object" ? remote : {};
    const add = additional && typeof additional === "object" ? additional : {};
    const syn = remoteSynonyms && typeof remoteSynonyms === "object" ? remoteSynonyms : {};
    // populate exported containers so non-react utilities can access them
    Object.assign(rulesMap, { ...remoteMap, ...add });
    Object.assign(synonyms, syn);
    cached = { rulesMap: { ...rulesMap }, synonyms: { ...synonyms } };
    return cached;
  } catch (e) {
    Object.assign(rulesMap, {});
    Object.assign(synonyms, {});
    cached = { rulesMap: {}, synonyms: {} };
    return cached;
  }
}

export function useRules() {
  const [state, setState] = useState({ rulesMap: {}, synonyms: {}, loading: true });

  useEffect(() => {
    let mounted = true;
    loadRulesMap().then((data) => {
      if (mounted) setState({ ...data, loading: false });
    });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
