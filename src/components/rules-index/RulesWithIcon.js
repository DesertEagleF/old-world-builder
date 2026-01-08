import { Fragment } from "react";
import { useDispatch } from "react-redux";
import { useIntl } from "react-intl";

import { Button } from "../button";
import { normalizeRuleName } from "../../utils/string";
import { useLanguage } from "../../utils/useLanguage";
import { openRulesIndex } from "../../state/rules-index";
import { useRules } from "./rules-map";
import patchState from "../../utils/patchState";

export const RulesWithIcon = ({ textObject }) => {
  const dispatch = useDispatch();
  const { language } = useLanguage();
  const intl = useIntl();
  const { rulesMap, synonyms } = useRules();

  if (!textObject.name_en) {
    return [];
  }

  const textEn = textObject.name_en.split(/, | \+ |\[/);
  const ruleString = textObject[`name_${language}`] || textObject.name_en;
  const ruleButtons = ruleString.split(/, | \+ |\[/);

  // Check if patches are applied
  const appliedPatches = patchState.getApplied();
  const hasPatchesApplied = appliedPatches && Array.isArray(appliedPatches) && appliedPatches.length > 0;

  return ruleButtons.map((rule, index) => {
    const normalizedName = normalizeRuleName(textEn[index]);
    const ruleExists = rulesMap[normalizedName] || rulesMap[synonyms[normalizedName]];

    // Show button if rule exists in rulesMap OR if patches are applied (for patch units)
    const shouldShowButton = ruleExists || hasPatchesApplied;

    return (
      <Fragment key={`${rule}-${index}`}>
        {shouldShowButton ? (
          <span className="unit__rule-wrapper">
            {rule
              .replace(/\[/g, "")
              .replace(/\]/g, "")
              .replace(/ *\{[^)]*\}/g, "")}
            <Button
              type="text"
              className="unit__rules"
              color="dark"
              label={intl.formatMessage({ id: "misc.showRules" })}
              icon="preview"
              onClick={() =>
                dispatch(openRulesIndex({ activeRule: textEn[index] }))
              }
            />
            {index !== ruleButtons.length - 1 && ", "}
          </span>
        ) : (
          <>
            {rule
              .replace(/\[/g, "")
              .replace(/\]/g, "")
              .replace(/ *\{[^)]*\}/g, "")}
            {index !== ruleButtons.length - 1 && ", "}
          </>
        )}
      </Fragment>
    );
  });
};
