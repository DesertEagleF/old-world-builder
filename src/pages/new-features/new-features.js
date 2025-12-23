// NewFeatures: content-only fragment that loads wiki body for dialog display
import { useIntl } from "react-intl";
import { useEffect, useRef, useState } from "react";
import { loadWikiBody, resolveInternalWikiUrl } from "../../utils/wiki";
import { Helmet } from "react-helmet-async";
import { Header, Main } from "../../components/page";

import "./new-features.css";

export const NewFeatures = () => {
  const intl = useIntl(); 
  const url = "https://tow.huijiwiki.com/wiki/EditorNewFeatures";
  const [isLoading, setIsLoading] = useState(true);
  const [contentHtml, setContentHtml] = useState(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const html = await loadWikiBody(url);
      if (html) {
        setContentHtml(html);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleLinkClick = async (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    const fullUrl = resolveInternalWikiUrl(href, url);
    if (!fullUrl) return;
    if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://") || fullUrl.startsWith("//")) return;
    event.preventDefault();
    setIsLoading(true);
    const html = await loadWikiBody(fullUrl);
    if (html) {
      setContentHtml(html);
      setFetchFailed(false);
    } else {
      setFetchFailed(true);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    el.addEventListener("click", handleLinkClick);
    return () => el.removeEventListener("click", handleLinkClick);
  }, [contentHtml]);

  return (
    <>
      <Helmet>
        <title>
          {`Old World Builder | ${intl.formatMessage({ id: "footer.about" })}`}
        </title>
      </Helmet>

      <Header headline="Old World Builder" hasMainNavigation hasHomeButton />

      <Main compact>
        <div ref={contentRef} className="new-features__content">
          {contentHtml ? (
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          ) : fetchFailed ? (
            <iframe src={url} title="Editor New Features" width="100%" height="400" />
          ) : (
            <div className="spinner">{isLoading ? "Loading..." : null}</div>
          )}
        </div>
      </Main>
    </>
  );
};
