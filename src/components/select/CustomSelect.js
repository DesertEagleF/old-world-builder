import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import PatchedBadge from '../patch/PatchedBadge';
import './Select.css';

const CustomSelect = ({ options, selected, onChange, className, id, appliedPatchObjects }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = options.find((o) => o.id === selected) || options[0] || {};

  return (
    <div className={classNames('custom-select', { 'custom-select--open': open })} ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={classNames('select', className)}
        onClick={() => setOpen((s) => !s)}
      >
        <span className="custom-select__label">{current[`name_en`] || current.name}</span>
        {current.source && current.source !== 'base' && (
          <span className="custom-select__selected-badge">
            <PatchedBadge text={(appliedPatchObjects || []).find(p => p.id === current.source)?.displayName || current.source} />
          </span>
        )}
      </button>

      {open && (
        <ul className="custom-select__list" role="listbox">
          {options.map((opt) => (
            <li key={opt.id} className="custom-select__item">
              <button
                type="button"
                className="custom-select__option"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span className="custom-select__option-label">{opt[`name_en`] || opt.name}</span>
                {opt.source && opt.source !== 'base' && (
                  <span className="custom-select__option-badge">
                    <PatchedBadge text={(appliedPatchObjects || []).find(p => p.id === opt.source)?.displayName || opt.source} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

CustomSelect.propTypes = {
  options: PropTypes.array.isRequired,
  selected: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  className: PropTypes.string,
  appliedPatchObjects: PropTypes.array,
};

export default CustomSelect;
