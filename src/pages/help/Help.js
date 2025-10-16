import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FormattedMessage, useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";

import { Header, Main } from "../../components/page";

export const Help = () => {
  const location = useLocation();
  const intl = useIntl();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>
          {`Old World Builder | ${intl.formatMessage({ id: "footer.help" })}`}
        </title>
      </Helmet>

      <Header headline="Old World Builder" hasMainNavigation hasHomeButton />

      <Main compact>
        <h2 className="page-headline">
          <FormattedMessage id="help.title" />
        </h2>
      </Main>
    </>
  );
};
