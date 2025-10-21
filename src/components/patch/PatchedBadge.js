import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useIntl } from 'react-intl';

import './PatchedBadge.css';

/**
 * PatchedBadge
 * A small, reusable badge to indicate that an item originates from or was
 * modified by a patch. This component is UI-only and does not interact with
 * patch loading/merging logic.
 *
 * Props:
 * - type: 'modified' | 'added' | 'removed' | 'patched' (controls color/style)
 * - text: optional override text to display instead of the default localized label
 * - title: optional tooltip/title attribute
 * - className: optional extra class
 *
 * Usage:
 * import { PatchedBadge } from '../components/patch/PatchedBadge';
 * // inside render: <PatchedBadge type="modified" />
 */
export const PatchedBadge = ({ type = 'patched', text, title, className }) => {
  const intl = useIntl();
  const label = text || intl.formatMessage({ id: 'patch.badge', defaultMessage: 'From patch' });

  return (
    <span
      className={classNames('patched-badge', `patched-badge--${type}`, className)}
      title={title || label}
      aria-label={label}
    >
      <span className="patched-badge__dot" aria-hidden="true" />
      <span className="patched-badge__text">{label}</span>
    </span>
  );
};

PatchedBadge.propTypes = {
  type: PropTypes.oneOf(['modified', 'added', 'removed', 'patched']),
  text: PropTypes.string,
  title: PropTypes.string,
  className: PropTypes.string,
};

export default PatchedBadge;
