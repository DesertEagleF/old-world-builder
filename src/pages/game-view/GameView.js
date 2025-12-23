import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { queryParts } from '../../utils/query';
import { useDispatch, useSelector } from "react-redux";
import { FormattedMessage, useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";

import { Header, Main } from "../../components/page";
import { Stats } from "../../components/stats";
import { Button } from "../../components/button";
import { NumberInput } from "../../components/number-input";
import {
  RulesIndex,
  RulesLinksText,
  RulesWithIcon,
  RuleWithIcon,
} from "../../components/rules-index";
import { GeneratedSpells } from "../../components/generated-spells/GeneratedSpells";
import {
  getAllOptions,
  getUnitGeneratedSpellCount,
  getUnitLoresWithSpells,
} from "../../utils/unit";
import { getUnitPoints, getPoints, getAllPoints } from "../../utils/points";
import { useLanguage } from "../../utils/useLanguage";
import { getStats, getUnitName } from "../../utils/unit";
import { editUnit } from "../../state/lists";
import { updateSetting } from "../../state/settings";
import { getGameSystems } from "../../utils/game-systems";
import { getJson } from "../../utils/resourceLoader";

import "./GameView.css";

export const GameView = () => {
  const params = useParams() || {};
  let { listId } = params;
  const location = useLocation();
  if (!listId) {
    try {
      const parts = queryParts(location.search);
      if (parts[0] === 'game-view' || parts[0] === 'editor') listId = parts[1];
    } catch (e) {}
  }
  const { language } = useLanguage();
  const intl = useIntl();
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings);
  const {
    showPoints,
    showSpecialRules,
    showStats,
    showPageNumbers,
    showVictoryPoints,
    showCustomNotes,
    showGeneratedSpells,
  } = settings;
  const [banners, setBanners] = useState(0);
  const [scenarioPoints, setScenarioPoints] = useState(0);
  const [generalDead, setGeneralDead] = useState(false);
  const [BSBDead, setBSBDead] = useState(false);
  const [detachmentsDead, setDetachmentsDead] = useState({});
  const [victoryPoints, setVictoryPoints] = useState({});
  const [troopTypeSpecialRules, setTroopTypeSpecialRules] = useState(null);
  const [unitTroopTypeMap, setUnitTroopTypeMap] = useState({});

  const list = useSelector((state) =>
    state.lists.find(({ id }) => listId === id || (listId && id && id.includes(listId)))
  );

  useEffect(() => {
    const loadData = async () => {
      if (list.game === "the-old-world") {
        try {
          const [troopTypeData, unitTroopTypeData] = await Promise.all([
            getJson("troop-type-special-rules"),
            getJson("unit-troop-type")
          ]);
          setTroopTypeSpecialRules(troopTypeData);
          setUnitTroopTypeMap(unitTroopTypeData || {});
        } catch (error) {
          console.error("Failed to load data:", error);
        }
      }
    };

    loadData();
  }, [list.game]);

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
      const foundType = types.find(t => t.id === mappedTypeId);
      if (foundType && foundType["special-rules"]) {
        return foundType["special-rules"];
      }
    }

    return [];
  };

  const getUnitTroopTypes = (unitName) => {
    const unitId = unitName.toLowerCase().replace(/\s+/g, "-");
    return unitTroopTypeMap[unitId] || [];
  };

  const convertRulesArrayToTextObject = (rulesArray) => {
    if (!Array.isArray(rulesArray) || rulesArray.length === 0) {
      return null;
    }

    const nameEn = rulesArray.map(rule => rule.name).join(", ");
    const nameCn = rulesArray.map(rule => rule.name_cn || rule.name).join(", ");

    return {
      name_en: nameEn,
      name_cn: nameCn
    };
  };

  const handleCustomNoteChange = ({ value, type, unitId }) => {
    dispatch(
      editUnit({
        listId,
        type,
        unitId,
        customNote: value,
      })
    );
  };
  const updateLocalSettings = (newSettings) => {
    localStorage.setItem("owb.settings", JSON.stringify(newSettings));
  };

  if (!list) {
    return (
      <>
        <Header
          to={`?editor.${listId}`}
          headline={intl.formatMessage({
            id: "duplicate.title",
          })}
        />
        <Main />
      </>
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
  const getUnitVictoryPoints = (unitId) => {
    let allPoints = 0;
    let detachmentsSum = 0;
    const unitVictoryPoints = victoryPoints[unitId];

    if (unitVictoryPoints && unitVictoryPoints["detachments"]) {
      const detachments = Object.values(unitVictoryPoints["detachments"]);

      if (detachments.length) {
        for (let i = 0; i < detachments.length; i++) {
          detachmentsSum += detachments[i];
        }
      }
    }
    allPoints += unitVictoryPoints ? unitVictoryPoints["25"] : 0;
    allPoints += unitVictoryPoints ? unitVictoryPoints["dead"] : 0;
    allPoints += unitVictoryPoints ? unitVictoryPoints["fleeing"] : 0;
    allPoints += detachmentsSum;

    return allPoints;
  };
  const getAllVictoryPoints = () => {
    let allVictoryPoints =
      banners * 50 +
      scenarioPoints +
      (generalDead ? 100 : 0) +
      (BSBDead ? 50 : 0);

    Object.keys(victoryPoints).forEach((unitId) => {
      allVictoryPoints += getUnitVictoryPoints(unitId);
    });

    return allVictoryPoints;
  };
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
  const filters = [
    {
      name: intl.formatMessage({
        id: "export.specialRules",
      }),
      id: "specialRules",
      checked: showSpecialRules,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showSpecialRules: !showSpecialRules,
        });
        dispatch(
          updateSetting({ key: "showSpecialRules", value: !showSpecialRules })
        );
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showStats",
      }),
      id: "stats",
      checked: showStats,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showStats: !showStats,
        });
        dispatch(updateSetting({ key: "showStats", value: !showStats }));
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showPoints",
      }),
      id: "points",
      checked: showPoints,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showPoints: !showPoints,
        });
        dispatch(updateSetting({ key: "showPoints", value: !showPoints }));
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showPageNumbers",
      }),
      id: "pages",
      checked: showPageNumbers,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showPageNumbers: !showPageNumbers,
        });
        dispatch(
          updateSetting({ key: "showPageNumbers", value: !showPageNumbers })
        );
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showCustomNotes",
      }),
      id: "customNotes",
      checked: showCustomNotes,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showCustomNotes: !showCustomNotes,
        });
        dispatch(
          updateSetting({ key: "showCustomNotes", value: !showCustomNotes })
        );
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showGeneratedSpells",
      }),
      id: "generatedSpells",
      checked: showGeneratedSpells,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showGeneratedSpells: !showGeneratedSpells,
        });
        dispatch(
          updateSetting({
            key: "showGeneratedSpells",
            value: !showGeneratedSpells,
          })
        );
      },
    },
    {
      name: intl.formatMessage({
        id: "export.showVictoryPoints",
      }),
      id: "victory",
      checked: showVictoryPoints,
      callback: () => {
        updateLocalSettings({
          ...settings,
          showVictoryPoints: !showVictoryPoints,
        });
        dispatch(
          updateSetting({ key: "showVictoryPoints", value: !showVictoryPoints })
        );
      },
    },
  ];
  const getSection = ({ type }) => {
    const units = list[type];

    return (
      <ul>
        {units.map((unit, index) => {
          const stats = getStats(unit, armyComposition);
          const unitGeneratedSpellCount = getUnitGeneratedSpellCount(unit);

          const unitTroopTypes = getUnitTroopTypes(unit.name_en);

          let allTroopTypeSpecialRules = [];
          for (const troopType of unitTroopTypes) {
            const rules = getTroopTypeSpecialRules(troopType);
            if (Array.isArray(rules) && rules.length > 0) {
              allTroopTypeSpecialRules = [...allTroopTypeSpecialRules, ...rules];
            }
          }

          return (
            <li key={index} className="list">
              <div className="list__inner game-view__list-inner">
                <h3>
                  {unit.strength || unit.minimum ? (
                    <span className="game-view__strength">
                      {`${unit.strength || unit.minimum} `}
                    </span>
                  ) : null}
                  <span className="game-view__name">
                    <span>{getUnitName({ unit, language })}</span>
                    <RuleWithIcon
                      name={unit.name_en}
                      isDark
                      className="game-view__rule-icon"
                    />
                    {showPoints && (
                      <span className="game-view__points">
                        [
                        {getUnitPoints(unit, {
                          armyComposition,
                        })}{" "}
                        <FormattedMessage id="app.points" />]
                      </span>
                    )}
                  </span>
                </h3>
                <div className="game-view__details">
                  <RulesWithIcon
                    textObject={{
                      name_en: getAllOptions(unit, {
                        language: "en",
                        removeFactionName: false,
                        armyComposition,
                      }),
                      [`name_${language}`]: getAllOptions(unit, {
                        removeFactionName: false,
                        armyComposition,
                      }),
                    }}
                  />
                  {showSpecialRules && (unit.specialRules || allTroopTypeSpecialRules.length > 0) ? (
                    <p className="game-view__special-rules">
                      <b>
                        <i>
                          <FormattedMessage id="unit.specialRules" />:
                        </i>
                      </b>{" "}
                      {unit.specialRules && (
                        <>
                          <RulesLinksText
                            textObject={unit.specialRules}
                            showPageNumbers={showPageNumbers}
                          />
                        </>
                      )}
                      {unit.specialRules && allTroopTypeSpecialRules.length > 0 && " "}
                      {allTroopTypeSpecialRules.length > 0 && (
                        <>
                          <RulesLinksText
                            textObject={convertRulesArrayToTextObject(allTroopTypeSpecialRules)}
                            showPageNumbers={showPageNumbers}
                          />
                        </>
                      )}
                    </p>
                  ) : null}
                  {unit.detachments &&
                    unit.detachments.map((detachment) => {
                      const specialRulesDetachment =
                        detachment.armyComposition?.[
                          list?.armyComposition || list?.army
                        ]?.specialRules || detachment.specialRules;

                      if (!specialRulesDetachment) {
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
                          <RulesLinksText
                            textObject={specialRulesDetachment}
                            showPageNumbers={showPageNumbers}
                          />
                        </p>
                      );
                    })}
                  {showStats &&
                    (stats?.length > 0 ? (
                      <Stats values={stats} className="game-view__stats" />
                    ) : (
                      <Stats
                        className="game-view__stats"
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
                  {showGeneratedSpells && unitGeneratedSpellCount > 0 && (
                    <GeneratedSpells
                      availableLoresWithSpells={getUnitLoresWithSpells(
                        unit,
                        armyComposition
                      )}
                      maxGeneratedSpellCount={unitGeneratedSpellCount}
                      showPageNumbers={showPageNumbers}
                      maxSignatureSpells={unit.maxSignatureSpells}
                    />
                  )}
                  {showCustomNotes && (
                    <div>
                      <label
                        className="game-view__custom-note-label"
                        htmlFor="customNote"
                      >
                        <i>
                          <FormattedMessage id="unit.customNote" />
                        </i>
                      </label>
                      <textarea
                        id="customNote"
                        className="input textarea game-view__custom-note-input"
                        rows="2"
                        value={unit.customNote || ""}
                        onChange={(event) =>
                          handleCustomNoteChange({
                            value: event.target.value,
                            type: type,
                            unitId: unit.id,
                          })
                        }
                        autoComplete="off"
                        maxLength="200"
                      />
                    </div>
                  )}
                  {showVictoryPoints && (
                    <div>
                      {getVictoryButtons(unit, type)}
                      <p className="game-view__special-rules">
                        <b>
                          <i>
                            <FormattedMessage id="misc.victoryPoints" />
                            {": "}
                          </i>
                        </b>
                        {getUnitVictoryPoints(unit.id)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };
  const updateVictoryPoints = ({ unit, value, deadDetachments }) => {
    let unitPoints = victoryPoints[unit.id] || {
      dead: 0,
      fleeing: 0,
      25: 0,
      detachments: {},
    };
    const isGeneral = Boolean(
      unit?.command?.length &&
        unit.command.find(
          (command) => command.name_en === "General" && command.active
        )
    );
    const isBSB = Boolean(
      unit?.command?.length &&
        unit.command.find(
          (command) =>
            command.name_en === "Battle Standard Bearer" && command.active
        )
    );

    // eslint-disable-next-line default-case
    switch (value) {
      case "dead": {
        unitPoints = {
          ...unitPoints,
          dead: unitPoints.dead
            ? 0
            : getUnitPoints(unit, {
                noDetachments: true,
                armyComposition,
              }),
          fleeing: 0,
          25: 0,
        };
        if (isGeneral) {
          setGeneralDead(Boolean(unitPoints.dead));
        }
        if (isBSB) {
          setBSBDead(Boolean(unitPoints.dead));
        }
        break;
      }
      case "fleeing": {
        unitPoints = {
          ...unitPoints,
          dead: 0,
          fleeing: unitPoints.fleeing
            ? 0
            : Math.round(
                getUnitPoints(unit, {
                  noDetachments: true,
                  armyComposition,
                }) / 2
              ),
          25: 0,
        };
        if (isGeneral) {
          setGeneralDead(Boolean(unitPoints.fleeing));
        }
        if (isBSB) {
          setBSBDead(Boolean(unitPoints.fleeing));
        }
        break;
      }
      case "25": {
        unitPoints = {
          ...unitPoints,
          dead: 0,
          fleeing: 0,
          25: unitPoints["25"]
            ? 0
            : Math.round(
                getUnitPoints(unit, {
                  noDetachments: true,
                  armyComposition,
                }) / 2
              ),
        };
        break;
      }
      case "detachment": {
        unit.detachments.forEach((detachment) => {
          unitPoints = {
            ...unitPoints,
            detachments: {
              ...unitPoints.detachments,
              [detachment.id]:
                deadDetachments *
                getUnitPoints(
                  {
                    ...detachment,
                    strength: 1,
                  },
                  { armyComposition }
                ),
            },
          };
        });
      }
    }

    setVictoryPoints({
      ...victoryPoints,
      [unit.id]: { ...unitPoints, isGeneral, isBSB },
    });
  };

  const getVictoryButtons = (unit, type) => {
    return (
      <>
        <Button
          className="game-view__victory-button"
          type={victoryPoints[unit.id]?.dead ? "secondary" : "tertiary"}
          spaceTop
          onClick={() => updateVictoryPoints({ unit, value: "dead" })}
        >
          <FormattedMessage id="misc.dead" />
        </Button>
        <Button
          className="game-view__victory-button"
          type={victoryPoints[unit.id]?.fleeing ? "secondary" : "tertiary"}
          spaceTop
          onClick={() => updateVictoryPoints({ unit, value: "fleeing" })}
        >
          <FormattedMessage id="misc.fleeing" />
        </Button>
        <Button
          className="game-view__victory-button"
          type={victoryPoints[unit.id]?.["25"] ? "secondary" : "tertiary"}
          spaceTop
          onClick={() => updateVictoryPoints({ unit, value: "25" })}
        >
          {"<25%"}
        </Button>
        {unit.detachments &&
          unit.detachments.length &&
          unit.detachments.map((detachment) => (
            <span key={detachment.id} className="game-view__detachment">
              <label
                htmlFor={detachment.id}
                className="game-view__detachment-label"
              >
                <FormattedMessage id="misc.dead" /> {detachment.name_en}
              </label>
              <NumberInput
                id={detachment.id}
                min={0}
                max={detachment.strength}
                value={detachmentsDead[detachment.id] || 0}
                onChange={(event) => {
                  setDetachmentsDead({
                    ...detachmentsDead,
                    [detachment.id]: event.target.value,
                  });
                  updateVictoryPoints({
                    unit,
                    value: "detachment",
                    deadDetachments: event.target.value,
                  });
                }}
              />
            </span>
          ))}
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>{`Old World Builder | ${list.name}`}</title>
      </Helmet>

      <RulesIndex />

      <Header
        to={`?editor.${listId}`}
        headline={intl.formatMessage({
          id: "misc.gameView",
        })}
        subheadline={`${armyName} [${allPoints} ${intl.formatMessage({
          id: "app.points",
        })}]`}
        filters={filters}
      />

      <Main className="game-view">
        {list.characters.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.characters" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{charactersPoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "characters" })}
          </section>
        )}

        {list.core.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.core" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{corePoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "core" })}
          </section>
        )}

        {list.special.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.special" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{specialPoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "special" })}
          </section>
        )}

        {list.rare.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.rare" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{rarePoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "rare" })}
          </section>
        )}

        {list.allies.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.allies" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{alliesPoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "allies" })}
          </section>
        )}

        {list.mercenaries.length > 0 && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="editor.mercenaries" />{" "}
                {showPoints && (
                  <span className="game-view__points">
                    [{mercenariesPoints} <FormattedMessage id="app.points" />]
                  </span>
                )}
              </div>
            </header>
            {getSection({ type: "mercenaries" })}
          </section>
        )}

        {showVictoryPoints && (
          <section className="game-view__section">
            <header className="editor__header">
              <div class="header-2">
                <FormattedMessage id="misc.allVictoryPoints" />
                {": "}
              </div>
              <strong>
                {getAllVictoryPoints()} <FormattedMessage id="app.points" />
              </strong>
            </header>
            <div className="game-view__victory-points">
              <label htmlFor="banners">
                <FormattedMessage id="misc.banners" />
              </label>
              <NumberInput
                id="banners"
                min={0}
                value={banners}
                onChange={(event) => {
                  setBanners(event.target.value);
                }}
              />
              <label htmlFor="scenarioPoints">
                <FormattedMessage id="misc.scenarioPoints" />
              </label>
              <NumberInput
                id="scenarioPoints"
                min={0}
                value={scenarioPoints}
                onChange={(event) => {
                  setScenarioPoints(event.target.value);
                }}
              />
              {generalDead && (
                <p>
                  <b>
                    <i>
                      <FormattedMessage id="misc.generalDead" />
                      {": "}
                    </i>
                  </b>
                  100
                </p>
              )}
              {BSBDead && (
                <p>
                  <b>
                    <i>
                      <FormattedMessage id="misc.bsbDead" />
                      {": "}
                    </i>
                  </b>
                  50
                </p>
              )}
              {Object.keys(victoryPoints).map((unitId) => {
                const unit = allUnits.find((unit) => unit.id === unitId);
                const unitVictoryPoints = getUnitVictoryPoints(unitId);

                if (unitVictoryPoints) {
                  return (
                    <p key={unitId}>
                      <b>
                        <i>
                          {getUnitName({ unit, language })}
                          {": "}
                        </i>
                      </b>
                      {unitVictoryPoints}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </section>
        )}
      </Main>
    </>
  );
};
