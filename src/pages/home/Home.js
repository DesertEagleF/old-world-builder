import { Fragment, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { FormattedMessage, useIntl } from "react-intl";
import { Helmet } from "react-helmet-async";
import { SITE_URL } from "../../config/site";
import classNames from "classnames";

import { Button } from "../../components/button";
import { Icon } from "../../components/icon";
import { ListItem, OrderableList } from "../../components/list";
import { Header, Main } from "../../components/page";
import { Dialog } from "../../components/dialog";
import { getAllPoints } from "../../utils/points";
import { setArmy } from "../../state/army";
import { setItems } from "../../state/items";
import { getResourceUrl, getAssetUrl } from '../../utils/resourceLoader';
// banner assets removed from imports because not used on this page
import { swap } from "../../utils/collection";
// useLanguage removed from this file (not needed)
import { updateLocalList, updateListsFolder } from "../../utils/list";
import { setLists, toggleFolder, updateList } from "../../state/lists";
import { updateSetting } from "../../state/settings";
import { getRandomId } from "../../utils/id";
import PatchedBadge from "../../components/patch/PatchedBadge";

import "./Home.css";

const armyIconMap = {
  "the-empire": "the-empire",
  dwarfs: "dwarfs",
  greenskins: "greenskins",
  "empire-of-man": "the-empire",
  "orc-and-goblin-tribes": "greenskins",
  "dwarfen-mountain-holds": "dwarfs",
  "warriors-of-chaos": "chaos-warriors",
  "kingdom-of-bretonnia": "bretonnia",
  "beastmen-brayherds": "beastmen",
  "wood-elf-realms": "wood-elves",
  "tomb-kings-of-khemri": "tomb-kings",
  "high-elf-realms": "high-elves",
  "dark-elves": "dark-elves",
  skaven: "skaven",
  "vampire-counts": "vampire-counts",
  "daemons-of-chaos": "chaos-deamons",
  "ogre-kingdoms": "ogres",
  lizardmen: "lizardmen",
  "chaos-dwarfs": "chaos-dwarfs",
  "grand-cathay": "cathay",
  "renegade-crowns": "renegade",
};

export const Home = ({ isMobile }) => {
  const MainComponent = isMobile ? Main : Fragment;
  const settings = useSelector((state) => state.settings);
  let lists = updateListsFolder(useSelector((state) => state.lists));

  // Sort lists based on the current sorting setting
  switch (settings.listSorting) {
    case "nameAsc":
      lists = [...lists].sort((a, b) => {
        if (
          !a.folder &&
          !b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return a.name.localeCompare(b.name);
        }

        if (
          a.folder &&
          a.folder === b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return a.name.localeCompare(b.name);
        }

        return 0;
      });
      break;
    case "nameDesc":
      lists = [...lists].sort((a, b) => {
        if (
          !a.folder &&
          !b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return b.name.localeCompare(a.name);
        }

        if (
          a.folder &&
          a.folder === b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return b.name.localeCompare(a.name);
        }

        return 0;
      });
      break;
    case "faction":
      lists = [...lists].sort((a, b) => {
        if (
          !a.folder &&
          !b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return a.army.localeCompare(b.army);
        }

        if (
          a.folder &&
          a.folder === b.folder &&
          a.type !== "folder" &&
          b.type !== "folder"
        ) {
          return a.army.localeCompare(b.army);
        }

        return 0;
      });
      break;
    default:
      break;
  }

  const location = useLocation();
  // language and timezone not required in this component
  const dispatch = useDispatch();
  const intl = useIntl();
  const [listsInFolder, setListsInFolder] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(null);
  const [activeMenu, setActiveMenu] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [activeDeleteOption, setActiveDeleteOption] = useState("delete");
  const resetState = () => {
    dispatch(setArmy(null));
    dispatch(setItems(null));
  };
  const updateLocalSettings = (newSettings) => {
    localStorage.setItem("owb.settings", JSON.stringify(newSettings));
  };
  const handleListMoved = ({ sourceIndex, destinationIndex }) => {
    const draggedItem = lists.find((list, index) => index === sourceIndex);
    const difference = sourceIndex - destinationIndex;

    setListsInFolder([]);

    if (difference === 0) {
      return;
    }

    if (draggedItem.type === "folder") {
      const listBeforeDestination = lists.find(
        (_, index) => index === destinationIndex - 1
      );
      const listAtDestination = lists.find(
        (_, index) => index === destinationIndex
      );
      const listAfterDestination = lists.find(
        (_, index) => index === destinationIndex + 1
      );

      if (
        !listBeforeDestination ||
        !listAfterDestination ||
        (difference > 0 && listAtDestination.type === "folder") || // Moving up
        (difference < 0 && listAfterDestination.type === "folder") // Moving down
      ) {
        let newLists = swap(lists, sourceIndex, destinationIndex);
        const listsInFolder = lists.filter(
          (list) => list.folder === draggedItem.id
        );

        listsInFolder.forEach((_, index) => {
          newLists = swap(
            newLists,
            sourceIndex + (destinationIndex < sourceIndex ? 1 + index : 0),
            destinationIndex + (destinationIndex < sourceIndex ? 1 + index : 0)
          );
        });
        newLists = updateListsFolder(newLists);

        localStorage.setItem("owb.lists", JSON.stringify(newLists));
        dispatch(setLists(newLists));
      }
    } else {
      let newLists = updateListsFolder(
        swap(lists, sourceIndex, destinationIndex)
      );

      localStorage.setItem("owb.lists", JSON.stringify(newLists));
      dispatch(setLists(newLists));
    }
  };
  const folders = lists.filter((list) => list.type === "folder");
  const listsWithoutFolders = lists.filter((list) => list.type !== "folder");
  const moreButtonsFolder = [
    {
      name: intl.formatMessage({
        id: "misc.rename",
      }),
      icon: "edit",
      callback: ({ name }) => {
        setFolderName(name);
        setDialogOpen("edit");
      },
    },
    {
      name: intl.formatMessage({
        id: "misc.delete",
      }),
      icon: "delete",
      callback: ({ name }) => {
        setFolderName(name);
        setActiveDeleteOption("delete");
        setDialogOpen("delete");
      },
    },
  ];
  const moreButtonsSort = [
    {
      name: intl.formatMessage({
        id: "misc.manual",
      }),
      type: "manual",
      callback: () => {
        setSortMenuOpen(false);
        updateLocalSettings({
          ...settings,
          listSorting: "manual",
        });
        dispatch(updateSetting({ key: "listSorting", value: "manual" }));
      },
    },
    {
      name: intl.formatMessage({
        id: "misc.faction",
      }),
      type: "faction",
      callback: () => {
        setSortMenuOpen(false);
        updateLocalSettings({
          ...settings,
          listSorting: "faction",
        });
        dispatch(updateSetting({ key: "listSorting", value: "faction" }));
      },
    },
    {
      name: intl.formatMessage({
        id: "misc.nameAsc",
      }),
      type: "nameAsc",
      callback: () => {
        setSortMenuOpen(false);
        updateLocalSettings({
          ...settings,
          listSorting: "nameAsc",
        });
        dispatch(updateSetting({ key: "listSorting", value: "nameAsc" }));
      },
    },
    {
      name: intl.formatMessage({
        id: "misc.nameDesc",
      }),
      type: "nameDesc",
      callback: () => {
        setSortMenuOpen(false);
        updateLocalSettings({
          ...settings,
          listSorting: "nameDesc",
        });
        dispatch(updateSetting({ key: "listSorting", value: "nameDesc" }));
      },
    },
  ];
  const handleCancelClick = (event) => {
    event.preventDefault();
    setDialogOpen(null);
    setActiveMenu(null);
    setFolderName("");
  };
  const handleDeleteConfirm = () => {
    let newLists = lists.filter((list) => list.id !== activeMenu);

    if (activeDeleteOption === "delete") {
      newLists = newLists.filter(
        (list) => list.folder !== activeMenu || !list.folder
      );
    }

    newLists = updateListsFolder(newLists);

    setDialogOpen(null);
    setActiveMenu(null);
    dispatch(setLists(newLists));
    localStorage.setItem("owb.lists", JSON.stringify(newLists));
  };
  const handleEditConfirm = () => {
    const list = lists.find((list) => list.id === activeMenu);

    setDialogOpen(null);
    setActiveMenu(null);
    dispatch(updateList({ ...list, listId: list.id, name: folderName }));
    updateLocalList({
      ...list,
      name: folderName,
    });
  };
  const handleNewConfirm = () => {
    const newLists = updateListsFolder([
      {
        id: `folder-${getRandomId()}`,
        name: folderName || intl.formatMessage({ id: "home.newFolder" }),
        type: "folder",
        open: true,
      },
      ...lists,
    ]);

    localStorage.setItem("owb.lists", JSON.stringify(newLists));
    dispatch(setLists(newLists));
    setFolderName("");
    setDialogOpen(null);
    window.scrollTo(0, 0);
  };
  const handleDragStart = (start) => {
    const draggedItem = lists.find(
      (list) =>
        list.id === start.draggableId || list.folder === start.draggableId
    );
    const listsInFolder = lists
      .map((list, index) => ({ folder: list.folder, index: index }))
      .filter((list) => list.folder);

    if (draggedItem.type === "folder") {
      setListsInFolder(listsInFolder);
    }
  };
  const handleDeleteOptionChange = (option) => {
    setActiveDeleteOption(option);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>
          Old World Builder - Army builder for Warhammer: The Old World
        </title>
        <link rel="canonical" href={`${SITE_URL}/`} />
      </Helmet>

      <Dialog
        open={dialogOpen === "delete"}
        onClose={() => setDialogOpen(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDeleteConfirm();
          }}
        >
          <p className="home__delete-text">
            <FormattedMessage
              id="home.confirmDelete"
              values={{
                folder: <b>{folderName}</b>,
              }}
            />
          </p>
          <div className="radio">
            <input
              type="radio"
              id="delete-lists"
              name="lists"
              value="delete"
              onChange={() => handleDeleteOptionChange("delete")}
              checked={activeDeleteOption === "delete"}
              className="radio__input"
            />
            <label htmlFor="delete-lists" className="radio__label">
              <span className="unit__label-text">
                <FormattedMessage id="home.deleteLists" />
              </span>
            </label>
          </div>
          <div className="radio">
            <input
              type="radio"
              id="keep-lists"
              name="lists"
              value="keep"
              onChange={() => handleDeleteOptionChange("keep")}
              checked={activeDeleteOption === "keep"}
              className="radio__input"
            />
            <label htmlFor="keep-lists" className="radio__label">
              <span className="unit__label-text">
                <FormattedMessage id="home.keepLists" />
              </span>
            </label>
          </div>
          <div className="editor__delete-dialog">
            <Button
              type="text"
              onClick={handleCancelClick}
              icon="close"
              spaceTop
              color="dark"
            >
              <FormattedMessage id="misc.cancel" />
            </Button>
            <Button type="primary" submitButton icon="delete" spaceTop>
              <FormattedMessage id="misc.delete" />
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialogOpen === "edit"} onClose={() => setDialogOpen(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEditConfirm();
          }}
        >
          <label htmlFor="folderName">
            <FormattedMessage id="misc.folderName" />
          </label>
          <input
            type="text"
            id="folderName"
            className="input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoComplete="off"
            maxLength="100"
            required
          />
          <div className="editor__delete-dialog">
            <Button
              type="text"
              onClick={handleCancelClick}
              icon="close"
              spaceTop
              color="dark"
            >
              <FormattedMessage id="misc.cancel" />
            </Button>
            <Button type="primary" submitButton icon="check" spaceTop>
              <FormattedMessage id="misc.confirm" />
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialogOpen === "new"} onClose={() => setDialogOpen(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNewConfirm();
          }}
        >
          <label htmlFor="newFolderName">
            <FormattedMessage id="misc.folderName" />
          </label>
          <input
            type="text"
            id="newFolderName"
            className="input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoComplete="off"
            maxLength="100"
            required
          />
          <div className="editor__delete-dialog">
            <Button
              type="text"
              onClick={handleCancelClick}
              icon="close"
              spaceTop
              color="dark"
            >
              <FormattedMessage id="misc.cancel" />
            </Button>
            <Button type="primary" submitButton icon="check" spaceTop>
              <FormattedMessage id="misc.confirm" />
            </Button>
          </div>
        </form>
      </Dialog>

      {isMobile && <Header headline="Old World Builder" hasMainNavigation />}
      <MainComponent>
        {listsWithoutFolders.length > 0 && (
          <section className="column-header home__header">
            <Button
              type="text"
              label={intl.formatMessage({ id: "home.newFolder" })}
              color="dark"
              icon="new-folder"
              onClick={() => {
                setFolderName("");
                setDialogOpen("new");
              }}
            >
              <FormattedMessage id="home.newFolder" />
            </Button>
            <Button
              type="text"
              label={intl.formatMessage({ id: "misc.sort" })}
              color="dark"
              onClick={() => {
                setSortMenuOpen(!sortMenuOpen);
              }}
              className={classNames(sortMenuOpen && "header__more-button")}
            >
              <FormattedMessage
                id={`misc.${settings.listSorting || "manual"}`}
              />
              <Icon symbol="sort" className="home__sort-icon" />
            </Button>
            {sortMenuOpen && (
              <ul className="header__more">
                {moreButtonsSort.map(
                  ({ callback, name, type, to: moreButtonTo }) => (
                    <li key={name}>
                      <Button
                        type="text"
                        onClick={() => callback({ type })}
                        to={moreButtonTo}
                      >
                        {name}
                      </Button>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>
        )}

        <hr className="home__divider" />

        {listsWithoutFolders.length === 0 && (
          <>
            <RemoteImg
              listKey="assets"
              filename="owb"
              alt=""
              width={100}
              height={100}
              className="home__logo"
            />
            <i className="home__empty">
              <FormattedMessage id="home.empty" />
            </i>
          </>
        )}
        <OrderableList
          id="armies"
          onMoved={handleListMoved}
          onDragStart={handleDragStart}
        >
          {lists.map(
            ({
              id,
              name,
              description,
              points,
              game,
              army,
              type,
              folder,
              open,
              ...list
            }) =>
              type === "folder" ? (
                <ListItem
                  key={id}
                  to="#"
                  className={classNames(
                    "home__folder",
                    activeMenu === id && "home__folder--active"
                  )}
                >
                  <span className="home__list-item">
                    <div className="home__headline home__headline--folder">
                      <Button
                        type="text"
                        label={intl.formatMessage({
                          id: "export.optionsTitle",
                        })}
                        color="dark"
                        icon="more"
                        onClick={() => {
                          if (activeMenu === id) {
                            setActiveMenu(null);
                          } else {
                            setActiveMenu(id);
                          }
                        }}
                        className={classNames(
                          activeMenu === id && "header__more-button"
                        )}
                      />
                      <span className="home__folder-name">{name}</span>
                      <Button
                        type="text"
                        label={
                          open
                            ? intl.formatMessage({ id: "misc.collapseFolder" })
                            : intl.formatMessage({ id: "misc.expandFolder" })
                        }
                        color="dark"
                        icon={open ? "collapse" : "expand"}
                        onClick={() => {
                          updateLocalList({
                            id,
                            name,
                            type,
                            open: !open,
                          });
                          dispatch(toggleFolder({ folderId: id }));
                        }}
                      />
                    </div>
                  </span>
                  {activeMenu === id && (
                    <ul className="header__more folder__more">
                      {moreButtonsFolder.map(
                        ({
                          callback,
                          name: buttonName,
                          icon,
                          to: moreButtonTo,
                        }) => (
                          <li key={buttonName}>
                            <Button
                              type="text"
                              onClick={() => callback({ name })}
                              to={moreButtonTo}
                              icon={icon}
                            >
                              {buttonName}
                            </Button>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </ListItem>
              ) : (
                <ListItem
                  key={id}
                  to={`?editor.${id}`}
                  active={location.pathname.includes(id)}
                  onClick={resetState}
                  hide={
                    folders.find((folderData) => folderData.id === folder)
                      ?.open === false
                  }
                  className={classNames(
                    listsInFolder.length > 0 && "home__list--dragging"
                  )}
                >
                  {folder ? (
                    <Icon symbol="folder" className="home__folder-icon" />
                  ) : null}
                  <span className="home__list-item">
                    <div className="home__headline">
                      {name}
                      {list.patches && list.patches.length > 0 && (
                        <PatchedBadge
                          text={list.patches[list.patches.length - 1]?.displayName || list.patches[list.patches.length - 1]?.id}
                          className="home__patch-badge"
                        />
                      )}
                    </div>
                    {description && (
                      <p className="home__description">{description}</p>
                    )}
                    <p className="home__points">
                      {getAllPoints({
                        ...list,
                        points,
                      })}{" "}
                      / {points} <FormattedMessage id="app.points" />
                    </p>
                  </span>
                  <div className="home__info">
                    {/* Runtime-resolved image: try direct key then list mapping */}
                    <RemoteImg filename={armyIconMap[army] || 'owb'} listKey="army-icons" width={40} height={40} />
                  </div>
                </ListItem>
              )
          )}
        </OrderableList>
        <Button
          centered
          to="?new"
          icon="new-list"
          spaceTop
          onClick={resetState}
          size="large"
        >
          <FormattedMessage id="home.newList" />
        </Button>
        <Button
          centered
          to="?import"
          type="text"
          icon="import"
          color="dark"
          spaceTop
          onClick={resetState}
        >
          <FormattedMessage id="home.import" />
        </Button>
      </MainComponent>
    </>
  );
};

// Inline helper component to load an asset URL at runtime using resourceLoader.
function RemoteImg({ listKey, filename, alt = '', width, height, className }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // try direct mapping first
        let url = await getResourceUrl(`${listKey}-${filename}`);
        if (!url) url = await getAssetUrl(listKey, filename);
        if (mounted && url) setSrc(url);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [listKey, filename]);
  return <img src={src || ''} alt={alt} width={width} height={height} className={className} />;
}
