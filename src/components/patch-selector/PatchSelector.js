import { useEffect, useState, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { Button } from '../button';
import { loadPatchIndex, reloadPatchIndex } from '../../utils/patch';
import { getJson } from '../../utils/resourceLoader';
import patchState from '../../utils/patchState';
import { useLanguage } from '../../utils/useLanguage';
import { useHistory } from 'react-router-dom';

// PatchSelector props:
// - onAppliedChange(appliedPatchObjects: Array)
// - onLocaleMapChange(localeMap: object)
export default function PatchSelector({ onAppliedChange = () => {}, onLocaleMapChange = () => {}, onShowPanel = null, startExpanded = false }) {
  const [available, setAvailable] = useState([]);
  const [selection, setSelection] = useState({ ids: [], order: [] });
  const [appliedIds, setAppliedIds] = useState([]);
  const [collapsed, setCollapsed] = useState(!startExpanded);
  const [isReloading, setIsReloading] = useState(false);

  // Load index & patch metadata (displayName) and locales
  async function loadAll() {
    try {
      const index = await loadPatchIndex();
      const list = Array.isArray(index) ? index : [];
      // Augment entries with displayName and meta by reading locale if present
      const patched = await Promise.all(list.map(async (e) => {
        const id = e.id;
        const type = e.type || 'patch';
        let displayName = id;
        let locale = null;
        let patchMeta = e.meta || null;
        let name = null;
        let brief = null;
        let dependencies = null;
        // try locale first
        try {
          const l = await getJson(`patches-${id}-locale`);
          if (l) {
            locale = l;
            if (locale && locale['patch-name']) {
              // prefer current language, fall back to en, then any available string
              const l2 = locale['patch-name'];
              const langKey = `name_${language}`;
              displayName = (l2 && (l2[langKey] || l2.name_en || Object.values(l2).find(v => typeof v === 'string'))) || displayName;
            }
            // notify parent about locale map incrementally
            onLocaleMapChange(prev => ({ ...(prev || {}), ...(locale || {}) }));
          }
        } catch (e) {
          // ignore missing locale
        }
        // try reading lightweight patch.json for name/brief/dependencies if present
        try {
          const pjson = await getJson(`patches-${id}-patch`);
          if (pjson) {
            patchMeta = patchMeta || pjson.meta || null;
            name = pjson.name || null;
            brief = pjson.brief || null;
            dependencies = pjson.dependencies || pjson.meta?.dependencies || null;
            // prefer locale name if available, else name.name_en
            if (!locale && name) {
              const langKey = `name_${language}`;
              displayName = name[langKey] || name.name_en || Object.values(name).find(v => typeof v === 'string') || displayName;
            }
          }
        } catch (e) {
          // ignore missing patch.json
        }
        const meta = { ...(patchMeta || {}) };
        if (dependencies) meta.dependencies = dependencies;
        return { id, type, meta: meta || null, displayName, name, brief };
      }));
      setAvailable(patched);
      // After we have the available list, reconcile with authoritative applied set
      try {
        const currentApplied = patchState.getApplied() || [];
        const appliedIdsNow = (currentApplied || []).map(o => o.id).filter(id => patched.find(p => p.id === id));
        setSelection({ ids: appliedIdsNow.slice(), order: appliedIdsNow.slice() });
        setAppliedIds(appliedIdsNow.slice());
      } catch (e) {
        // ignore
      }
      // reconcile selection and appliedIds
      setSelection(prev => ({ ids: prev.ids.filter(id => patched.find(p => p.id === id)), order: prev.order.filter(id => patched.find(p => p.id === id)) }));
      setAppliedIds(prev => prev.filter(id => patched.find(p => p.id === id)));
      return patched;
    } catch (e) {
      console.error('Failed loading patches', e);
      setAvailable([]);
      return [];
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep a ref to available for subscription handlers
  const availableRef = useRef(available);
  useEffect(() => { availableRef.current = available; }, [available]);
  const { language } = useLanguage();
  const history = useHistory();

  function localizedValue(item, field) {
    // item may have field as object (e.g. name or brief) or have displayName
    const valObj = item && item[field];
    if (valObj && typeof valObj === 'object') {
  // for name fields we expect keys like name_en, name_cn etc. for brief similarly.
      const langKey = `${field === 'name' ? 'name_' : 'brief_'}${language}`;
      if (valObj[langKey]) return valObj[langKey];
      if (valObj['name_en'] && field === 'name') return valObj['name_en'];
      if (valObj['brief_en'] && field === 'brief') return valObj['brief_en'];
      // fallback to any string properties
      const first = Object.values(valObj).find(v => typeof v === 'string');
      if (first) return first;
    }
    // fallback to displayName or id
    if (field === 'name') return item.displayName || item.id;
    return null;
  }

  // sync selection with global patchState so different instances stay consistent
  useEffect(() => {
    const unsub = patchState.subscribeApplied((objs) => {
      const list = objs || [];
      // filter to available ids and keep full objects
      const filteredObjects = list.filter(o => (availableRef.current || []).find(a => a.id === o.id));
      const filteredIds = filteredObjects.map(o => o.id);
      // Always mirror the authoritative applied set from patchState (Confirm is authoritative)
      // This ensures that an applied empty set ("(none)") clears any other selections.
      setSelection({ ids: filteredIds.slice(), order: filteredIds.slice() });
      setAppliedIds(filteredIds.slice());
      // notify local consumer (e.g. NewList) asynchronously with full objects
      // schedule as macrotask to avoid re-entrant updates across subscribers
      setTimeout(() => {
        try { onAppliedChange(filteredObjects); } catch (e) {}
      }, 0);
    });
    // also reconcile initial
    // Initialize selection to current applied set (may be empty) so instances stay consistent
    const initial = patchState.getApplied() || [];
    const ids = (initial || []).map(o => o.id);
    const filtered = ids.filter(id => (availableRef.current || []).find(a => a.id === id));
    setSelection({ ids: filtered.slice(), order: filtered.slice() });
    setAppliedIds(filtered.slice());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers for deps
  const getDeps = (entry) => (entry.meta && entry.meta.dependencies ? entry.meta.dependencies : (entry.dependencies || []));

  function enforceDepsOrder(order, availableList) {
    const pos = id => order.indexOf(id);
    let changed = true;
    const availMap = Object.fromEntries(availableList.map(a => [a.id, a]));
    while (changed) {
      changed = false;
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        const deps = getDeps(availMap[id] || {});
        for (const d of deps) {
          const pd = pos(d);
          if (pd === -1) continue;
          if (pd > i) {
            order.splice(pd, 1);
            order.splice(i, 0, d);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return order;
  }

  function togglePatch(id) {
    const cur = new Set(selection.ids);
    if (cur.has(id)) {
      // unselect id and any dependents
      cur.delete(id);
      for (const a of available) {
        const deps = getDeps(a) || [];
        if (deps.includes(id) && cur.has(a.id)) cur.delete(a.id);
      }
    } else {
      // add the selected one and its dependencies
      cur.add(id);
      const entry = available.find(a => a.id === id);
      const deps = getDeps(entry) || [];
      // only add dependencies that are present in the available list
      const availIds = (available || []).map(a => a.id);
      for (const d of deps) if (availIds.includes(d)) cur.add(d);
    }
    let order = selection.order.filter(x => cur.has(x));
    for (const idn of Array.from(cur)) if (!order.includes(idn)) order.push(idn);
    order = enforceDepsOrder(order, available);
    setSelection({ ids: Array.from(cur), order });
  }

  function moveUp(id) {
    const order = selection.order.slice();
    const i = order.indexOf(id);
    if (i <= 0) return;
    const entry = available.find(a => a.id === id);
    const deps = getDeps(entry) || [];
    let minIndex = 0;
    for (const d of deps) {
      const idx = order.indexOf(d);
      if (idx > minIndex) minIndex = idx;
    }
    const newIndex = Math.max(minIndex + 1, i - 1);
    order.splice(i, 1);
    order.splice(newIndex, 0, id);
    setSelection({ ...selection, order });
  }

  function moveDown(id) {
    const order = selection.order.slice();
    const i = order.indexOf(id);
    if (i === -1 || i >= order.length - 1) return;
    const dependents = available.filter(a => (getDeps(a) || []).includes(id)).map(a => a.id);
    let maxIndex = order.length - 1;
    for (const dep of dependents) {
      const idx = order.indexOf(dep);
      if (idx !== -1 && idx < maxIndex) maxIndex = idx - 1;
    }
    const newIndex = Math.min(maxIndex, i + 1);
    order.splice(i, 1);
    order.splice(newIndex, 0, id);
    setSelection({ ...selection, order });
  }

  async function confirm() {
    const ids = selection.order.slice();
    // mark as applied and load objects (confirm keeps same behavior)
    setAppliedIds(ids);
    const objects = await loadPatchObjects(ids);
    const filtered = objects.filter(Boolean);
    // schedule notifications in a macrotask to fully decouple from React's
    // current render cycle and avoid re-entrant update errors
    setTimeout(() => {
      try { onAppliedChange(filtered); } catch (e) {}
      try {
        patchState.setApplied(filtered);
        const mergedLocale = filtered.reduce((acc, o) => ({ ...(acc || {}), ...(o.locale || {}) }), {});
        if (Object.keys(mergedLocale || {}).length) {
          patchState.setLocaleMap(mergedLocale);
          onLocaleMapChange(mergedLocale);
        }
      } catch (e) {}
    }, 0);
  }

  // helper to load full patch objects for an array of ids
  async function loadPatchObjects(ids = []) {
    if (!ids || ids.length === 0) return [];
    try {
      const metaIndex = await loadPatchIndex();
      const objects = await Promise.all(ids.map(async (id) => {
        try {
          const entry = (metaIndex || []).find(e => e.id === id) || { id, type: 'patch' };
          const path = entry.type === 'full' ? `patches-${id}-full` : `patches-${id}-patch`;
          const data = (await getJson(path)) || {};
          // try locale
          let locale = null;
          try { locale = await getJson(`patches-${id}-locale`); } catch (e) {}
          let displayName = id;
          if (locale && locale['patch-name']) {
            const l = locale['patch-name'];
            const langKey = `name_${language}`;
            displayName = (l[langKey] || l.name_en || Object.values(l).find(v => typeof v === 'string')) || id;
          }
          return { id, type: entry.type || 'patch', data, locale, displayName };
        } catch (e) {
          return { id, type: 'patch', data: null };
        }
      }));
      return objects;
    } catch (e) {
      return [];
    }
  }

  function reset() {
    setSelection({ ids: appliedIds.slice(), order: appliedIds.slice() });
  }

  async function reloadAll() {
    setIsReloading(true);
    try {
      await reloadPatchIndex();
      await loadAll();
      // notify parent that available list changed only via locale merging; actual applied objects stay until confirmed
      // If appliedIds include ids no longer present, we keep them until user confirms reset or confirm again.
    } finally {
      setIsReloading(false);
    }
  }

  // Previously we auto-applied selection changes. That behavior caused notifications
  // on every user tweak; we now only notify consumers when the user explicitly
  // clicks Confirm. This avoids spamming other modules with intermediate states.

  // expose a compact collapsed summary string
  const summary = selection.order && selection.order.length > 0
    ? selection.order.map(id => {
      const p = available.find(x => x.id === id);
      return p ? localizedValue(p, 'name') || p.displayName || id : id;
    }).join(', ')
    : null;

  return (
    <div className="patch-selector" style={{ marginBottom: 12, border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!startExpanded && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => {
              if (typeof onShowPanel === 'function') return onShowPanel();
              setCollapsed(false);
            }}>
              <FormattedMessage id="patches.expand" defaultMessage="Show patches" />
            </Button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <Button type="secondary" onClick={reloadAll} disabled={isReloading}>
              <FormattedMessage id="patches.reload" defaultMessage="Reload patches" />
            </Button>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={selection.ids.length === 0} onChange={() => { setSelection({ ids: [], order: [] }); setAppliedIds([]); }} />
              <div style={{ marginLeft: 8 }}><div><FormattedMessage id="patches.none" defaultMessage="(none)" /></div></div>
            </div>
            {available.map(entry => {
              const deps = getDeps(entry) || [];
              const ids = available.map(a => a.id);
              const missing = deps.some(d => !ids.includes(d));
              const checked = selection.ids.includes(entry.id);
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <input type="checkbox" disabled={missing} checked={checked} onChange={() => togglePatch(entry.id)} />
                  <div style={{ marginLeft: 8, flex: 1 }}>
                    <div>
                      {localizedValue(entry, 'name')}
                      {missing ? (<span>&nbsp;<FormattedMessage id="patches.missingDeps" defaultMessage="(missing dependency)" /></span>) : null}
                    </div>
                    {deps.length>0 && <div style={{ fontSize: 12, color: '#666' }}><FormattedMessage id="patches.deps" defaultMessage="Depends: " />{deps.join(', ')}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Button
                      type="text"
                      size="small"
                      icon="preview"
                      color="dark"
                      label={`Details ${entry.id}`}
                      onClick={() => history.push(`?new.patches.details.${entry.id}`)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon="up"
                      color="dark"
                      label={`Move up ${entry.id}`}
                      onClick={() => moveUp(entry.id)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon="down"
                      color="dark"
                      label={`Move down ${entry.id}`}
                      onClick={() => moveDown(entry.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button type="secondary" onClick={confirm}><FormattedMessage id="patches.confirm" defaultMessage="Confirm" /></Button>
            <Button type="secondary" onClick={reset}><FormattedMessage id="patches.reset" defaultMessage="Reset" /></Button>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: '#444' }}>
            {summary ? <span>{summary}</span> : <span style={{ color: '#888' }}><FormattedMessage id="patches.none" defaultMessage="(none)" /></span>}
          </div>
        </div>
      )}
    </div>
  );
}