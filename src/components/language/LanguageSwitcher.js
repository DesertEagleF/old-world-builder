import React, { useState, useRef, useEffect } from "react";
import classNames from "classnames";
import PropTypes from "prop-types";
import { useIntl } from "react-intl";

import "./LanguageSwitcher.css";
import { getResourceUrl, getAssetUrl } from '../../utils/resourceLoader';
import { useLanguage } from "../../utils/useLanguage";

const flagMap = {
  en: 'usa',
  de: 'germany',
  es: 'spain',
  fr: 'france',
  it: 'italy',
  pl: 'polen',
  cn: 'china',
};

export const LanguageSwitcher = ({ className }) => {
  const { language } = useLanguage();
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Inline runtime image resolver for flags
  function RemoteImg({ listKey, filename, alt = '', width, height, className: imgClass }) {
    const [src, setSrc] = useState('');
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          let url = await getResourceUrl(`${listKey}-${filename}`);
          if (!url) url = await getAssetUrl(listKey, filename);
          if (mounted && url) setSrc(url);
        } catch (e) {}
      })();
      return () => { mounted = false; };
    }, [listKey, filename]);
    return <img src={src || ''} alt={alt} width={width} height={height} className={imgClass} />;
  }

  const handleChange = (lang) => {
    localStorage.setItem("lang", lang);
    // reload to apply language change across the app
    window.location.reload();
  };

  return (
    <div className={classNames("language-switcher", className)} ref={ref}>
      <button
        type="button"
        className="language-switcher__button"
        onClick={() => setOpen(!open)}
        title={intl.formatMessage({ id: "misc.changeLanguage" })}
      >
        <RemoteImg filename={flagMap[language] || 'usa'} listKey="flags" alt={language} width={20} height={15} />
      </button>

      {open && (
        <ul className="language-switcher__menu">
          {Object.keys(flagMap).map((lang) => (
            <li key={lang}>
              <button
                type="button"
                className="language-switcher__menu-item"
                onClick={() => handleChange(lang)}
              >
                <RemoteImg listKey="flags-" filename={flagMap[lang]} alt={lang} width={20} height={15} />
                <span className="language-switcher__menu-text">
                  {intl.formatMessage({ id: `language.${lang}` })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

LanguageSwitcher.propTypes = {
  className: PropTypes.string,
};

export default LanguageSwitcher;
