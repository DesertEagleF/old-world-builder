import { useState, useEffect, Fragment } from "react";
import { useLocation, Redirect } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { FormattedMessage, useIntl } from "react-intl";
import classNames from "classnames";

import { Button } from "../../components/button";
import { Header, Main } from "../../components/page";
import { Select } from "../../components/select";
import { NumberInput } from "../../components/number-input";
import { getGameSystems } from "../../utils/game-systems";
import { getRandomId } from "../../utils/id";
import { useLanguage } from "../../utils/useLanguage";
import { setLists } from "../../state/lists";

import { nameMap } from "../magic";
import { mergePatch } from "../../utils/patch";
import PatchSelector from '../../components/patch-selector/PatchSelector';
import { useHistory } from 'react-router-dom';

import "./NewList.css";

export const NewList = ({ isMobile }) => {
  const MainComponent = isMobile ? Main : Fragment;
  const location = useLocation();
  const dispatch = useDispatch();
  const intl = useIntl();
  const { language } = useLanguage();
  const gameSystems = getGameSystems();
  const lists = useSelector((state) => state.lists);
  const [game, setGame] = useState("the-old-world");
  const [army, setArmy] = useState("empire-of-man");
  const [compositionRule, setCompositionRule] = useState("open-war");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(2000);
  const [armyComposition, setArmyComposition] = useState("empire-of-man");
  const [redirect, setRedirect] = useState(null);
  // applied patch objects (each: { id, type, data, locale, displayName }) provided by PatchSelector
  const [appliedPatchObjects, setAppliedPatchObjects] = useState([]);
  // Localized name map, merged from base and patch locales (PatchSelector will update this)
  const [localizedNameMap, setLocalizedNameMap] = useState(nameMap);
  const history = useHistory();

  // PatchSelector handles patch loading, locales and selection. NewList receives applied patch objects

  // Merge all patches/full into the entire gameSystems, then select the army and mark composition sources
  function getMergedGameSystemsWithSources(gameSystems, patchList, gameId) {
    // Find the base system
    const baseSystem = gameSystems.find(({ id }) => id === gameId);
    if (!baseSystem) return { armies: [], compositionSourcesMap: {} };

    // Deep copy armies
    let mergedArmies = baseSystem.armies.map(a => ({ ...a }));
    let compositionSourcesMap = {};

    for (const { id: patchId, type, data } of patchList) {
      if (!data.armies) continue;
      if (type === "patch") {
        // Patch: merge each army by id
        data.armies.forEach(patchArmy => {
          const idx = mergedArmies.findIndex(a => a.id === patchArmy.id);
          if (idx !== -1) {
            // Record $append source
            if (patchArmy.armyComposition) {
              Object.entries(patchArmy.armyComposition).forEach(([op, arr]) => {
                if (op === "$append") {
                  arr.forEach(item => {
                    if (!compositionSourcesMap[patchArmy.id]) compositionSourcesMap[patchArmy.id] = {};
                    compositionSourcesMap[patchArmy.id][item] = patchId;
                  });
                }
              });
            }
            mergedArmies[idx] = mergePatch(mergedArmies[idx], patchArmy);
          }
        });
      } else if (type === "full") {
        // Full: replace all matching armies
        data.armies.forEach(fullArmy => {
          const idx = mergedArmies.findIndex(a => a.id === fullArmy.id);
          if (idx !== -1) {
            mergedArmies[idx] = { ...fullArmy };
            // All composition from this patch
            if (fullArmy.armyComposition) {
              if (!compositionSourcesMap[fullArmy.id]) compositionSourcesMap[fullArmy.id] = {};
              fullArmy.armyComposition.forEach(item => {
                compositionSourcesMap[fullArmy.id][item] = patchId;
              });
            }
          }
        });
      }
    }
    // Mark base for items not from patch/full
    mergedArmies.forEach(army => {
      if (army.armyComposition) {
        if (!compositionSourcesMap[army.id]) compositionSourcesMap[army.id] = {};
        army.armyComposition.forEach(item => {
          if (!compositionSourcesMap[army.id][item]) compositionSourcesMap[army.id][item] = "base";
        });
      }
    });
    return { armies: mergedArmies, compositionSourcesMap };
  }

  // Use merged armies and sources from applied (confirmed) patches only
  const { armies: mergedArmies, compositionSourcesMap } = getMergedGameSystemsWithSources(gameSystems, appliedPatchObjects, game);
  const armies = mergedArmies.sort((a, b) => a.id.localeCompare(b.id));
  const baseArmy = armies.find(({ id }) => army === id);
  let journalArmies = baseArmy?.armyComposition || [];
  let compositionSources = compositionSourcesMap[baseArmy?.id] || {};

  const compositionRules = [
    {
      id: "open-war",
      name_en: intl.formatMessage({ id: "misc.open-war" }),
    },
    {
      id: "grand-melee",
      name_en: intl.formatMessage({ id: "misc.grand-melee" }),
    },
    {
      id: "combined-arms",
      name_en: intl.formatMessage({ id: "misc.combined-arms" }),
    },
    {
      id: "grand-melee-combined-arms",
      name_en: intl.formatMessage({ id: "misc.grand-melee-combined-arms" }),
    },
  ];
  const listsPoints = [...lists.map((list) => list.points)].reverse();
  const quickActions = lists.length
    ? [...new Set([...listsPoints, 500, 1000, 1500, 2000, 2500])].slice(0, 5)
    : [500, 1000, 1500, 2000, 2500];
  const createList = () => {
    const newId = getRandomId();
    const newList = {
      name:
        name ||
        localizedNameMap[armyComposition]?.[`name_${language}`] ||
        localizedNameMap[armyComposition]?.name_en ||
        (localizedNameMap[army] && localizedNameMap[army][`name_${language}`]) ||
        localizedNameMap[army]?.name_en ||
        army,
      description: description,
      game: game,
      points: points,
      army: army,
      characters: [],
      core: [],
      special: [],
      rare: [],
      mercenaries: [],
      allies: [],
      id: newId,
      armyComposition,
      compositionRule,
      // persist applied (confirmed) patches (ids + lightweight meta)
      patches: (appliedPatchObjects || []).map(p => ({ id: p.id, type: p.type || 'patch', displayName: p.displayName || p.id })),
    };
    const newLists = [newList, ...lists];

    localStorage.setItem("owb.lists", JSON.stringify(newLists));
    dispatch(setLists(newLists));

    setRedirect(newId);
  };
  const handleSystemChange = (event) => {
    setGame(event.target.value);
    setArmy(
      gameSystems.filter(({ id }) => id === event.target.value)[0].armies[0].id
    );
    setCompositionRule("open-war");
  };
  const handleArmyChange = (value) => {
    setArmy(value);
    setArmyComposition(
      armies.find(({ id }) => value === id).armyComposition[0]
    );
    setCompositionRule("open-war");
  };
  const handleArcaneJournalChange = (value) => {
    setArmyComposition(value);
  };
  const handleCompositionRuleChange = (value) => {
    setCompositionRule(value);
  };
  const handlePointsChange = (event) => {
    setPoints(event.target.value);
  };
  const handleNameChange = (event) => {
    setName(event.target.value);
  };
  const handleDescriptionChange = (event) => {
    setDescription(event.target.value);
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    createList();
  };
  const handleQuickActionClick = (event) => {
    event.preventDefault();
    setPoints(Number(event.target.value));
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      {redirect && <Redirect to={`/editor/${redirect}`} />}

      {isMobile && (
        <Header to="/" headline={intl.formatMessage({ id: "new.title" })} />
      )}

      <MainComponent>
        {!isMobile && (
          <Header
            isSection
            to="/"
            headline={intl.formatMessage({ id: "new.title" })}
          />
        )}
        <form onSubmit={handleSubmit} className="new-list">
          <PatchSelector onAppliedChange={setAppliedPatchObjects} onLocaleMapChange={setLocalizedNameMap} onShowPanel={() => history.push('/new/patches')} />
          {gameSystems.map(({ name, id }, index) => (
            <div
              className={classNames(
                "radio",
                "new-list__radio",
                index === gameSystems.length - 1 && "new-list__radio--last-item"
              )}
              key={id}
            >
              <input
                type="radio"
                id={id}
                name="new-list"
                value={id}
                onChange={handleSystemChange}
                checked={id === game}
                className="radio__input"
                aria-label={name}
              />
              <label htmlFor={id} className="radio__label">
                <span className="new-list__game-name">{name}</span>
              </label>
            </div>
          ))}
          <label htmlFor="army">
            <FormattedMessage id="new.army" />
          </label>
          <Select
            id="army"
            options={armies}
            onChange={handleArmyChange}
            selected="empire-of-man"
            spaceBottom
            required
          />
          {journalArmies && journalArmies.length > 0 ? (
            <>
              <label htmlFor="arcane-journal">
                <FormattedMessage id="new.armyComposition" />
              </label>
              <Select
                id="arcane-journal"
                options={journalArmies.map((journalArmy) => ({
                  id: journalArmy,
                  name_en:
                    journalArmy === army
                      ? intl.formatMessage({ id: "new.grandArmy" })
                      : localizedNameMap[journalArmy]?.[`name_${language}`] || journalArmy,
                  source: compositionSources[journalArmy],
                  // Show patch source in label if not base
                  label:
                    (journalArmy === army
                      ? intl.formatMessage({ id: "new.grandArmy" })
                      : localizedNameMap[journalArmy]?.[`name_${language}`] || journalArmy) +
                    (compositionSources[journalArmy] && compositionSources[journalArmy] !== "base"
                      ? ` (from patch: ${compositionSources[journalArmy]})`
                      : ""),
                }))}
                onChange={handleArcaneJournalChange}
                selected={army}
                spaceBottom
                getOptionLabel={option => option.label || option.name_en}
              />
            </>
          ) : null}
          <label htmlFor="composition-rule">
            <FormattedMessage id="new.armyCompositionRule" />
          </label>
          <Select
            id="composition-rule"
            options={compositionRules}
            onChange={handleCompositionRuleChange}
            selected={compositionRule}
            spaceBottom
          />
          <label htmlFor="points">
            <FormattedMessage id="misc.points" />
          </label>
          <NumberInput
            id="points"
            min={0}
            value={points}
            onChange={handlePointsChange}
            required
            interval={50}
          />
          <p className="new-list__quick-actions">
            <i className="new-list__quick-actions-label">
              <FormattedMessage id="misc.suggestions" />
              {": "}
            </i>
            {quickActions.map((points, index) => (
              <Button
                type="tertiary"
                size="small"
                color="dark"
                className="new-list__quick-action"
                value={points}
                onClick={handleQuickActionClick}
                key={index}
              >
                {points}
              </Button>
            ))}
          </p>

          <label htmlFor="name">
            <FormattedMessage id="misc.name" />
          </label>
          <input
            type="text"
            id="name"
            className="input"
            value={name}
            onChange={handleNameChange}
            autoComplete="off"
            maxLength="100"
          />
          <label htmlFor="description">
            <FormattedMessage id="misc.description" />
          </label>
          <input
            type="text"
            id="description"
            className="input"
            value={description}
            onChange={handleDescriptionChange}
            autoComplete="off"
            maxLength="255"
          />
          <Button
            centered
            icon="add-list"
            submitButton
            spaceBottom
            size="large"
          >
            <FormattedMessage id="new.create" />
          </Button>
        </form>
      </MainComponent>
    </>
  );
};
