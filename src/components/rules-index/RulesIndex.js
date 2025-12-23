import React, { useState, useEffect, useRef } from "react";
import { FormattedMessage } from "react-intl";
import { useParams, useLocation } from "react-router-dom";
import { queryParts } from "../../utils/query";
import { useSelector, useDispatch } from "react-redux";
import classNames from "classnames";

import { Dialog } from "../../components/dialog";
import { Spinner } from "../../components/spinner";
import { normalizeRuleName } from "../../utils/string";
import { closeRulesIndex } from "../../state/rules-index";

import { rulesMap, synonyms } from "./rules-map";
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
  const rulePath = ruleData?.url;
  const rulePathB = rulePath ? `${rulePath}/en` : null;
  const urlForTab = rulePath
    ? `https://tow.huijiwiki.com/wiki/${selectedTab === "B" && rulePathB ? rulePathB : rulePath}`
    : null;

  const handleLinkClick = async (event) => {
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
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const bodyContent = doc.querySelector('#bodyContent');
      if (bodyContent) {
        setContentHtml(bodyContent.innerHTML);
        setFetchFailed(false);
      } else {
        setFetchFailed(true);
      }
    } catch (error) {
      setFetchFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!contentRef.current) return;

    const contentElement = contentRef.current;
    contentElement.addEventListener('click', handleLinkClick);

    return () => {
      contentElement.removeEventListener('click', handleLinkClick);
    };
  }, [contentHtml, urlForTab, selectedTab]);

  useEffect(() => {
    if (!urlForTab || !open) return;
    setIsLoading(true);
    setContentHtml(null);
    setFetchFailed(false);

    fetch(urlForTab)
      .then((res) => res.text())
      .then((htmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        const bodyContent = doc.querySelector("#bodyContent");
        if (bodyContent) {
          setContentHtml(bodyContent.innerHTML);
          setFetchFailed(false);
        } else {
          setFetchFailed(true);
        }
      })
      .catch(() => {
        setFetchFailed(true);
      })
      .finally(() => setIsLoading(false));
  }, [urlForTab, open]);

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