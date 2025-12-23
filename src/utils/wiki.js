// Utility to load MediaWiki page body and resolve internal links
export async function loadWikiBody(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.querySelector("#bodyContent");
    return body ? body.innerHTML : null;
  } catch (e) {
    return null;
  }
}

export function resolveInternalWikiUrl(href, baseUrl = "https://tow.huijiwiki.com/wiki") {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) return href;
  if (href.startsWith("/")) return `https://tow.huijiwiki.com${href}`;
  const currentPath = (baseUrl.split("/wiki/")[1] || "").split("/");
  const dir = currentPath.slice(0, -1).join("/");
  return `${baseUrl}/${dir ? dir + "/" : ""}${href}`;
}
