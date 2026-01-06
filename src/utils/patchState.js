// Simple in-memory shared state for patch applied objects and locale map.
let _applied = [];
let _locale = {};
let _rules = {};
const _appliedSubs = new Set();
const _localeSubs = new Set();
const _rulesSubs = new Set();

export function getApplied() {
  return _applied.slice();
}

export function setApplied(objects) {
  _applied = objects ? objects.slice() : [];
  // notify subscribers asynchronously to avoid re-entrant synchronous updates
  setTimeout(() => {
    for (const s of _appliedSubs) s(_applied.slice());
  }, 0);
}

export function subscribeApplied(fn) {
  _appliedSubs.add(fn);
  return () => _appliedSubs.delete(fn);
}

export function getLocaleMap() {
  return { ..._locale };
}

export function setLocaleMap(map) {
  _locale = { ...(_locale || {}), ...(map || {}) };
  // notify locale subscribers asynchronously as well
  setTimeout(() => {
    for (const s of _localeSubs) s({ ..._locale });
  }, 0);
}

export function subscribeLocale(fn) {
  _localeSubs.add(fn);
  return () => _localeSubs.delete(fn);
}

export function getRulesMap() {
  return { ..._rules };
}

export function setRulesMap(map) {
  _rules = { ...(_rules || {}), ...(map || {}) };
  // notify rules subscribers asynchronously as well
  setTimeout(() => {
    for (const s of _rulesSubs) s({ ..._rules });
  }, 0);
}

export function subscribeRules(fn) {
  _rulesSubs.add(fn);
  return () => _rulesSubs.delete(fn);
}

const patchState = {
  getApplied,
  setApplied,
  subscribeApplied,
  getLocaleMap,
  setLocaleMap,
  subscribeLocale,
  getRulesMap,
  setRulesMap,
  subscribeRules,
};

export default patchState;
