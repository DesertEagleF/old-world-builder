export function queryParts(search) {
  const s = (search || "").startsWith("?") ? search.slice(1) : search || "";
  // support both dot and slash separators used in various URLs
  return s.split(/[.\/]/).filter(Boolean);
}

export default { queryParts };
