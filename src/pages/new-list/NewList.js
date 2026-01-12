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
import { RulesIndex, RuleWithIcon } from "../../components/rules-index";

import { nameMap } from "../magic";
import { mergeGameSystemsWithPatches } from "../../utils/patch";
import PatchSelector from '../../components/patch-selector/PatchSelector';
import { CustomSelect } from '../../components/select';
import { useHistory } from 'react-router-dom';
import patchState from '../../utils/patchState';
import { applySelectedRulePatches, revertToBaseRules } from '../../utils/rules';

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
  // Track merged armies to detect changes
  const [currentArmies, setCurrentArmies] = useState([]);
  const history = useHistory();

  // On mount, if there are authoritative applied patches in patchState, apply them so rules reflect current selection
  useEffect(() => {
    (async () => {
      try {
        const applied = patchState.getApplied() || [];
        if (applied && applied.length > 0) {
          const ids = applied.map(p => p.id);
          await applySelectedRulePatches(ids);
          // also seed our local appliedPatchObjects so the UI reflects current applied set
          setAppliedPatchObjects(applied.slice());
          // Also read locale from patchState as fallback
          const patchStateLocale = patchState.getLocaleMap() || {};
          if (Object.keys(patchStateLocale).length > 0) {
            setLocalizedNameMap(prev => ({ ...(prev || {}), ...patchStateLocale }));
          }
        } else {
          // ensure base rules when no applied patches
          revertToBaseRules();
        }
      } catch (e) {
        // swallow errors to avoid blocking NewList load
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When appliedPatchObjects changes, also try to load locale from patchState and apply rules
  useEffect(() => {
    console.log('NewList: appliedPatchObjects changed:', appliedPatchObjects);
    console.log('NewList: patching - current armyComposition before patch application:', armyComposition);
    const patchStateLocale = patchState.getLocaleMap() || {};
    if (Object.keys(patchStateLocale).length > 0) {
      setLocalizedNameMap(prev => ({ ...(prev || {}), ...patchStateLocale }));
    }
    // Also apply rules from the selected patches
    const ids = appliedPatchObjects.map(p => p.id);
    if (ids.length > 0) {
      console.log('NewList: applying patches:', ids);
      applySelectedRulePatches(ids);
    } else {
      // If no patches selected, revert to base rules
      console.log('NewList: reverting to base rules');
      revertToBaseRules();
    }
  }, [appliedPatchObjects]);

  // Use centralized merge helper to combine gameSystems with applied patch objects
  const mergedArmiesResult = mergeGameSystemsWithPatches(gameSystems, appliedPatchObjects, game);
  const armies = mergedArmiesResult.armies.sort((a, b) => a.id.localeCompare(b.id));
  const compositionSourcesMap = mergedArmiesResult.compositionSourcesMap;

  // Update currentArmies state when armies change
  useEffect(() => {
    console.log('NewList: armies changed:', armies.map(a => a.id));
    console.log('NewList: armies change - current armyComposition state:', armyComposition);
    setCurrentArmies(armies);
  }, [armies]);

  const baseArmy = armies.find(({ id }) => army === id);
  // Ensure journalArmies is always an array
  let journalArmies = Array.isArray(baseArmy?.armyComposition) ? baseArmy.armyComposition : [];
  let compositionSources = compositionSourcesMap[baseArmy?.id] || {};

  // Debug: Log current state of armyComposition
  console.log('NewList: render - current armyComposition:', armyComposition, 'baseArmy:', baseArmy?.id, 'journalArmies:', journalArmies);

  // Update army and armyComposition when patches change and current selections are no longer valid
  useEffect(() => {
    console.log('NewList: checking army validity - current army:', army, 'available armies:', currentArmies.map(a => a.id));
    // Check if current army is still valid
    if (army && currentArmies.length > 0) {
      const currentArmyExists = currentArmies.some(a => a.id === army);
      if (!currentArmyExists) {
        console.log('NewList: current army not found, resetting to first available army');
        // Army no longer exists due to patches, reset to first available army
        setArmy(currentArmies[0].id);
        setArmyComposition(currentArmies[0].armyComposition?.[0] || currentArmies[0].id);
      }
    }
  }, [currentArmies, army]);

  // Update armyComposition when baseArmy changes
  useEffect(() => {
    console.log('NewList: baseArmy changed:', baseArmy?.id);
    console.log('NewList: baseArmy armyComposition:', baseArmy?.armyComposition);
    console.log('NewList: current armyComposition value:', armyComposition);
    console.log('NewList: current armies count:', armies.length);
    if (baseArmy && Array.isArray(baseArmy.armyComposition) && baseArmy.armyComposition.length > 0) {
      // Check if current armyComposition is still valid
      const currentCompositionValid = baseArmy.armyComposition.includes(armyComposition);
      console.log('NewList: current armyComposition validity:', currentCompositionValid);
      if (!currentCompositionValid) {
        console.log('NewList: resetting armyComposition to first available:', baseArmy.armyComposition[0]);
        // Reset to first available composition
        setArmyComposition(baseArmy.armyComposition[0]);
      }
    } else {
      console.log('NewList: baseArmy has no valid armyComposition or is not an array');
    }
  }, [baseArmy]);

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
    {
      id: "battle-march",
      name_en: intl.formatMessage({ id: "misc.battle-march" }),
    },
  ];
  const listsPoints = [...lists.map((list) => list.points)].reverse();
  // 去除listsPoints中小于等于0的值
  const filteredListsPoints = listsPoints.filter(point => point > 0);
  const quickActions =
    compositionRule === "battle-march"
      ? [500, 600, 750]
      : lists.length
      ? [...new Set([...filteredListsPoints, 500, 1000, 1500, 2000, 2500])].slice(0, 5)
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

    // Redirect to the correct path with /wiki/Editor prefix
    // This ensures the URL is correct and matches the expected pattern
    // Expected: https://tow.huijiwiki.com/wiki/Editor?editor.${newId}
    // Instead of: https://tow.huijiwiki.com/?editor.${newId}
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
    const selectedArmy = armies.find(({ id }) => value === id);
    // Ensure armyComposition is an array before accessing first element
    const composition = Array.isArray(selectedArmy?.armyComposition) && selectedArmy.armyComposition.length > 0
      ? selectedArmy.armyComposition[0]
      : value;
    setArmyComposition(composition);
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
      {redirect && <Redirect to={`/wiki/Editor?editor.${redirect}`} />}

      {isMobile && (
        <Header to="/wiki/Editor?" headline={intl.formatMessage({ id: "new.title" })} />
      )}

      <MainComponent>
        {!isMobile && (
          <Header
            isSection
            to="/wiki/Editor?"
            headline={intl.formatMessage({ id: "new.title" })}
          />
        )}
        <form onSubmit={handleSubmit} className="new-list">
          <label style={{ marginBottom: 6, display: 'block' }} htmlFor="patch-selector">
            <FormattedMessage id="patches.selectedLabel" defaultMessage="Selected patches:" />
          </label>
          <PatchSelector id="patch-selector" onAppliedChange={setAppliedPatchObjects} onLocaleMapChange={(newLocale) => setLocalizedNameMap(prev => ({ ...(prev || {}), ...(newLocale || {}) }))} onShowPanel={() => history.push('?new.patches')} />
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
          <CustomSelect
            id="army"
            options={armies.map((a) => ({
              id: a.id,
              name_en: a[`name_${language}`] || a.name_en || a.name,
              source: a.source,
            }))}
            onChange={handleArmyChange}
            selected={army}
            spaceBottom
            required
          />
          {journalArmies ? (
            <>
              <label htmlFor="arcane-journal">
                <FormattedMessage id="new.armyComposition" />
              </label>
              <CustomSelect
                id="arcane-journal"
                options={[
                  ...journalArmies.map((journalArmy) => {
                    const displayName = journalArmy === army
                      ? intl.formatMessage({ id: "new.grandArmy" })
                      : (localizedNameMap[journalArmy]?.[`name_${language}`] || nameMap[journalArmy]?.[`name_${language}`]);
                    // Determine if this armyComposition is from a patch
                    const source = compositionSourcesMap[army]?.[journalArmy];
                    return {
                      id: journalArmy,
                      name_en: displayName,
                      source: source || 'base',
                    };
                  }),
                ]}
                appliedPatchObjects={appliedPatchObjects}
                onChange={handleArcaneJournalChange}
                selected={armyComposition}
                spaceBottom
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
          <p className="new-list__composition-description">
            <i>
              <FormattedMessage
                id={`new.armyCompositionRuleDescription.${compositionRule}`}
              />
            </i>
            <RuleWithIcon
              name={compositionRule}
              isDark
              className="game-view__rule-icon"
            />
          </p>
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
