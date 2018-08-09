/**
 * localize.js
 */

import {DATA_I18N, EXT_LOCALE} from "./constant.js";

/* api */
const {i18n} = browser;

/**
 * localize attribute value
 * @param {Object} elm - element
 * @returns {void}
 */
export const localizeAttr = async elm => {
  if (elm && elm.nodeType === Node.ELEMENT_NODE &&
      elm.hasAttribute(DATA_I18N)) {
    const [id] = elm.getAttribute(DATA_I18N).split(/\s*,\s*/);
    if (id) {
      const attrs = {
        alt: "alt",
        ariaLabel: "aria-label",
        href: "href",
        placeholder: "placeholder",
        title: "title",
      };
      const items = Object.entries(attrs);
      for (const item of items) {
        const [key, value] = item;
        elm.hasAttribute(value) &&
          elm.setAttribute(value, i18n.getMessage(`${id}_${key}`));
      }
    }
  }
};

/**
 * localize html
 * @returns {void}
 */
export const localizeHtml = async () => {
  const lang = i18n.getMessage(EXT_LOCALE);
  if (lang) {
    const nodes = document.querySelectorAll(`[${DATA_I18N}]`);
    if (nodes instanceof NodeList) {
      for (const node of nodes) {
        const [id, ph] = node.getAttribute(DATA_I18N).split(/\s*,\s*/);
        const data = i18n.getMessage(id, ph);
        data && (node.textContent = data);
        node.hasAttributes() && localizeAttr(node);
      }
    }
    document.documentElement.setAttribute("lang", EXT_LOCALE);
  }
};