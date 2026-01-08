import { useDispatch } from "react-redux";
import { useIntl } from "react-intl";
import PropTypes from "prop-types";
import classNames from "classnames";

import { Button } from "../button";
import { normalizeRuleName } from "../../utils/string";
import { openRulesIndex } from "../../state/rules-index";
import { useRules } from "./rules-map";
import patchState from "../../utils/patchState";
import "./RuleWithIcon.css";

export const RuleWithIcon = ({ name, isDark, className }) => {
  const dispatch = useDispatch();
  const intl = useIntl();
  const { rulesMap, synonyms } = useRules();

  if (!name) {
    return null;
  }

  const normalizedName = normalizeRuleName(name);
  const synonym = synonyms[normalizedName];

  // Check if the rule exists in the current rules map
  const ruleExists = rulesMap[normalizedName] || rulesMap[synonym];

  // If no rule found but we have applied patches, show button anyway
  // This handles cases where rules are loaded but naming doesn't match exactly
  // or where the rule exists in patch data but hasn't been loaded into rulesMap yet
  if (!ruleExists) {
    const appliedPatches = patchState.getApplied();

    if (appliedPatches && Array.isArray(appliedPatches) && appliedPatches.length > 0) {
      // Show button for any unit when patches are applied and no rule is found
      // This ensures patch units have functional "view details" buttons
      return (
        <Button
          type="text"
          className={classNames("rule-icon", className && className)}
          color={isDark ? "dark" : "light"}
          label={intl.formatMessage({ id: "misc.showRules" })}
          icon="preview"
          onClick={() => dispatch(openRulesIndex({ activeRule: name }))}
        />
      );
    }
  }

  return ruleExists ? (
    <Button
      type="text"
      className={classNames("rule-icon", className && className)}
      color={isDark ? "dark" : "light"}
      label={intl.formatMessage({ id: "misc.showRules" })}
      icon="preview"
      onClick={() => dispatch(openRulesIndex({ activeRule: name }))}
    />
  ) : null;
};

RuleWithIcon.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string,
  isDark: PropTypes.bool,
};
