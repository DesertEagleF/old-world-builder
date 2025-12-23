import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import iconDefs from '../../utils/iconDefs';

import './Icon.css';

// Render icon using inline definitions from iconDefs.
// This works without external SVG files and is compatible with wiki pages.
export const Icon = ({ className, symbol, color }) => {
  const cls = classNames('icon', color && `icon--${color}`, className);

  const def = iconDefs[symbol];
  if (def) {
    return (
      <svg viewBox={def.viewBox} focusable="false" className={cls}>
        {def.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  }

  // No inline def — render an empty svg placeholder
  return <svg focusable="false" className={cls} />;
};

Icon.propTypes = {
  className: PropTypes.string,
  symbol: PropTypes.string.isRequired,
};
