import classNames from "classnames";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";

import { Spinner } from "../../components/spinner";

import "./Page.css";

export const Main = ({ className, children, isDesktop, compact, loading }) => {
  return (
    <>
      <main
        className={classNames(
          "main",
          isDesktop ? "main--desktop" : "main--mobile",
          compact && "main--compact",
          className
        )}
      >
        {children}
        {loading && <Spinner />}
      </main>
      {!loading && (
        <footer className="footer">
          <nav className="footer__navigation">
            <Link to="?new-features">
              <FormattedMessage id="footer.new-features" />
            </Link>
            <Link to="?about">
              <FormattedMessage id="footer.about" />
            </Link>
            <Link to="?help">
              <FormattedMessage id="footer.help" />
            </Link>
            <Link to="?changelog">
              <FormattedMessage id="footer.changelog" />
            </Link>
            <Link to="?custom-datasets">
              <FormattedMessage id="footer.custom-datasets" />
            </Link>
            <Link to="?datasets">
              <FormattedMessage id="footer.datasets-editor" />
            </Link>
            <Link to="?privacy">
              <FormattedMessage id="footer.privacy" />
            </Link>
          </nav>
          <div className="footer__license">
            本页面内容遵循<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>协议
          </div>
        </footer>
      )}
    </>
  );
};

Main.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isDesktop: PropTypes.bool,
};
