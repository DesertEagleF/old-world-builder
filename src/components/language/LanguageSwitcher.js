import React, { useState, useRef, useEffect } from "react";
import classNames from "classnames";
import PropTypes from "prop-types";
import { useIntl } from "react-intl";

import "./LanguageSwitcher.css";
import germany from "../../assets/germany.svg";
import usa from "../../assets/usa.svg";
import spain from "../../assets/spain.svg";
import france from "../../assets/france.svg";
import italy from "../../assets/italy.svg";
import polen from "../../assets/polen.svg";
import china from "../../assets/china.svg";
import { useLanguage } from "../../utils/useLanguage";

const flagMap = {
  en: usa,
  de: germany,
  es: spain,
  fr: france,
  it: italy,
  pl: polen,
  cn: china,
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
        <img
          src={flagMap[language] || usa}
          alt={language}
          width="20"
          height="15"
        />
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
                <img src={flagMap[lang]} alt={lang} width="20" height="15" />
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
