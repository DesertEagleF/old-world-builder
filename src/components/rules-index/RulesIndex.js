import React, { useState, useEffect, useRef, useCallback } from "react";
import { FormattedMessage } from "react-intl";
import { useParams, useLocation } from "react-router-dom";
import { queryParts } from "../../utils/query";
import { useSelector, useDispatch } from "react-redux";
import classNames from "classnames";

import { Dialog } from "../../components/dialog";
import { Spinner } from "../../components/spinner";
import { normalizeRuleName } from "../../utils/string";
import { closeRulesIndex } from "../../state/rules-index";

import { useRules } from "./rules-map";
import "./RulesIndex.css";

export const RulesIndex = () => {
  const { open, activeRule } = useSelector((state) => state.rulesIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [contentHtml, setContentHtml] = useState(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [selectedTab, setSelectedTab] = useState("A");
  const params = useParams() || {};
  let { listId } = params;
  const location = useLocation();
  if (!listId) {
    try {
      const parts = queryParts(location.search);
      if (parts[0] === 'editor') listId = parts[1];
    } catch (e) {}
  }
  const list = useSelector((state) =>
    state.lists.find(({ id }) => listId === id || (listId && id && id.includes(listId)))
  );
  const listArmyComposition = list?.armyComposition || list?.army;
  const dispatch = useDispatch();
  const contentRef = useRef(null);
  const { rulesMap, synonyms } = useRules();

  const processHtmlString = useCallback((htmlString) => {

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const topBody = doc.querySelector('#bodyContent');
    if (!topBody) {
      setFetchFailed(true);
      return;
    }
    const mwContent = topBody.querySelector('#mw-content-text');
    // prefer finding #bodyContent inside #mw-content-text, otherwise fall back
    const innerBody = mwContent ? mwContent.querySelector('#mw-parser-output') : null;

    let finalHtml = '';
    if (innerBody) {
      finalHtml = innerBody.innerHTML;
    } else if (mwContent) {
      finalHtml = mwContent.innerHTML;
    } else {
      finalHtml = topBody.innerHTML;
    }

    const firstHeading = doc.querySelector('#firstHeading');
    const h1 = firstHeading ? firstHeading.querySelector('h1') : null;
    const headingText = h1 ? h1.innerText.trim() : null;
    if (headingText) {
      finalHtml = `<div class="header-2">${headingText}</div>\n${finalHtml}`;
    }

    setContentHtml(finalHtml);
    setFetchFailed(false);
  }, [setContentHtml, setFetchFailed]);

  const handleClose = () => {
    setIsLoading(true);
    setContentHtml(null);
    setFetchFailed(false);
    dispatch(closeRulesIndex());
  };

  const normalizedName =
    activeRule.includes("renegade") && listArmyComposition?.includes("renegade")
      ? normalizeRuleName(activeRule)
      : normalizeRuleName(activeRule.replace(" {renegade}", ""));
  const synonym = synonyms[normalizedName];
  const ruleData = rulesMap[normalizedName] || rulesMap[synonym];
  let rulePath = ruleData?.url;

  // If we have applied patches and no specific patch URL, we need to check for patch-specific rule data
  if (rulePath && list?.patches && Array.isArray(list.patches) && list.patches.length > 0) {
    // Try to find patch-specific rule data from all applied patches
    for (const patch of list.patches) {
      const patchId = patch.id || patch;
      if (typeof patchId === 'string' && patchId !== 'base') {
        // Check if this rule was modified by the patch by looking for patch-specific entries
        const patchSpecificName = `${normalizedName}_${patchId}`;
        const patchRuleData = rulesMap[patchSpecificName] || rulesMap[synonyms[patchSpecificName]];

        if (patchRuleData && patchRuleData.url) {
          // Use the patch-specific URL
          rulePath = patchRuleData.url;
          console.log(`[RulesIndex] Found patch-specific rule data for ${patchSpecificName}, using URL: ${rulePath}`);
          break;
        }
      }
    }
    // If no patch-specific rule data found, don't modify the base URL
    // This ensures only rules actually modified by the patch get the patch ID appended
  }

  const rulePathB = rulePath ? `${rulePath}/en` : null;
  const urlForTab = rulePath
    ? `https://tow.huijiwiki.com/wiki/${selectedTab === "B" && rulePathB ? rulePathB : rulePath}`
    : null;

  const handleLinkClick = useCallback(async (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    const isExternal = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
    if (isExternal) return;

    event.preventDefault();

    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = `https://tow.huijiwiki.com${href}`;
    } else {
      const baseUrl = 'https://tow.huijiwiki.com/wiki';
      const currentPath = urlForTab.split('/wiki/')[1];
      const currentDir = currentPath.split('/').slice(0, -1).join('/');
      fullUrl = `${baseUrl}/${currentDir ? currentDir + '/' : ''}${href}`;
    }

    try {
      setIsLoading(true);
      const response = await fetch(fullUrl);
      const htmlString = await response.text();
      processHtmlString(htmlString);
    } catch (error) {
      setFetchFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [urlForTab, processHtmlString]);

  useEffect(() => {
    if (!contentRef.current) return;

    const contentElement = contentRef.current;
    contentElement.addEventListener('click', handleLinkClick);

    return () => {
      contentElement.removeEventListener('click', handleLinkClick);
    };
  }, [contentHtml, urlForTab, selectedTab, handleLinkClick]);

  useEffect(() => {
    if (!urlForTab || !open) return;
    setIsLoading(true);
    setContentHtml(null);
    setFetchFailed(false);

    fetch(urlForTab)
      .then((res) => res.text())
      .then((htmlString) => {
        processHtmlString(htmlString);
      })
      .catch(() => {
        setFetchFailed(true);
      })
      .finally(() => setIsLoading(false));
  }, [urlForTab, open, processHtmlString]);

  return (
    <Dialog open={open} onClose={handleClose}>
      {rulePath ? (
        <>
          <div className="rules-index__header">
            <div className="rules-index__tabs">
              <div className="rules-index__tab-buttons">
                <button
                  className={classNames("rules-index__tab", selectedTab === "A" && "rules-index__tab--active")}
                  onClick={() => setSelectedTab("A")}
                >
                  中文
                </button>
                <button
                  className={classNames("rules-index__tab", selectedTab === "B" && "rules-index__tab--active")}
                  onClick={() => setSelectedTab("B")}
                  disabled={!rulePathB}
                >
                  English
                </button>
              </div>
              <div className="rules-index__open-in-new">
                <button
                  className="rules-index__open-button"
                  onClick={() => {
                    if (urlForTab) window.open(urlForTab, "_blank", "noopener");
                  }}
                  disabled={!urlForTab}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h5V3H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5h-2v5H5V5z" />
                  </svg>
                  在wiki中打开/编辑
                </button>
              </div>
            </div>
          </div>

          <div className="rules-index__body" ref={contentRef}>
            {contentHtml ? (
              <div
                className={classNames(
                  "rules-index__content",
                  !isLoading && "rules-index__content--show"
                )}
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : fetchFailed ? (
              <>
                <iframe
                  onLoad={() => setIsLoading(false)}
                  className={classNames(
                    "rules-index__iframe",
                    !isLoading && "rules-index__iframe--show"
                  )}
                  src={urlForTab}
                  title="Warhammer: The Old World Online Rules Index"
                  width="100%"
                  height="100%"
                />
                {isLoading && <Spinner className="rules-index__spinner" />}
              </>
            ) : (
              <Spinner className="rules-index__spinner" />
            )}
          </div>
        </>
      ) : (
        <p>
          <FormattedMessage id="editor.noRuleFound" />
        </p>
      )}
    </Dialog>
  );
};