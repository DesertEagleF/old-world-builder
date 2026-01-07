// Runtime resource loader: centralizes JSON URLs so hosts can override them.
// Behavior:
// - Load `public/resource-config.json` (or use host-provided loader/URL) which maps
//   logical JSON keys (e.g. "games/patches/index.json") to full URLs (strings).
// - Provide `getJson(logicalPath)` which looks up the URL in the config and
//   fetches it. If no mapping exists, it falls back to resolving a public URL
//   for compatibility, but the recommended approach is to include the full URL
//   in the config.

const CONFIG_NAME = 'resource-config.json';
const CONFIG_NAME_OL = 'https://tow.huijiwiki.com/wiki/Data:resource-config.json?action=raw';

let _config = null;
let _loading = null;

export async function loadResourceConfig() {
    if (_config) return _config;
    if (_loading) return _loading;

    _loading = (async () => {
        // Node (tests) fallback: try to require public/resource-config.json
        if (typeof window === 'undefined') {
            try {
                // Use runtime require via eval to prevent webpack from statically
                // analyzing and bundling the entire public/ directory (which would
                // pull HTML files into the bundle and cause loader errors).
                // eslint-disable-next-line no-eval
                const nodeRequire = eval('require');
                const local = nodeRequire('../../public/' + CONFIG_NAME);
                _config = local || {};
                return _config;
            } catch (e) {
                _config = {};
                return _config;
            }
        }

        // Browser/runtime: allow host override via a loader hook or a URL
        try {
            if (typeof window.__RESOURCE_CONFIG_LOADER__ === 'function') {
                try {
                    const result = await window.__RESOURCE_CONFIG_LOADER__();
                    _config = result || {};
                    return _config;
                } catch (e) {
                    console.warn('resourceLoader: __RESOURCE_CONFIG_LOADER__ failed', e);
                }
            }

            // Require host to provide either a loader hook or an absolute URL for the
            // runtime config. We no longer attempt to derive the config location from
            // the current page URL to avoid losing path segments on hosted pages.
            const overrideUrl = (typeof window !== 'undefined' && window.__RESOURCE_CONFIG_URL__) ? window.__RESOURCE_CONFIG_URL__ : null;

            // If the host provided a URL, ensure it's absolute (http/https) and try it first.
            if (overrideUrl && /^https?:\/\//i.test(overrideUrl)) {
                try {
                    const res = await fetch(overrideUrl, { cache: 'no-store' });
                    if (!res.ok) {
                        console.warn('resourceLoader: failed to fetch config', overrideUrl, res.status);
                    } else {
                        const json = await res.json();
                        _config = json || {};
                        return _config;
                    }
                } catch (e) {
                    console.warn('resourceLoader: error fetching config from __RESOURCE_CONFIG_URL__', e);
                }
            }

            // If the host did not provide an explicit URL, attempt the online-config
            // location `CONFIG_NAME_OL` (must be absolute). This lets the hosted
            // environment serve a different config URL than the local test file.
            if (typeof CONFIG_NAME_OL === 'string' && /^https?:\/\//i.test(CONFIG_NAME_OL)) {
                try {
                    const res2 = await fetch(CONFIG_NAME_OL, { cache: 'no-store' });
                    if (res2.ok) {
                        const json2 = await res2.json();
                        _config = json2 || {};
                        return _config;
                    } else {
                        console.warn('resourceLoader: failed to fetch config from CONFIG_NAME_OL', CONFIG_NAME_OL, res2.status);
                    }
                } catch (e) {
                    console.warn('resourceLoader: error fetching config from CONFIG_NAME_OL', e);
                }
            }

            console.warn('resourceLoader: no absolute __RESOURCE_CONFIG_URL__ provided, no __RESOURCE_CONFIG_LOADER__, and CONFIG_NAME_OL fetch failed; runtime config not loaded');
            _config = {};
            return _config;
        } catch (e) {
            console.warn('resourceLoader: error loading config', e);
            _config = {};
            return _config;
        } finally {
            _loading = null;
        }
    })();

    return _loading;
}

// Get the configured URL for a logicalPath. If config provides a mapping (string),
// return it directly. If not, fall back to resolving public URL (compatibility).
export async function getResourceUrl(logicalPath) {
    const cfg = await loadResourceConfig();
    if (!cfg) {
        console.warn('resourceLoader: no config loaded; cannot resolve', logicalPath);
        return null;
    }

    const val = cfg[logicalPath];
    if (typeof val === 'string') {
        // If already absolute, return as-is
        if (/^https?:\/\//i.test(val)) return val;
        // Protocol-relative URLs are not allowed in this strict mode
        if (/^\/\//.test(val)) {
            console.warn('resourceLoader: protocol-relative URLs are not supported for', logicalPath, val);
            return null;
        }

        // Non-absolute: require the host to provide an absoluteBase in config
        const absBase = cfg.absoluteBase;
        if (typeof absBase === 'string' && /^https?:\/\//i.test(absBase)) {
            // combine base with value
            if (val.startsWith('/')) return absBase.replace(/\/$/, '') + val;
            return absBase.replace(/\/$/, '') + '/' + val.replace(/^\/*/, '');
        }

        console.warn('resourceLoader: non-absolute URL for', logicalPath, 'and no config.absoluteBase provided:', val);
        return null;
    }

    // If value is array or other, not a URL — cannot resolve to single URL
    console.warn('resourceLoader: mapping for', logicalPath, 'is not a URL string');
    return null;
}

// Fetch JSON using the configured URL for logicalPath. Hosts should list full
// URLs in the config to ensure the correct location is used.
export async function getJson(logicalPath) {
    // Node: if running tests, try to require the mapped file if possible
    if (typeof window === 'undefined') {
        try {
            const cfg = await loadResourceConfig();
            const val = cfg && cfg[logicalPath];
            if (typeof val === 'string') {
                // strip leading slash to require from public/
                const reqPath = val.replace(/^\//, '');
                try {
                    // Use runtime require to avoid bundler static analysis.
                    // eslint-disable-next-line no-eval
                    const nodeRequire = eval('require');
                    return nodeRequire('../../public/' + reqPath);
                } catch (e) {
                    // fallback: try requiring logicalPath directly
                }
            }
            // final fallback: try requiring logical path under public
            try {
                // Use runtime require to avoid bundler static analysis.
                // eslint-disable-next-line no-eval
                const nodeRequire = eval('require');
                return nodeRequire('../../public/' + logicalPath);
            } catch (e) {
                return null;
            }
        } catch (e) {
            return null;
        }
    }

    try {
        const url = await getResourceUrl(logicalPath);
        if (!url) {
            console.warn('resourceLoader.getJson: no URL for', logicalPath);
            return null;
        }
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.warn('resourceLoader.getJson: fetch failed', url, res.status);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.warn('resourceLoader.getJson error', e);
        return null;
    }
}

// Resolve an asset URL for a list-like mapping (e.g. 'assets/army-icons', filename)
export async function getAssetUrl(listKey, filename) {
    const cfg = await loadResourceConfig();
    if (!cfg) return null;

    const val = cfg[listKey];
    // If the config directly contains a mapping string (treat as base URL)
    if (typeof val === 'string') {
        // if val is absolute, combine
        if (/^https?:\/\//i.test(val)) {
            return val.replace(/\/$/, '') + '/' + filename.replace(/^\/*/, '');
        }
        // else if absoluteBase exists, combine with that
        const absBase = cfg.absoluteBase;
        if (typeof absBase === 'string' && /^https?:\/\//i.test(absBase)) {
            return absBase.replace(/\/$/, '') + '/' + String(val).replace(/^\/*/, '') + '/' + filename.replace(/^\/*/, '');
        }
        return null;
    }

    // If value is array (list of filenames), require absoluteBase to build full URL
    if (Array.isArray(val)) {
        // If the array contains absolute URLs, try to find the entry that matches
        // the requested filename by basename. If the array contains filenames
        // (not absolute), combine them with config.absoluteBase.
        const allAbsolute = val.every((v) => typeof v === 'string' && /^https?:\/\//i.test(v));

        if (allAbsolute) {
            // If caller passed an absolute URL already, return it
            if (typeof filename === 'string' && /^https?:\/\//i.test(filename)) return filename;

            // Try exact basename match (case-sensitive), then try case-insensitive,
            // then try filename-without-extension match, then substring match.
            const matchByBasename = (f) => {
                try {
                    const parts = f.split('/');
                    return parts[parts.length - 1];
                } catch (e) {
                    return f;
                }
            };

            const target = String(filename || '');
            // 1) exact basename
            for (const u of val) {
                if (matchByBasename(u) === target) return u;
            }
            // 2) case-insensitive basename
            for (const u of val) {
                if (matchByBasename(u).toLowerCase() === target.toLowerCase()) return u;
            }
            // 3) match without extension
            const stripExt = (n) => n.replace(/\.[^.]+$/, '');
            for (const u of val) {
                if (stripExt(matchByBasename(u)).toLowerCase() === stripExt(target).toLowerCase()) return u;
            }
            // 4) substring match
            for (const u of val) {
                if (u.toLowerCase().includes(target.toLowerCase())) return u;
            }

            console.warn('resourceLoader.getAssetUrl: no matching absolute URL in list for', listKey, filename);
            return null;
        }

        // Otherwise, array likely contains filenames (relative). Combine with absoluteBase
        const absBase = cfg.absoluteBase;
        if (typeof absBase === 'string' && /^https?:\/\//i.test(absBase)) {
            // If the array contains the requested filename, return constructed URL
            if (val.includes(filename)) {
                return absBase.replace(/\/$/, '') + '/' + listKey.replace(/^\/*/, '') + '/' + filename.replace(/^\/*/, '');
            }
            // As a fallback, return constructed URL anyway
            return absBase.replace(/\/$/, '') + '/' + listKey.replace(/^\/*/, '') + '/' + filename.replace(/^\/*/, '');
        }

        console.warn('resourceLoader.getAssetUrl: no absoluteBase provided for list', listKey);
        return null;
    }

    // Fallback: try direct resource key of listKey/filename
    try {
        const direct = await getResourceUrl(`${listKey}/${filename}`);
        return direct;
    } catch (e) {
        return null;
    }
}

export default {
    loadResourceConfig,
    getResourceUrl,
    getJson,
};
