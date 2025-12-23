import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Switch, Route as RRRoute, BrowserRouter, useLocation, matchPath } from "react-router-dom";

import { NewList } from "./pages/new-list";
import { Editor } from "./pages/editor";
import { Home } from "./pages/home";
import { Unit } from "./pages/unit";
import { EditList } from "./pages/edit-list";
import { Magic } from "./pages/magic";
import { About } from "./pages/about";
import { NewFeatures } from "./pages/new-features/new-features";
import { Add } from "./pages/add";
import { Help } from "./pages/help";
import { Export } from "./pages/export";
import { Print } from "./pages/print";
import { DuplicateList } from "./pages/duplicate-list";
import { Rename } from "./pages/rename";
import { Datasets } from "./pages/datasets";
import { NotFound } from "./pages/not-found";
import { Privacy } from "./pages/privacy";
import { Changelog } from "./pages/changelog";
import { Import } from "./pages/import";
import { GameView } from "./pages/game-view";
import { CustomDatasets } from "./pages/custom-datasets";
import { setLists } from "./state/lists";
import { setSettings } from "./state/settings";
import { Header, Main } from "./components/page";
import PatchPanel from "./components/patch-panel/PatchPanel";
import PatchDetails from "./components/patch-panel/PatchDetails";

import "./App.css";
import "./wiki-adapter.css";

export const App = () => {
  const dispatch = useDispatch();
  const [isMobile, setIsMobile] = useState(
    window.matchMedia("(max-width: 1279px)").matches
  );

  useEffect(() => {
    const localLists = localStorage.getItem("owb.lists");
    const localSettings = localStorage.getItem("owb.settings");

    try {
      const parsed = JSON.parse(localLists) || [];
      // Ensure backward compatibility: lists created before patches existed may not have a `patches` field.
      const normalized = (parsed || []).map(l => ({ ...l, patches: Array.isArray(l.patches) ? l.patches : [] }));
      dispatch(setLists(normalized));
    } catch (e) {
      dispatch(setLists([]));
    }
    dispatch(setSettings(JSON.parse(localSettings)));
  }, [dispatch]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", (event) =>
        setIsMobile(event.matches)
      );
    } else {
      mediaQuery.addListener((event) => setIsMobile(event.matches));
    }
  }, []);

  return (
    <BrowserRouter>
      {/* Local Route wrapper: supports "?" query-style paths used across the app.
          If a path starts with "?" we match against `location.search` using
          simple dot-delimited segments ("?editor.:listId.unit.:unitId").
          Non-"?" paths delegate to react-router's Route unchanged. */}
      {/** We define a local `Route` component below to keep the rest of the file unchanged. */}
      <RouteHelper />
      {isMobile ? (
        <QueryAwareSwitch>
          <Route path="?editor.:listId.edit">{<EditList isMobile />}</Route>
          <Route path="?editor.:listId.export">{<Export isMobile />}</Route>
          <Route path="?editor.:listId.duplicate">
            {<DuplicateList isMobile />}
          </Route>
          <Route path="?editor.:listId.add.:type">{<Add isMobile />}</Route>
          <Route path="?editor.:listId.:type.:unitId.magic.:command">
            {<Magic isMobile />}
          </Route>
          <Route path="?editor.:listId.:type.:unitId.rename">
            {<Rename isMobile />}
          </Route>
          <Route path="?editor.:listId.:type.:unitId.items.:group">
            {<Magic isMobile />}
          </Route>
          <Route path="?editor.:listId.:type.:unitId">
            {<Unit isMobile />}
          </Route>
          <Route path="?editor.:listId">{<Editor isMobile />}</Route>
          <Route path="?import">{<Import isMobile />}</Route>
          <Route path="?new">{<NewList isMobile />}</Route>
          <Route path="?about">{<About />}</Route>
          <Route path="?help">{<Help />}</Route>
          <Route path="?custom-datasets">{<CustomDatasets />}</Route>
          <Route path="?privacy">{<Privacy />}</Route>
          <Route path="?datasets">{<Datasets isMobile />}</Route>
          <Route path="?changelog">{<Changelog />}</Route>
          <Route path="?print.:listId">{<Print />}</Route>
          <Route path="?game-view.:listId">{<GameView />}</Route>
          <Route path="/" exact>
            {<Home isMobile />}
          </Route>
          <Route path="*">{<NotFound />}</Route>
        </QueryAwareSwitch>
      ) : (
        <QueryAwareSwitch>
          <Route path="?new-features">{<NewFeatures />}</Route>
          <Route path="?about">{<About />}</Route>
          <Route path="?help">{<Help />}</Route>
          <Route path="?custom-datasets">{<CustomDatasets />}</Route>
          <Route path="?privacy">{<Privacy />}</Route>
          <Route path="?datasets">{<Datasets />}</Route>
          <Route path="?changelog">{<Changelog />}</Route>
          <Route path="?print.:listId">{<Print />}</Route>
          <Route path="?game-view.:listId">{<GameView />}</Route>
          <Route path="/">
            <Header headline="Old World Builder" hasMainNavigation />
            <Main isDesktop>
              <section className="column">
                <Home />
              </section>
              <section className="column">
                <QueryAwareSwitch>
                  <Route path="?new">{<NewList />}</Route>
                  <Route path="?import">{<Import />}</Route>
                  <Route path="?editor.:listId">{<Editor />}</Route>
                </QueryAwareSwitch>
              </section>
              <section className="column">
                <QueryAwareSwitch>
                  <Route path="?editor.:listId.edit">{<EditList />}</Route>
                  <Route path="?editor.:listId.export">{<Export />}</Route>
                  <Route path="?editor.:listId.duplicate">
                    <DuplicateList />
                  </Route>
                  <Route path="?editor.:listId.add.:type">{<Add />}</Route>
                  <Route path="?editor.:listId.:type.:unitId">{<Unit />}</Route>
                  {/* When creating a new list, show the PatchPanel in the third column */}
                  <Route path="?new/patches">
                    <PatchPanel />
                  </Route>
                </QueryAwareSwitch>
              </section>
              <section className="column">
                <QueryAwareSwitch>
                  <Route path="?editor.:listId.:type.:unitId.magic.:command">
                    <Magic />
                  </Route>
                  <Route path="?editor.:listId.:type.:unitId.rename">
                    <Rename />
                  </Route>
                  <Route path="?editor.:listId.:type.:unitId.items.:group">
                    <Magic />
                  </Route>
                  <Route path="?new.patches.details.:patchId">
                    {/* fourth column: patch details */}
                    <PatchDetails />
                  </Route>
                </QueryAwareSwitch>
              </section>
            </Main>
          </Route>
        </QueryAwareSwitch>
      )}
    </BrowserRouter>
  );
};

function RouteHelper() {
  // No UI; this component exists so we can declare the local Route wrapper
  return null;
}

function matchQuery(pattern, search) {
  const p = pattern.startsWith("?") ? pattern.slice(1) : pattern;
  const s = (search || "").startsWith("?") ? search.slice(1) : search || "";
  const pParts = p.split(".").filter(Boolean);
  const sParts = s.split(".").filter(Boolean);

  if (pParts.length === 0) return sParts.length === 0;

  // We'll walk pParts and sParts with two indices. Colon params may consume
  // multiple sParts until the next literal token in pParts is matched.
  let si = 0;
  for (let pi = 0; pi < pParts.length; pi++) {
    const pp = pParts[pi];

    if (pp.startsWith(":")) {
      // If this is the last pattern part, consume nothing-or-any and continue
      if (pi === pParts.length - 1) {
        // param at end can match zero or more segments
        si = sParts.length;
        break;
      }

      // otherwise, find the next literal token in pParts and advance si until it
      // matches that literal. If none found in remaining sParts, fail.
      const nextLiteral = pParts[pi + 1];
      if (!nextLiteral || nextLiteral.startsWith(":")) {
        // fallback: treat as single segment param
        if (si >= sParts.length) return false;
        si += 1;
        continue;
      }

      // Search for nextLiteral in sParts starting at current si
      let found = -1;
      for (let k = si; k < sParts.length; k++) {
        if (sParts[k] === nextLiteral) {
          found = k;
          break;
        }
      }
      if (found === -1) return false;
      // consume segments up to found (param), leave si at found to match the literal next
      si = found;
      continue;
    }

    // literal must match current sParts[si]
    if (si >= sParts.length) return false;
    if (pp !== sParts[si]) return false;
    si += 1;
  }

  // pattern matched the beginning correctly
  return true;
}

function QueryAwareSwitch({ children }) {
  const location = useLocation();
  const arr = React.Children.toArray(children).filter(Boolean);

  for (const child of arr) {
    const path = child.props && child.props.path;
    if (path && String(path).startsWith("?")) {
      if (matchQuery(path, location.search)) return child;
    } else {
      const m = matchPath(location.pathname, { path: path, exact: child.props && child.props.exact });
      if (m) return child;
    }
  }

  // fallback to explicit wildcard if present
  const wildcard = arr.find((c) => c.props && c.props.path === "*");
  return wildcard || null;
}

// Local Route wrapper used instead of react-router's Route inside this file.
function Route({ path, children, exact, ...rest }) {
  const location = useLocation();

  // If this is a regular path (not starting with ?), delegate to RRRoute
  if (!path || !String(path).startsWith("?")) {
    return (
      <RRRoute path={path} exact={exact} {...rest}>
        {children}
      </RRRoute>
    );
  }

  const matched = matchQuery(path, location.search);
  return matched ? (typeof children === "function" ? children() : children) : null;
}
