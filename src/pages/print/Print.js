import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { queryParts } from '../../utils/query';
import { useSelector } from "react-redux";
import { FormattedMessage, useIntl } from "react-intl";

import { Header } from "../../components/page";
import { Button } from "../../components/button";
import { Stats } from "../../components/stats";
import { getAllOptions } from "../../utils/unit";
import { getUnitPoints, getPoints, getAllPoints } from "../../utils/points";
import { useLanguage } from "../../utils/useLanguage";
import { getStats, getUnitName } from "../../utils/unit";
import { nameMap } from "../magic";
import { getGameSystems } from "../../utils/game-systems";
import { useRules } from "../../components/rules-index/rules-map";
import resourceLoader, { getJson } from "../../utils/resourceLoader";
import { normalizeRuleName } from "../../utils/string";

import "./Print.css";

export const Print = () => {
  const params = useParams() || {};
  let { listId } = params;
  const location = useLocation();
  if (!listId) {
    try {
      const parts = queryParts(location.search);
      if (parts[0] === 'print' || parts[0] === 'editor') {
        // print route can be ?print.<listId> or editor route may be ?editor.<listId>
        listId = listId || parts[1];
      }
    } catch (e) {}
  }
  const { language } = useLanguage();
  const intl = useIntl();
  const { rulesMap, synonyms } = useRules();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isShowList, setIsShowList] = useState(false);
  const [showSpecialRules, setShowSpecialRules] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showCustomNotes, setShowCustomNotes] = useState(true);
  const [troopTypeSpecialRules, setTroopTypeSpecialRules] = useState(null);
  const [unitTroopTypeMap, setUnitTroopTypeMap] = useState({});
  const [armySpecialRules, setArmySpecialRules] = useState([]);
  const [aggregatedRules, setAggregatedRules] = useState([]);
  const [loadingAggregatedRules, setLoadingAggregatedRules] = useState(false);
  const list = useSelector((state) =>
    state.lists.find(({ id }) => listId === id || (listId && id && id.includes(listId)))
  );

  useEffect(() => {
    const loadData = async () => {
      if (list && list.game === "the-old-world") {
        try {
          const [troopTypeData, unitTroopTypeData, armySpecialData] = await Promise.all([
            getJson("troop-type-special-rules"),
            getJson("unit-troop-type"),
            getJson("army-special-rules"),
          ]);
          setTroopTypeSpecialRules(troopTypeData || null);
          setUnitTroopTypeMap(unitTroopTypeData || {});

          // load army special rules for this list
          const armyKey = list.armyComposition || list.army;
          const rawArmy = (armySpecialData && armySpecialData[armyKey]) || null;
          if (rawArmy) {
            const arr = Object.values(rawArmy).filter((r) => r && r.display !== false).map((r) => ({
              name_cn: r.name_cn || r.name_en,
              content_cn: r.content_cn || r.content_en,
            }));
            setArmySpecialRules(arr);
          } else {
            setArmySpecialRules([]);
          }
        } catch (e) {
          console.error("Print: failed loading supplemental data", e);
        }
      } else {
        // ensure state cleared when not applicable
        setTroopTypeSpecialRules(null);
        setUnitTroopTypeMap({});
        setArmySpecialRules([]);
      }
    };

    loadData();
  }, [list && list.game, list && list.army, list && list.armyComposition]);

  useEffect(() => {
    // aggregate special rules (unit-level + troop-type) and fetch page contents
    const loadAggregated = async () => {
      if (!rulesMap) return;
      setLoadingAggregatedRules(true);

      const allUnits = [
        ...(list["characters"] || []),
        ...(list["lords"] || []),
        ...(list["heroes"] || []),
        ...(list["core"] || []),
        ...(list["special"] || []),
        ...(list["rare"] || []),
        ...(list["mercenaries"] || []),
        ...(list["allies"] || []),
      ];

      const namesSet = new Map(); // key -> displayName

      const getTroopTypeSpecialRules = (troopType) => {
        if (!troopTypeSpecialRules || !troopType) return [];

        const typeIdMapping = {
          "monstrous-creature": "monstrous-creatures",
          "behemoth": "behemoths",
        };

        const mappedTypeId = typeIdMapping[troopType] || troopType;

        for (const mainType of troopTypeSpecialRules["troop-types"]) {
          const types = mainType.types || mainType.typres;
          if (!types) continue;
          const foundType = types.find((t) => t.id === mappedTypeId);
          if (foundType && foundType["special-rules"]) {
            return foundType["special-rules"];
          }
        }

        return [];
      };

      try {
        // collect names from unit specialRules
        allUnits.forEach((unit) => {
          // unit.specialRules may be object or array or null
          if (!unit || !unit.specialRules) return;
          let nameEn = unit.specialRules.name_en || unit.specialRules.name || null;
          if (!nameEn && Array.isArray(unit.specialRules)) {
            nameEn = unit.specialRules.map((r) => r.name).join(", ");
          }
          if (nameEn) {
            nameEn.split(/,\s*/).forEach((n) => {
              const key = normalizeRuleName(n);
              if (key) namesSet.set(key, n);
            });
          }

          // attach troop-type special rules
          const unitId = (unit.name || unit.unit || "").toLowerCase().replace(/\s+/g, "-");
          const troopTypes = unitTroopTypeMap[unitId] || [];
          troopTypes.forEach((tt) => {
            const ttRules = getTroopTypeSpecialRules(tt) || [];
            ttRules.forEach((r) => {
              if (r && r.name) {
                const key = normalizeRuleName(r.name);
                if (key) namesSet.set(key, r.name);
              }
            });
          });
        });

        // for each unique normalized name, attempt to fetch rule page content
        const cfg = await resourceLoader.loadResourceConfig();
        const results = [];
        for (const [key, displayName] of namesSet) {
          const synonym = synonyms && synonyms[key];
          const ruleData = (rulesMap && (rulesMap[synonym] || rulesMap[key])) || null;
          // build url
          let pageUrl = null;
          if (ruleData && ruleData.url) {
            if (/^https?:\/\//i.test(ruleData.url)) pageUrl = ruleData.url;
            else if (cfg && cfg.absoluteBase) pageUrl = cfg.absoluteBase.replace(/\/$/, "") + "/" + ruleData.url.replace(/^\/*/, "");
            else pageUrl = ruleData.url;
          }

          let contentHtml = "";
          if (pageUrl) {
            try {
              const resp = await fetch(pageUrl, { cache: "no-store" });
              if (resp && resp.ok) {
                const html = await resp.text();
                try {
                  const doc = new DOMParser().parseFromString(html, "text/html");
                  const body = doc.querySelector(".body-content");
                  contentHtml = body ? body.innerHTML : "";
                } catch (e) {
                  console.warn("Print: failed to parse HTML for", pageUrl, e);
                }
              }
            } catch (e) {
              console.warn("Print: failed to fetch rule page", pageUrl, e);
            }
          }

          results.push({ key, name: displayName, url: pageUrl, content: contentHtml });
        }

        setAggregatedRules(results);
      } catch (e) {
        console.error("Print: error aggregating rules", e);
        setAggregatedRules([]);
      } finally {
        setLoadingAggregatedRules(false);
      }
    };

    // only run when rulesMap is loaded
    if (rulesMap && Object.keys(rulesMap).length > 0) {
      loadAggregated();
    }
  }, [rulesMap, synonyms, troopTypeSpecialRules, unitTroopTypeMap, list]);

  if (!list) {
    return (
      <Header
        headline={intl.formatMessage({
          id: "print.title",
        })}
      />
    );
  }

  const armyComposition = list.armyComposition || list.army;
  const allPoints = getAllPoints(list);
  const charactersPoints = getPoints({ list, type: "characters" });
  const corePoints = getPoints({ list, type: "core" });
  const specialPoints = getPoints({ list, type: "special" });
  const rarePoints = getPoints({ list, type: "rare" });
  const mercenariesPoints = getPoints({ list, type: "mercenaries" });
  const alliesPoints = getPoints({ list, type: "allies" });
  const gameSystems = getGameSystems();
  const game = gameSystems.find((game) => game.id === list.game);
  const army = game.armies.find((army) => army.id === list.army);
  const armyName = army[`name_${language}`] || army.name_en;
  const armyCompositionName =
    list.army !== list.armyComposition && nameMap[list.armyComposition]
      ? nameMap[list.armyComposition][`name_${language}`] ||
        nameMap[list.armyComposition].name_en
      : "";
  const filters = [
    {
      name: intl.formatMessage({
        id: "export.specialRules",
      }),
      id: "specialRules",
      checked: showSpecialRules,
      callback: () => {
        setShowSpecialRules(!showSpecialRules);
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showStats",
      }),
      id: "stats",
      checked: showStats,
      callback: () => {
        setShowStats(!showStats);
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showPageNumbers",
      }),
      id: "pages",
      checked: showPageNumbers,
      callback: () => {
        setShowPageNumbers(!showPageNumbers);
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showCustomNotes",
      }),
      id: "customNotes",
      checked: showCustomNotes,
      callback: () => {
        setShowCustomNotes(!showCustomNotes);
      },
    },
    {
      name: intl.formatMessage({
        id: "export.visibleList",
      }),
      description: intl.formatMessage({
        id: "export.visibleListDescription",
      }),
      id: "isShowList",
      checked: isShowList,
      callback: () => {
        setIsShowList(!isShowList);
      },
    },
  ];
  const handlePrintClick = () => {
    setIsPrinting(true);
    document.title = `${list.name} - Old World Builder`;
    window.onafterprint = () => {
      document.title = "Old World Builder";
      setIsPrinting(false);
    };
    window.print();
  };
  const getSection = ({ type }) => {
    const units = list[type];

    return (
      <ul>
        {units.map((unit) => {
          const stats = getStats(unit, armyComposition, { rulesMap, synonyms });

          return (
            <li key={unit.id}>
              <h3>
                {unit.strength || unit.minimum ? (
                  <span className="print__strength">
                    {`${unit.strength || unit.minimum} `}
                  </span>
                ) : null}
                {getUnitName({ unit, language })}
                {!isShowList && (
                  <span className="print__points">
                    [
                    {getUnitPoints(unit, {
                      armyComposition,
                    })}{" "}
                    <FormattedMessage id="app.points" />]
                  </span>
                )}
              </h3>
              {getAllOptions(unit, {
                noMagic: isShowList,
                pageNumbers: showPageNumbers,
                armyComposition,
                maps: { rulesMap, synonyms },
              })}
              {showSpecialRules && unit.specialRules ? (
                <>
                  <p className="print__special-rules">
                    <i>
                      <b>
                        <FormattedMessage id="unit.specialRules" />:
                      </b>{" "}
                      {(
                        unit.specialRules[`name_${language}`] ||
                        unit.specialRules.name_en
                      )?.replace(/ *\{[^)]*\}/g, "")}
                    </i>
                  </p>
                  {unit.detachments &&
                    unit.detachments.map((detachment) => {
                      const specialRulesDetachment =
                        detachment.armyComposition?.[
                          list?.armyComposition || list?.army
                        ]?.specialRules || detachment.specialRules;

                      if (!specialRulesDetachment?.name_en) {
                        return null;
                      }

                      return (
                        <p
                          className="game-view__special-rules"
                          key={detachment.id}
                        >
                          <b>
                            <i>
                              <FormattedMessage id="unit.specialRules" /> (
                              {detachment[`name_${language}`] ||
                                detachment.name_en}
                              ):
                            </i>
                          </b>{" "}
                          {(
                            specialRulesDetachment[`name_${language}`] ||
                            specialRulesDetachment.name_en
                          ).replace(/ *\{[^)]*\}/g, "")}
                        </p>
                      );
                    })}
                </>
              ) : null}
              {showStats &&
                (stats?.length > 0 ? (
                  <Stats isPrintPage values={stats} />
                ) : (
                  <Stats
                    isPrintPage
                    values={[
                      {
                        name: "",
                        M: "",
                        WS: "",
                        BS: "",
                        S: "",
                        T: "",
                        W: "",
                        I: "",
                        A: "",
                        LD: "",
                      },
                    ]}
                  />
                ))}
              {showCustomNotes && unit.customNote && (
                <p className="print__custom-note">
                  <i>
                    <b>
                      <FormattedMessage id="unit.customNote" />:
                    </b>{" "}
                    {unit.customNote}
                  </i>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  };
  

  return (
    <>
      <div className="hide-for-printing">
        <Header
          to={`?editor.${listId}`}
          headline={intl.formatMessage({
            id: "print.title",
          })}
          filters={filters}
        />

        <Button
          onClick={handlePrintClick}
          centered
          icon="print"
          spaceTop
          spaceBottom
          size="large"
          disabled={isPrinting}
          className="print__button"
        >
          {isPrinting ? (
            <FormattedMessage id="print.printing" />
          ) : (
            <FormattedMessage id="misc.print" />
          )}
        </Button>
        <div class="header-2">
          <FormattedMessage id="print.preview" />
        </div>
      </div>

      <main className="print">
        <div>
          {list.name}{" "}
          {!isShowList && (
            <span className="print__points">
              [{allPoints} <FormattedMessage id="app.points" />]
            </span>
          )}
        </div>
        <p className="print__subheader">
          {game.name}, {armyName}
          {armyCompositionName ? `, ${armyCompositionName}` : ""},{" "}
          <FormattedMessage id={`misc.${list.compositionRule || "open-war"}`} />
        </p>
        <div className="print__columns">
          <div className="print__left">

            {list.characters.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.characters" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{charactersPoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "characters" })}
              </section>
            )}

            {list.core.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.core" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{corePoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "core" })}
              </section>
            )}

            {list.special.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.special" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{specialPoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "special" })}
              </section>
            )}

            {list.rare.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.rare" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{rarePoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "rare" })}
              </section>
            )}

            {list.allies.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.allies" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{alliesPoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "allies" })}
              </section>
            )}

            {list.mercenaries.length > 0 && (
              <section>
                <div class="header-2">
                  <FormattedMessage id="editor.mercenaries" />{" "}
                  {!isShowList && (
                    <span className="print__points">
                      [{mercenariesPoints} <FormattedMessage id="app.points" />]
                    </span>
                  )}
                </div>
                {getSection({ type: "mercenaries" })}
              </section>
            )}
          </div>

          <aside className="print__right">
            {armySpecialRules && armySpecialRules.length > 0 && (
              <section>
                <div className="header-2">{`${armyCompositionName || armyComposition}特殊规则`}</div>
                <ul>
                  {armySpecialRules.map((r, i) => (
                    <li key={`army-special-${i}`}>
                      <b>{r.name_cn}:</b>
                      <div dangerouslySetInnerHTML={{ __html: r.content_cn }} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="header-2">
                <FormattedMessage id="print.specialRules" />
              </div>
              {loadingAggregatedRules ? (
                <div>Loading...</div>
              ) : (
                <ul>
                  {aggregatedRules.map((r) => (
                    <li key={r.key}>
                      <b>{r.name}:</b>
                      <div dangerouslySetInnerHTML={{ __html: r.content || "" }} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
          <div className="print-footer"></div>
        </div>
      </main>
    </>
  );
};
