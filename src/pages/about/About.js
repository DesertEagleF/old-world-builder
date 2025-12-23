// About content rendered inside dialog: only the content fragment
import "./About.css";
import { useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";
import { Header, Main } from "../../components/page";

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

      <Main compact>
        <div className="about__content">
          <p>
            本项目是
            <a href="https://github.com/DesertEagleF/old-world-builder" target="_blank" rel="noopener noreferrer">本项目</a>
            的分支项目（
            <a href="https://github.com/nthiebes/old-world-builder" target="_blank" rel="noopener noreferrer">GitHub</a>
            ），内容遵循CC BY 4.0协议
          </p>
        </div>
      </Main>
    </>
  );
};
