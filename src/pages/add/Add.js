import { useState, useEffect, Fragment } from "react";
import { useParams, useLocation, Redirect } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FormattedMessage, useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";

import { Icon } from "../../components/icon";
import { RulesIndex, RuleWithIcon } from "../../components/rules-index";
import { Header, Main } from "../../components/page";
import { Expandable } from "../../components/expandable";
import { addUnit } from "../../state/lists";
import { setArmy } from "../../state/army";
import { getUnitName } from "../../utils/unit";
import { getRandomId } from "../../utils/id";
import { useLanguage } from "../../utils/useLanguage";
import { getArmyData, getAlliesForComposition } from "../../utils/army";
import { loadAndMergeBaseWithPatches } from "../../utils/patch";
import { getGameSystems, getCustomDatasetData } from "../../utils/game-systems";
import { rules } from "../../utils/rules";
import patchState from "../../utils/patchState";
import PatchedBadge from "../../components/patch/PatchedBadge";

import { nameMap } from "../magic";
import { queryParts } from "../../utils/query";

import "./Add.css";

let allAllies = [];
let allMercenaries = [];
// Helper function to check if a unit should be filtered out due to max=0 rule
const shouldFilterOutUnit = (unit, armyComposition, type) => {
  try {
    // Get rules from patchState (includes patched rules)
    const mergedRules = patchState.getRulesMap();

    // First try with armyComposition
    let armyRules = mergedRules[armyComposition];

    // Fallback to static rules
    if (!armyRules) {
      armyRules = rules[armyComposition];
    }

    if (!armyRules || !armyRules[type] || !armyRules[type].units) {
      return false;
    }

    const unitRules = armyRules[type].units.find(unitRule =>
      unitRule.ids && unitRule.ids.includes(unit.id)
    );

    // If unit has max=0 (explicitly set), it should be filtered out
    return unitRules && typeof unitRules.max === 'number' && unitRules.max === 0;
  } catch (e) {
    return false;
  }
};

export const Add = ({ isMobile }) => {
  const MainComponent = isMobile ? Main : Fragment;
  const params = useParams() || {};
  let { listId, type } = params;
  const dispatch = useDispatch();
  const [redirect, setRedirect] = useState(null);
  const [alliesLoaded, setAlliesLoaded] = useState(0);
  const [mercenariesLoaded, setMercenariesLoaded] = useState(0);
  const [forceReload, setForceReload] = useState(false);
  const intl = useIntl();
  const location = useLocation();
  const { language } = useLanguage();
  // fallback parse for query-style routes like ?editor.<listId>.<type>
  if (!listId || !type) {
    try {
      const parts = queryParts(location.search);
      if (parts[0] === "editor") {
        listId = listId || parts[1];
        // route is ?editor.<listId>.add.<type>
        if (parts[2] === 'add') {
          type = type || parts[3];
        } else {
          type = type || parts[2];
        }
      }
    } catch (e) {}
  }
  const list = useSelector((state) =>
    state.lists.find(({ id }) => listId === id || (listId && id && id.includes(listId)))
  );
  const gameSystems = getGameSystems();
  const army = useSelector((state) => state.army);
  const game = gameSystems.find((game) => game.id === list?.game);
  const armyData = game?.armies.find((army) => army.id === list.army);
  const allies = armyData?.allies;
  const mercenaries = armyData?.mercenaries;
  const availableAllies = game
    ? getAlliesForComposition({
      data: game?.armies.find((a) => a.id === list?.army),
      composition: list?.armyComposition || list?.army,
    })
    : [];
  // allyArmyId: the source army id (e.g. 'grand-cathay')
  // allyArmyComposition: the composition variant id (e.g. 'jade-fleet')
  const handleAdd = (
    unit,
    allyArmyId,
    unitType,
    magicItemsArmy,
    allyArmyComposition
  ) => {
    const newUnit = {
      ...unit,
      // always set the army to the source army id
      army: allyArmyId || unit.army,
      // record the chosen composition variant (if any)
      armyComposition: allyArmyComposition || unit.armyComposition || allyArmyId,
      unitType,
      id: `${unit.id}.${getRandomId()}`,
      magicItemsArmy: unit.magicItemsArmy || magicItemsArmy,
    };

    dispatch(addUnit({ listId, type, unit: newUnit }));
    setRedirect(newUnit.id);
  };
  const getUnit = (
    unit,
    allyArmyId,
    unitType,
    magicItemsArmy,
    allyArmyComposition
  ) => {
    return (
      <li key={unit.id} className="list">
        <button
          className="list__inner add__list-inner"
          onClick={() => handleAdd(unit, allyArmyId, unitType, magicItemsArmy, allyArmyComposition)}
        >
          <span className="add__name">
            {unit.minimum ? `${unit.minimum} ` : null}
            <b>{getUnitName({ unit, language })}</b>
            {unit.__patchedBy && (
              <PatchedBadge
                text={unit.__patchedBy}
                className="unit__patch-badge"
              />
            )}
          </span>
          <i className="unit__points">{`${unit.minimum ? unit.points * unit.minimum : unit.points
            } ${intl.formatMessage({
              id: "app.points",
            })}`}</i>
        </button>
        <RuleWithIcon name={unit.name_en} isDark className="add__rules-icon" />
      </li>
    );
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    allAllies = [];
    allMercenaries = [];
  }, [location.pathname]);

  useEffect(() => {
    // Listen for forceReloadAdd custom event from Editor
    const handleForceReloadAdd = (event) => {
      if (event.detail && event.detail.listId === listId) {
        console.log("[Add] Received forceReloadAdd event for list:", listId);
        setForceReload(true);
      }
    };

    // Listen for sessionStorage changes (fallback for older browsers)
    const handleStorageChange = (event) => {
      if (event.key === `force-reload-${listId}` && event.newValue) {
        console.log("[Add] Received forceReload signal from sessionStorage for list:", listId);
        setForceReload(true);
      }
    };

    if (listId) {
      window.addEventListener("forceReloadAdd", handleForceReloadAdd);
      window.addEventListener("storage", handleStorageChange);
    }

    return () => {
      if (listId) {
        window.removeEventListener("forceReloadAdd", handleForceReloadAdd);
        window.removeEventListener("storage", handleStorageChange);
      }
    };
  }, [listId]);

  useEffect(() => {

    // Load army data when needed
    if (list && type !== "allies") {
      const listHasPatches = list.patches && Array.isArray(list.patches) && list.patches.length > 0;

      const shouldReload = forceReload || !army || (listHasPatches && !army?.characters?.length);

      if (shouldReload) {
        const isCustom = game.id !== "the-old-world";

        if (isCustom) {
          const data = getCustomDatasetData(list.army);

          dispatch(
            setArmy(
              getArmyData({
                data,
                armyComposition: list.armyComposition,
              })
            )
          );
        } else {
          (async () => {
          const patchIds = list && Array.isArray(list.patches) ? list.patches.map(p => (typeof p === 'string' ? p : p.id || p.name)) : [];
          const data = await loadAndMergeBaseWithPatches(`data-${list.army}`, patchIds, list.army, list.armyComposition || list.army);
          dispatch(
            setArmy(
              getArmyData({
                data,
                armyComposition: list.armyComposition || list.army,
              })
            )
          );
          // Reset forceReload flag after reloading
          if (forceReload) {
            setForceReload(false);
          }
        })();
        }
        }
      } else if (list && type === "allies" && allAllies.length === 0 && (availableAllies && availableAllies.length > 0)) {
      setAlliesLoaded(false);
      availableAllies.forEach(({ army, armyComposition, magicItemsArmy }, index) => {
        const isCustom = game.id !== "the-old-world";
        const customData = isCustom && getCustomDatasetData(army);

        if (customData) {
          const armyData = getArmyData({
            data: customData,
            armyComposition: armyComposition || army,
          });

          allAllies = [
            ...allAllies,
            {
              ...armyData,
              ally: army,
              armyComposition: armyComposition || army,
            },
          ];
          setAlliesLoaded(index + 1);
        } else {
          (async () => {
            const patchIds = list && Array.isArray(list.patches) ? list.patches.map(p => (typeof p === 'string' ? p : p.id || p.name)) : [];
            const data = await loadAndMergeBaseWithPatches(`data-${army}`, patchIds, army, armyComposition || army);
            const armyData = getArmyData({
              data,
              armyComposition: armyComposition || army,
            });

            allAllies = [
              ...allAllies,
              {
                ...armyData,
                ally: army,
                armyComposition: armyComposition || army,
                magicItemsArmy: magicItemsArmy,
              },
            ];
            setAlliesLoaded(index + 1);
          })();
        }
      });
    } else if (
      list &&
      type === "mercenaries" &&
      allMercenaries.length === 0 &&
      mercenaries
    ) {
      setMercenariesLoaded(false);
      mercenaries[list.armyComposition] &&
        mercenaries[list.armyComposition].forEach((mercenary, index) => {
          const isCustom = game.id !== "the-old-world";
          const customData = isCustom && getCustomDatasetData(mercenary.army);

          if (customData) {
            const armyData = getArmyData({
              data: customData,
              armyComposition: mercenary.army,
            });
            const allUnits = [
              ...armyData.characters,
              ...armyData.core,
              ...armyData.special,
              ...armyData.rare,
              ...armyData.mercenaries,
            ];
            const mercenaryUnits = allUnits
              .filter((unit) => mercenary.units.includes(unit.id))
              .map((unit) => ({ ...unit, army: mercenary.army }));
            allMercenaries = [...allMercenaries, ...mercenaryUnits];
            setMercenariesLoaded(index + 1);
          } else {
            (async () => {
              const patchIds = list && Array.isArray(list.patches) ? list.patches.map(p => (typeof p === 'string' ? p : p.id || p.name)) : [];
              const data = await loadAndMergeBaseWithPatches(`data-${mercenary.army}`, patchIds, mercenary.army, mercenary.army);
              const armyData = getArmyData({
                data,
                armyComposition: mercenary.army,
              });
              const allUnits = [
                ...armyData.characters,
                ...armyData.core,
                ...armyData.special,
                ...armyData.rare,
                ...armyData.mercenaries,
              ];
              const mercenaryUnits = allUnits
                .filter((unit) => mercenary.units.includes(unit.id))
                .map((unit) => ({ ...unit, army: mercenary.army }));
              allMercenaries = [...allMercenaries, ...mercenaryUnits];
              setMercenariesLoaded(index + 1);
            })();
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, allies, type, game, forceReload]);

  if (redirect) {
    return <Redirect to={`?editor.${listId}.${type}.${redirect}`} />;
  }

  if (
    (!army && type !== "allies" && type !== "mercenaries") ||
    (type === "allies" && allAllies.length > 0 && !alliesLoaded) || // switching from custom to official
    (type === "allies" &&
      !allies &&
      alliesLoaded === 0 &&
      allAllies.length !== allies?.length) ||
    (type === "mercenaries" &&
      !mercenaries &&
      mercenariesLoaded === 0 &&
      allMercenaries.length !== mercenaries?.length)
  ) {
    if (isMobile) {
      return (
        <>
          <Header to={`?editor.${listId}`} />
          <Main loading />
        </>
      );
    } else {
      return (
        <>
          <Header to={`?editor.${listId}`} isSection />
          <Main loading />
        </>
      );
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Old World Builder | ${list?.name}`}</title>
      </Helmet>

      {isMobile && (
        <Header
          to={`?editor.${listId}`}
          headline={intl.formatMessage({
            id: "add.title",
          })}
        />
      )}

      <RulesIndex />

      <MainComponent>
        {!isMobile && (
          <Header
            isSection
            to={`?editor.${listId}`}
            headline={intl.formatMessage({
              id: "add.title",
            })}
          />
        )}
        {type === "allies" && (
          <>
            <p className="unit__notes">
              <Icon symbol="error" className="unit__notes-icon" />
              <FormattedMessage id="add.alliesInfo" />
            </p>
            <ul>
              {allAllies.map(
                (
                  {
                    characters,
                    core,
                    special,
                    rare,
                    ally,
                    armyComposition,
                    magicItemsArmy,
                  },
                  index
                ) => {
                  // Remove duplicate units and filter out max=0 units
                  const uniqueUnits = [];
                  const tempCharacters = characters.filter((unit) => {
                    // Filter out max=0 units (always use armyComposition, not ally)
                    if (shouldFilterOutUnit(unit, armyComposition, 'characters')) {
                      return false;
                    }
                    if (
                      !uniqueUnits.some((name_en) => name_en === unit.name_en)
                    ) {
                      uniqueUnits.push(unit.name_en);
                      return true;
                    }
                    return false;
                  });
                  const tempCore = core.filter((unit) => {
                    // Filter out max=0 units (always use armyComposition, not ally)
                    if (shouldFilterOutUnit(unit, armyComposition, 'core')) {
                      return false;
                    }
                    if (
                      !uniqueUnits.some((name_en) => name_en === unit.name_en)
                    ) {
                      uniqueUnits.push(unit.name_en);
                      return true;
                    }
                    return false;
                  });
                  const tempSpecial = special.filter((unit) => {
                    // Filter out max=0 units (always use armyComposition, not ally)
                    if (shouldFilterOutUnit(unit, armyComposition, 'special')) {
                      return false;
                    }
                    if (
                      !uniqueUnits.some((name_en) => name_en === unit.name_en)
                    ) {
                      uniqueUnits.push(unit.name_en);
                      return true;
                    }
                    return false;
                  });
                  const tempRare = rare.filter((unit) => {
                    // Filter out max=0 units (always use armyComposition, not ally)
                    if (shouldFilterOutUnit(unit, armyComposition, 'rare')) {
                      return false;
                    }
                    if (
                      !uniqueUnits.some((name_en) => name_en === unit.name_en)
                    ) {
                      uniqueUnits.push(unit.name_en);
                      return true;
                    }
                    return false;
                  });

                  return (
                    <Expandable
                      key={index}
                      headline={`${game?.armies.find((army) => army.id === ally)[
                        `name_${language}`
                      ] ||
                        game?.armies.find((army) => army.id === ally).name_en
                        } ${armyComposition !== ally
                          ? ` (${nameMap[armyComposition][`name_${language}`] ||
                          nameMap[armyComposition].name_en
                          })`
                          : ""
                        }`}
                    >
                      {tempCharacters.map((unit) =>
                        getUnit(
                          unit,
                          ally,
                          "characters",
                          magicItemsArmy,
                          armyComposition
                        )
                      )}
                      {tempCore
                        .filter((unit) => !unit.detachment)
                        .map((unit) =>
                          getUnit(unit, ally, "core", magicItemsArmy, armyComposition)
                        )}
                      {tempSpecial
                        .filter((unit) => !unit.detachment)
                        .map((unit) =>
                          getUnit(
                            unit,
                            ally,
                            "special",
                            magicItemsArmy,
                            armyComposition
                          )
                        )}
                      {tempRare
                        .filter((unit) => !unit.detachment)
                        .map((unit) =>
                          getUnit(unit, ally, "rare", magicItemsArmy, armyComposition)
                        )}
                    </Expandable>
                  );
                }
              )}
            </ul>
          </>
        )}
        {type === "mercenaries" && (
          <ul>
            {allMercenaries
              .filter((unit) => {
                const shouldFilter = shouldFilterOutUnit(unit, list?.armyComposition, type);
                if (shouldFilter) {
                  return false;
                }
                return true;
              })
              .map((unit) => getUnit(unit, unit.army))
            }
          </ul>
        )}
        {type !== "allies" && type !== "mercenaries" && (
          <ul>
            {army[type]
              .filter((unit) => {
                // Also apply max=0 filtering for non-ally units
                if (unit.detachment) return false;
                const shouldFilter = shouldFilterOutUnit(unit, list?.armyComposition, type);
                if (shouldFilter) {
                  return false;
                }
                return true;
              })
              .map((unit) => getUnit(unit))
            }
          </ul>
        )}
      </MainComponent>
    </>
  );
};