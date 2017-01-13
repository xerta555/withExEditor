/**
 * background.js
 */
"use strict";
{
  /* api */
  const {browserAction, contextMenus, i18n, runtime, tabs, windows} = browser;
  const storage = browser.storage.local;

  /* constants */
  const LABEL = "withExEditor";

  const CONTEXT_MENU = "contextMenu";
  const OPEN_OPTIONS = "openOptions";
  const PORT_CONTENT = "portContent";
  const PORT_HOST = "portHost";
  const SET_VARS = "setVars";

  const FILE_EXT = "fileExt";
  const FILE_EXT_PATH = "../data/fileExt.json";
  const ICON = "./img/icon.svg";
  const ICON_COLOR = "buttonIcon";
  const ICON_GRAY = "buttonIconGray";
  const ICON_WHITE = "buttonIconWhite";
  const INCOGNITO = "incognito";
  const MENU_ENABLED = "menuEnabled";
  const MODE_EDIT_TEXT = "modeEditText";
  const MODE_MATHML = "modeViewMathML";
  const MODE_SELECTION = "modeViewSelection";
  const MODE_SOURCE = "modeViewSource";
  const MODE_SVG = "modeViewSVG";
  const NS_URI = "nsUri";
  const NS_URI_PATH = "../data/nsUri.json";
  const WARN_COLOR = "#C13832";
  const WARN_TEXT = "!";

  const APP_MANIFEST = "appManifestPath";
  const APP_NAME = "appName";
  const EDITOR_NAME = "editorName";
  const ENABLE_ONLY_EDITABLE = "enableOnlyEditable";
  const ENABLE_PB = "enablePB";
  const FORCE_REMOVE = "forceRemove";
  const IS_ENABLED = "isEnabled";
  const IS_EXEC = "isExecutable";
  const ICON_PATH = "iconPath";
  const KEY_ACCESS = "accessKey";
  const KEY_EXEC_EDITOR = "editorShortCut";
  const KEY_OPEN_OPTIONS = "optionsShortCut";

  /* variables */
  const vars = {
    [IS_ENABLED]: false,
    [KEY_ACCESS]: "e",
    [KEY_EXEC_EDITOR]: true,
    [KEY_OPEN_OPTIONS]: true,
    [ENABLE_ONLY_EDITABLE]: false,
  };

  const varsLoc = {
    [APP_MANIFEST]: "",
    [APP_NAME]: "",
    [EDITOR_NAME]: "",
    [ENABLE_PB]: false,
    [FORCE_REMOVE]: true,
    [ICON_PATH]: `${ICON}#gray`,
    [IS_EXEC]: false,
    [MENU_ENABLED]: false,
    [MODE_SOURCE]: "",
    [MODE_MATHML]: "",
    [MODE_SVG]: "",
  };

  /**
   * log error
   * @param {!Object} e - Error
   * @return {boolean} - false
   */
  const logError = e => {
    console.error(e);
    return false;
  };

  /**
   * is string
   * @param {*} o - object to check
   * @return {boolean} - result
   */
  const isString = o =>
    o && (typeof o === "string" || o instanceof String) || false;

  /**
   * stringify positive integer
   * @param {number} i - integer
   * @param {boolean} zero - treat 0 as a positive integer
   * @return {?string} - stringified integer
   */
  const stringifyPositiveInt = (i, zero = false) =>
    Number.isSafeInteger(i) && (zero && i >= 0 || i > 0) && `${i}` || null;

  /* windows */
  /**
   * check one of window is incognito
   * @return {boolean} - result
   */
  const checkWindowIncognito = async () => {
    const windowIds = await windows.getAll();
    let incog;
    if (windowIds && windowIds.length) {
      for (const windowId of windowIds) {
        incog = windowId.incognito;
        if (incog) {
          break;
        }
      }
    }
    return incog || false;
  };

  /* port */
  let host = null;

  /**
   * connect to native application host
   * @return {void}
   */
  const connectHost = async () => {
    const name = varsLoc[APP_NAME];
    host && host.disconnect();
    host = varsLoc[IS_EXEC] && name && runtime.connectNative(name) || null;
  };

  /**
   * port message to native application host
   * @param {*} msg - message
   * @return {void}
   */
  const portHostMsg = async msg => {
    msg && host && host.postMessage(msg);
  };

  /* content ports collection */
  const ports = {};

  /**
   * restore ports collection
   * @param {Object} data - disconnected port data
   * @return {Object} - Promise.<Array<*>>
   */
  const restorePorts = async (data = {}) => {
    const func = [];
    const {tabId, windowId} = data;
    if (windowId && tabId && ports[windowId]) {
      delete ports[windowId][tabId];
      Object.keys(ports[windowId]).length === 0 &&
        func.push(restorePorts({windowId}));
    } else {
      windowId && delete ports[windowId];
    }
    return Promise.all(func);
  };

  /**
   * port message
   * @param {*} msg - message
   * @param {string} windowId - windowId
   * @param {string} tabId - tabId
   * @return {void}
   */
  const portMsg = async (msg, windowId, tabId) => {
    if (msg) {
      if (windowId && tabId) {
        const frameUrls = ports[windowId] && ports[windowId][tabId] &&
                            Object.keys(ports[windowId][tabId]);
        if (frameUrls && frameUrls.length) {
          for (const frameUrl of frameUrls) {
            if (frameUrl !== INCOGNITO) {
              const port = ports[windowId][tabId][frameUrl];
              port && port.postMessage(msg);
            }
          }
        }
      } else if (windowId) {
        const tabIds = ports[windowId] && Object.keys(ports[windowId]);
        if (tabIds && tabIds.length) {
          for (tabId of tabIds) {
            portMsg(msg, windowId, tabId);
          }
        }
      } else {
        const windowIds = Object.keys(ports);
        if (windowIds.length) {
          for (windowId of windowIds) {
            portMsg(msg, windowId);
          }
        }
      }
    }
  };

  /**
   * port context menu data
   * @param {!Object} info - contextMenus.OnClickData
   * @param {!Object} tab - tabs.Tab
   * @return {void}
   */
  const portContextMenuData = async (info, tab) => {
    const {frameUrl} = info;
    const getContent = {info, tab};
    let {windowId, id: tabId} = tab;
    windowId = stringifyPositiveInt(windowId, true);
    tabId = stringifyPositiveInt(tabId, true);
    if (windowId && tabId) {
      const port = ports[windowId] && ports[windowId][tabId] &&
                     ports[windowId][tabId][frameUrl];
      port && port.postMessage({getContent});
    }
  };

  // NOTE: for hybrid
  const hybrid = runtime.connect({name: "portBackground"});

  /**
   * port message to hybrid
   * @param {*} msg - message
   * @return {void}
   */
  const portHybridMsg = async msg => {
    msg && hybrid.postMessage(msg);
  };

  /* icon */
  /**
   * replace icon
   * @param {Object} path - icon path
   * @return {void}
   */
  const replaceIcon = async (path = varsLoc[ICON_PATH]) => {
    browserAction.setIcon({path});
  };

  /**
   * toggle badge
   * @param {boolean} executable - executable
   * @return {void}
   */
  const toggleBadge = async (executable = varsLoc[IS_EXEC]) => {
    const color = !executable && WARN_COLOR || "transparent";
    const text = !executable && WARN_TEXT || "";
    browserAction.setBadgeBackgroundColor({color});
    browserAction.setBadgeText({text});
  };

  /* context menu */
  /* context menu items collection */
  const menus = {
    [MODE_SOURCE]: null,
    [MODE_SELECTION]: null,
    [MODE_EDIT_TEXT]: null,
  };

  // NOTE: no "accesskey" feature
  /**
   * create context menu item
   * @param {string} id - menu item ID
   * @param {Array} contexts - contexts
   * @return {void}
   */
  const createMenuItem = async (id, contexts) => {
    const label = varsLoc[EDITOR_NAME] || LABEL;
    isString(id) && menus.hasOwnProperty(id) && Array.isArray(contexts) && (
      menus[id] = contextMenus.create({
        id, contexts,
        title: i18n.getMessage(id, label),
        enabled: !!varsLoc[MENU_ENABLED],
      })
    );
  };

  /**
   * create context menu items
   * @return {Object} - Promise.<Array.<*>>
   */
  const createMenuItems = async () => {
    const func = [];
    const enabled = vars[IS_ENABLED];
    const bool = enabled && !vars[ENABLE_ONLY_EDITABLE];
    const items = Object.keys(menus);
    for (const item of items) {
      menus[item] = null;
      switch (item) {
        case MODE_EDIT_TEXT:
          enabled && func.push(createMenuItem(item, ["editable"]));
          break;
        case MODE_SELECTION:
          bool && func.push(createMenuItem(item, ["selection"]));
          break;
        case MODE_SOURCE:
          bool && func.push(createMenuItem(item, ["frame", "page"]));
          break;
        default:
      }
    }
    return Promise.all(func);
  };

  /**
   * restore context menu
   * @return {Object} - Promise.<Array.<*>>
   */
  const restoreContextMenu = () =>
    contextMenus.removeAll().then(createMenuItems);

  /**
   * update context menu
   * @param {Object} type - context type data
   * @return {void}
   */
  const updateContextMenu = async type => {
    if (type) {
      const items = Object.keys(type);
      if (items.length) {
        for (const item of items) {
          const obj = type[item];
          const {menuItemId} = obj;
          if (menus[menuItemId]) {
            if (item === MODE_SOURCE) {
              const title = varsLoc[obj.mode] || varsLoc[menuItemId];
              title && contextMenus.update(menuItemId, {title});
            } else if (item === MODE_EDIT_TEXT) {
              const enabled = !!obj.enabled;
              contextMenus.update(menuItemId, {enabled});
            }
          }
        }
      }
    } else {
      const items = Object.keys(menus);
      if (items.length) {
        for (const item of items) {
          menus[item] && contextMenus.update(item, {
            title: i18n.getMessage(item, varsLoc[EDITOR_NAME] || LABEL),
          });
        }
      }
    }
  };

  /**
   * cache localized context menu item title
   * @return {void}
   */
  const cacheMenuItemTitle = async () => {
    const items = [MODE_SOURCE, MODE_MATHML, MODE_SVG];
    const label = varsLoc[EDITOR_NAME] || LABEL;
    for (const item of items) {
      varsLoc[item] = i18n.getMessage(item, label);
    }
  };

  /* UI */
  /**
   * synchronize UI components
   * @return {Object} - ?Promise.<Array.<*>>
   */
  const syncUI = async () => {
    const win = await windows.getCurrent({windowTypes: ["normal"]});
    const enabled = vars[IS_ENABLED] = win && (
      !win.incognito || varsLoc[ENABLE_PB]
    ) || false;
    return win && Promise.all([
      portMsg({[IS_ENABLED]: !!enabled}),
      replaceIcon(!enabled && `${ICON}#off` || varsLoc[ICON_PATH]),
      toggleBadge(),
    ]) || null;
  };

  /* handle variables */
  /**
   * port variable
   * @param {Object} v - variable
   * @return {Object} - ?Promise.<void>
   */
  const portVar = async v => v && portMsg({[SET_VARS]: v}) || null;

  /**
   * set variable
   * @param {string} item - item
   * @param {Object} obj - value object
   * @param {boolean} changed - changed
   * @return {Object} - Promise.<Array<*>>
   */
  const setVar = async (item, obj, changed = false) => {
    const func = [];
    if (item && obj) {
      const hasPorts = Object.keys(ports).length;
      switch (item) {
        case APP_MANIFEST:
          varsLoc[item] = obj.value;
          varsLoc[IS_EXEC] = obj.app && !!obj.app.executable;
          func.push(connectHost());
          changed && func.push(toggleBadge());
          break;
        case APP_NAME:
          varsLoc[item] = obj.value;
          break;
        case EDITOR_NAME:
          varsLoc[item] = obj.value;
          func.push(cacheMenuItemTitle());
          changed && func.push(updateContextMenu());
          break;
        case ENABLE_ONLY_EDITABLE:
          vars[item] = !!obj.checked;
          hasPorts && func.push(portVar({[item]: !!obj.checked}));
          changed && func.push(restoreContextMenu());
          break;
        case ENABLE_PB:
          varsLoc[item] = !!obj.checked;
          changed && func.push(syncUI());
          break;
        case FORCE_REMOVE:
          varsLoc[item] = !!obj.checked;
          // NOTE: for hybrid
          func.push(portHybridMsg({[item]: !!obj.checked}));
          break;
        case ICON_COLOR:
        case ICON_GRAY:
        case ICON_WHITE:
          if (obj.checked) {
            varsLoc[ICON_PATH] = obj.value;
            changed && func.push(replaceIcon());
          }
          break;
        case KEY_ACCESS:
          vars[item] = obj.value;
          hasPorts && func.push(portVar({[item]: obj.value}));
          break;
        case KEY_EXEC_EDITOR:
        case KEY_OPEN_OPTIONS:
          vars[item] = !!obj.checked;
          hasPorts && func.push(portVar({[item]: !!obj.checked}));
          break;
        default:
      }
    }
    return Promise.all(func);
  };

  /**
   * set variables
   * @param {Object} data - storage data
   * @return {Object} - Promise.<Array<*>>
   */
  const setVars = async (data = {}) => {
    const func = [];
    const items = Object.keys(data);
    if (items.length) {
      for (const item of items) {
        const obj = data[item];
        func.push(setVar(item, obj.newValue || obj, !!obj.newValue));
      }
    }
    return Promise.all(func);
  };

  /* storage */
  /**
   * fetch and store data to share
   * @param {string} path - data path
   * @param {string} key - storage key
   * @return {Object} - ?Promise.<void>
   */
  const storeSharedData = async (path, key) =>
    isString(path) && isString(key) && fetch(path).then(async res => {
      const data = await res.json();
      return data && storage.set({
        [key]: data,
      }) || null;
    }) || null;

  /* handlers */
  /**
   * open options page
   * @return {Object} - ?Promise.<void>
   */
  const openOptionsPage = async () =>
    vars[IS_ENABLED] && runtime.openOptionsPage() || null;

  /**
   * handle runtime message
   * @param {*} msg - message
   * @return {Object} - Promise.<Array<*>>
   */
  const handleMsg = async msg => {
    const func = [];
    const items = msg && Object.keys(msg);
    if (items && items.length) {
      for (const item of items) {
        const obj = msg[item];
        if (obj) {
          switch (item) {
            case CONTEXT_MENU:
              func.push(updateContextMenu(obj));
              break;
            case OPEN_OPTIONS:
              func.push(openOptionsPage());
              break;
            case PORT_HOST:
              obj.path && func.push(portHostMsg(obj.path));
              break;
            default:
          }
        }
      }
    }
    return Promise.all(func).catch(logError);
  };

  /**
   * handle connected port
   * @param {!Object} port - runtime.Port
   * @return {void}
   */
  const handlePort = async port => {
    const {url: frameUrl, tab: {incognito}} = port.sender;
    let {windowId, id: tabId} = port.sender.tab;
    windowId = stringifyPositiveInt(windowId, true);
    tabId = stringifyPositiveInt(tabId, true);
    if (windowId && tabId && frameUrl) {
      ports[windowId] = ports[windowId] || {};
      ports[windowId][tabId] = ports[windowId][tabId] || {};
      ports[windowId][tabId][frameUrl] = port;
      port.onMessage.addListener(handleMsg);
      port.postMessage({
        incognito, tabId, windowId,
        [SET_VARS]: vars,
      });
    }
  };

  /**
   * handle tab activated
   * @param {!Object} info - activated tab info
   * @return {Object} - Promise.<Array.<*>>
   */
  const onTabActivated = async info => {
    let {tabId, windowId} = info, bool;
    windowId = stringifyPositiveInt(windowId, true);
    tabId = stringifyPositiveInt(tabId, true);
    if (windowId && tabId) {
      const items = ports[windowId] && ports[windowId][tabId] &&
                      Object.keys(ports[windowId][tabId]);
      if (items && items.length) {
        for (const item of items) {
          const obj = ports[windowId][tabId][item];
          if (obj && obj.name) {
            bool = obj.name === PORT_CONTENT;
            break;
          }
        }
      }
    }
    varsLoc[MENU_ENABLED] = bool || false;
    return restoreContextMenu().catch(logError);
  };

  /**
   * handle tab updated
   * @param {!number} id - tabId
   * @param {!Object} info - changed tab info
   * @param {!Object} tab - tabs.Tab
   * @return {Object} - Promise.<Array.<*>>
   */
  const onTabUpdated = async (id, info, tab) => {
    const func = [];
    const bool = info.status === "complete" && tab.active;
    const tabId = stringifyPositiveInt(id, true);
    const frameUrl = tab.url;
    let {windowId} = tab, portName;
    windowId = stringifyPositiveInt(windowId, true);
    windowId && tabId && frameUrl &&
    ports[windowId] && ports[windowId][tabId] &&
    ports[windowId][tabId][frameUrl] &&
      (portName = ports[windowId][tabId][frameUrl].name);
    varsLoc[MENU_ENABLED] = portName === PORT_CONTENT;
    bool && func.push(restoreContextMenu());
    return Promise.all(func).catch(logError);
  };

  /**
   * handle tab removed
   * @param {!number} id - tabId
   * @param {!Object} info - removed tab info
   * @return {Object} - ?Promise.<Array.<*>>
   */
  const onTabRemoved = async (id, info) => {
    const tabId = stringifyPositiveInt(id, true);
    let {windowId} = info;
    windowId = stringifyPositiveInt(windowId, true);
    return windowId && tabId && ports[windowId] && ports[windowId][tabId] &&
           restorePorts({windowId, tabId}) || null;
  };

  /**
   * handle window focus changed
   * @return {Object} - Promise.<?Array.<*>>
   */
  const onWindowFocusChanged = () =>
    windows.getAll({windowTypes: ["normal"]}).then(arr =>
      arr.length && syncUI() || null
    ).catch(logError);

  /**
   * handle window removed
   * @param {!number} windowId - windowId
   * @return {Object} - Promise.<Array.<*>>
   */
  const onWindowRemoved = async windowId => {
    const func = [];
    const win = await windows.getAll({windowTypes: ["normal"]});
    if (win.length) {
      func.push(restorePorts({windowId: stringifyPositiveInt(windowId, true)}));
      func.push(checkWindowIncognito().then(incognito =>
        // NOTE: for hybrid
        !incognito && portHybridMsg({removePrivateTmpFiles: !incognito})
      ));
    }
    return Promise.all(func).catch(logError);
  };

  /* listeners */
  browserAction.onClicked.addListener(() => openOptionsPage().catch(logError));
  browser.storage.onChanged.addListener(data => setVars(data).catch(logError));
  contextMenus.onClicked.addListener((info, tab) =>
    portContextMenuData(info, tab).catch(logError)
  );
  runtime.onConnect.addListener(port => handlePort(port).catch(logError));
  runtime.onMessage.addListener(handleMsg);
  tabs.onActivated.addListener(onTabActivated);
  tabs.onUpdated.addListener(onTabUpdated);
  tabs.onRemoved.addListener((id, info) =>
    onTabRemoved(id, info).catch(logError)
  );
  windows.onFocusChanged.addListener(onWindowFocusChanged);
  windows.onRemoved.addListener(onWindowRemoved);

  // NOTE: for hybrid
  hybrid.onMessage.addListener(handleMsg);

  /* startup */
  Promise.all([
    storage.get().then(setVars).then(syncUI),
    storeSharedData(NS_URI_PATH, NS_URI),
    storeSharedData(FILE_EXT_PATH, FILE_EXT),
  ]).catch(logError);
}
