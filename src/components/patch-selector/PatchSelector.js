import React, { useEffect, useState, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { Button } from '../button';
import { listAvailablePatches, loadPatchIndex, reloadPatchIndex } from '../../utils/patch';

// PatchSelector props:
// - onAppliedChange(appliedPatchObjects: Array)
// - onLocaleMapChange(localeMap: object)
export default function PatchSelector({ onAppliedChange = () => {}, onLocaleMapChange = () => {} }) {
  const [available, setAvailable] = useState([]);
  const [selection, setSelection] = useState({ ids: [], order: [] });
  const [appliedIds, setAppliedIds] = useState([]);
  const [collapsed, setCollapsed] = useState(true);
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
        try {
          const res = await fetch(`../../games/patches/${id}/locale.json`);
          if (res.ok) {
            locale = await res.json();
            if (locale && locale['patch-name']) {
              displayName = locale['patch-name'].name_en || displayName;
            }
            // notify parent about locale map incrementally
            onLocaleMapChange(prev => ({ ...(prev || {}), ...(locale || {}) }));
          }
        } catch (e) {
          // ignore missing locale
        }
        return { id, type, meta: e.meta || null, displayName };
      }));
      setAvailable(patched);
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
      cur.delete(id);
      // also remove dependents
      for (const a of available) {
        const deps = getDeps(a) || [];
        if (deps.includes(id) && cur.has(a.id)) cur.delete(a.id);
      }
    } else {
      cur.add(id);
      const entry = available.find(a => a.id === id);
      const deps = getDeps(entry) || [];
      for (const d of deps) cur.add(d);
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
    onAppliedChange(objects.filter(Boolean));
  }

  // helper to load full patch objects for an array of ids
  async function loadPatchObjects(ids = []) {
    if (!ids || ids.length === 0) return [];
    try {
      const metaIndex = await loadPatchIndex();
      const objects = await Promise.all(ids.map(async (id) => {
        try {
          const entry = (metaIndex || []).find(e => e.id === id) || { id, type: 'patch' };
          const path = entry.type === 'full' ? `../../games/patches/${id}/full.json` : `../../games/patches/${id}/patch.json`;
          const res = await fetch(path);
          const data = res.ok ? await res.json() : {};
          // try locale
          let locale = null;
          try { const lres = await fetch(`../../games/patches/${id}/locale.json`); if (lres.ok) locale = await lres.json(); } catch (e) {}
          const displayName = (locale && locale['patch-name'] && (locale['patch-name'].name_en)) || id;
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
      const patched = await loadAll();
      // notify parent that available list changed only via locale merging; actual applied objects stay until confirmed
      // If appliedIds include ids no longer present, we keep them until user confirms reset or confirm again.
    } finally {
      setIsReloading(false);
    }
  }

  // Auto-apply selection.order: whenever the working selection/order changes we will
  // load the corresponding patch objects and notify parent via onAppliedChange so
  // consumers (like NewList) immediately receive merged data.
  const _requestId = useRef(0);
  useEffect(() => {
    // don't auto-apply while we're reloading the index
    if (isReloading) return;
    const ids = selection.order.slice();
    // bump request id to cancel prior inflight results
    const myId = ++_requestId.current;
    (async () => {
      if (!ids || ids.length === 0) {
        // clear applied
        setAppliedIds([]);
        onAppliedChange([]);
        return;
      }
      const objects = await loadPatchObjects(ids);
      // only apply if this is the latest request
      if (myId !== _requestId.current) return;
      setAppliedIds(ids);
      onAppliedChange(objects.filter(Boolean));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.order, isReloading]);

  // expose a compact collapsed summary string
  const summary = selection.order && selection.order.length > 0
    ? selection.order.map(id => {
      const p = available.find(x => x.id === id);
      return p ? p.displayName || id : id;
    }).join(', ')
    : null;

  return (
    <div className="patch-selector" style={{ marginBottom: 12, border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold' }}><FormattedMessage id="patches.title" defaultMessage="Manage patches" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <FormattedMessage id="patches.expand" defaultMessage="Show patches" /> : <FormattedMessage id="patches.collapse" defaultMessage="Hide patches" />}
          </Button>
        </div>
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
              <input type="checkbox" checked={selection.ids.length === 0} onChange={() => setSelection({ ids: [], order: [] })} />
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
                      {entry.displayName || entry.id}
                      {missing ? (<span>&nbsp;<FormattedMessage id="patches.missingDeps" defaultMessage="(missing dependency)" /></span>) : null}
                    </div>
                    {deps.length>0 && <div style={{ fontSize: 12, color: '#666' }}><FormattedMessage id="patches.deps" defaultMessage="Depends: " />{deps.join(', ')}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => moveUp(entry.id)}>↑</button>
                    <button type="button" onClick={() => moveDown(entry.id)}>↓</button>
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