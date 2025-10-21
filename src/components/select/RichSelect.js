import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useLanguage } from '../../utils/useLanguage';
import './Select.css';

/**
 * RichSelect
 * Lightweight wrapper that renders a native <select> so the closed control
 * behaves exactly like other selects. Options must be provided with plain
 * text labels (e.g. `label` or localized `name_{lang}` fields). This sacrifices
 * rich node rendering inside options (HTML inside <option> is not supported)
 * but ensures consistent styling and accessibility.
 */
export const RichSelect = ({ options, selected, onChange, className, id }) => {
  const { language } = useLanguage();

  const handleChange = (e) => onChange(e.target.value);

  return (
    <select
      id={id}
      value={selected}
      onChange={handleChange}
      className={classNames('select', className)}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label || opt[`name_${language}`] || opt.name_en || opt.name}
        </option>
      ))}
    </select>
  );
};

RichSelect.propTypes = {
  options: PropTypes.array.isRequired,
  selected: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  className: PropTypes.string,
};

export default RichSelect;
