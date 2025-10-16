import { useLocation } from "react-router-dom";
import { useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";

import { Header, Main } from "../../components/page";

import "./About.css";

export const About = () => {
  const intl = useIntl();

  return (
    <>
      <Helmet>
        <title>
          {`Old World Builder | ${intl.formatMessage({ id: "footer.about" })}`}
        </title>
      </Helmet>

      <Header headline="Old World Builder" hasMainNavigation hasHomeButton />

      <Main compact></Main>
    </>
  );
};
