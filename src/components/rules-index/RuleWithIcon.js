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
  const appliedPatches = patchState.getApplied();

  if (!name) {
    return null;
  }

  const normalizedName = normalizeRuleName(name);
  const synonym = synonyms[normalizedName];

  // Check if the rule exists in the current rules map
  const ruleExists = rulesMap[normalizedName] || rulesMap[synonym];
  const hasPatchesApplied = appliedPatches && Array.isArray(appliedPatches) && appliedPatches.length > 0;

  // Show button if rule exists OR if patches are applied (for patch items)
  const shouldShowButton = ruleExists || hasPatchesApplied;

  if (shouldShowButton) {
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

  return null;
};

RuleWithIcon.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string,
  isDark: PropTypes.bool,
};
