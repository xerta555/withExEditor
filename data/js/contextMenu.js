/**
*	contextMenu.js
*/
(function() {
	"use strict";
	/* set context menu item label */
	self.on("context", function setContextMenuItemLabel() {
		var element = document.activeElement, selection = window.getSelection(), label;
		switch(true) {
			case (/^input$/i.test(element.nodeName) && element.hasAttribute("type") && element.getAttribute("type") === "text") || /^textarea$/i.test(element.nodeName) || /^(?:contenteditabl|tru)e$/i.test(element.contentEditable):
				label = "EditText"; break;
			case !selection.isCollapsed:
				label = "ViewSelection"; break;
			default:
				label = "ViewSource";
		}
		self.postMessage(label);
		return true;
	});

	/* get node value */
	self.on("click", function getNodeValue() {
		const VIEW_SOURCE = "mode=viewSource;";
		const DATA_ID = "data-with_ex_editor_id";
		// Namespaces http://www.w3.org/html/wg/drafts/html/master/infrastructure.html#namespaces
		const namespaces = {
			"html": "http://www.w3.org/1999/xhtml",
			"math": "http://www.w3.org/1998/Math/MathML",
			"svg": "http://www.w3.org/2000/svg",
			"xlink": "http://www.w3.org/1999/xlink",
			"xml": "http://www.w3.org/XML/1998/namespace",
			"xmlns": "http://www.w3.org/2000/xmlns/",
		};

		/* get namespace of node from ancestor */
		function getNodeNs(obj) {
			for(var namespace = {}, name; obj && obj.parentNode; obj = obj.parentNode) {
				name = /^(?:(?:math:)?(math)|(?:svg:)?(svg))$/.exec(obj.nodeName.toLowerCase());
				if(name) {
					namespace["node"] = obj;
					namespace["name"] = name[1] || name[2];
					namespace["uri"] = obj.hasAttribute("xmlns") ? obj.getAttribute("xmlns") : namespaces[namespace["name"]] ? namespaces[namespace["name"]] : "";
					break;
				}
			}
			!name && (
				obj = document.documentElement,
				namespace["node"] = obj,
				namespace["name"] = obj.nodeName.toLowerCase(),
				namespace["uri"] = obj.hasAttribute("xmlns") ? obj.getAttribute("xmlns") : namespaces[namespace["name"]] ? namespaces[namespace["name"]] : ""
			);
			return namespace;
		}

		/* create element */
		function getElement(node, nodes) {
			function getNamespace(obj, bool) {
				var elementNameParts = /^(?:(.*):)?(.*)$/.exec(obj.nodeName.toLowerCase());
				return {
					"namespace": namespaces[elementNameParts[1]] || bool && getNodeNs(obj).uri,
					"shortName": elementNameParts[2],
				};
			}
			function appendChildNodes(obj) {
				for(var fragment = document.createDocumentFragment(), child, i = 0, l = obj.childNodes.length; i < l; i++) {
					child = obj.childNodes[i];
					switch(child.nodeType) {
						case 1:
							fragment.appendChild(getElement(child, child)); break;
						case 3:
							fragment.appendChild(document.createTextNode(child.nodeValue)); break;
						default:
					}
				}
				return fragment;
			}
			var element;
			if(node) {
				node = getNamespace(node, true);
				element = document.createElementNS(node.namespace || namespaces["html"], node.shortName);
				if(nodes && element) {
					nodes.hasChildNodes() && element.appendChild(appendChildNodes(nodes));
					if(nodes.attributes) {
						for(var attr, attrNs, i = 0, l = nodes.attributes.length; i < l; i++) {
							attr = nodes.attributes[i];
							attrNs = getNamespace(attr, false);
							typeof nodes[attr.nodeName] !== "function" && element.setAttributeNS(attrNs.namespace || "", attrNs.shortName, attr.nodeValue);
						}
					}
				}
			}
			return element ? element : "";
		}

		/* create DOM tree */
		function getDomTree(container, nodes) {
			function createDom(obj) {
				for(var fragment = document.createDocumentFragment(), value, node, i = 0, l = obj.childNodes.length; i < l; i++) {
					node = obj.childNodes[i];
					switch(node.nodeType) {
						case 1:
							i === 0 && fragment.appendChild(document.createTextNode("\n"));
							fragment.appendChild(getElement(node, node));
							i === l - 1 && fragment.appendChild(document.createTextNode("\n"));
							break;
						case 3:
							fragment.appendChild(document.createTextNode(node.nodeValue)); break;
						default:
					}
				}
				return fragment;
			}
			container = container ? getElement(container) : "";
			container && container.nodeType === 1 ? nodes && nodes.hasChildNodes() && container.appendChild(createDom(nodes)) : (container = document.createTextNode(""));
			return container;
		}

		/* set temporary ID to the target element */
		function onEditText(target) {
			var id;
			target && (
				target.hasAttribute(DATA_ID) ? id = target.getAttribute(DATA_ID) : (
					id = ("withExEditor" + window.performance.now()).replace(/\./, "_"),
					target.setAttribute(DATA_ID, id),
					target.addEventListener("focus", function(event) {
						event && event.currentTarget === target && self.postMessage(event.target.getAttribute(DATA_ID));
					}, false)
				)
			);
			return id ? "mode=editText;target=" + id + ";value=" : VIEW_SOURCE;
		}

		/* get text node from editable content */
		function onContentEditable(nodes) {
			function getTextNode(obj) {
				for(var array = [], node, i = 0, l = obj.childNodes.length; i < l; i++) {
					node = obj.childNodes[i];
					switch(true) {
						case node.nodeType === 3:
							array[array.length] = node.nodeValue; break;
						case node.nodeType === 1 && node.nodeName.toLowerCase() === "br":
							array[array.length] = "\n"; break;
						case node.nodeType === 1 && node.hasChildNodes():
							array[array.length] = getTextNode(node); break;
						default:
					}
				}
				return array.length > 0 ? array.join("") : "";
			}
			function getTextNodeFromContent(obj) {
				for(var array = [], node, container, i = 0, l = obj.childNodes.length; i < l; i++) {
					node = obj.childNodes[i];
					switch(true) {
						case node.nodeType === 3:
							array[array.length] = node.nodeValue; break;
						case node.nodeType === 1 && node.nodeName.toLowerCase() === "br":
							array[array.length] = "\n"; break;
						case node.nodeType === 1 && node.hasChildNodes():
							container = getElement(node);
							container && container.nodeType === 1 && (
								container = getDomTree(container, node),
								array[array.length] = getTextNode(container)
							);
							break;
						default:
					}
				}
				return array.length > 0 ? array.join("") : "";
			}
			return nodes ? getTextNodeFromContent(nodes) : "";
		}

		/* create DOM from range and get childNodes */
		function onViewSelection(sel) {
			function replaceNamespaseToCommonPrefix(string) {
				Object.keys(namespaces).forEach(function(key) {
					var reg = new RegExp("xmlns:([a-z0-9]+)=\"" + namespaces[key] + "\""),
						name = reg.exec(string);
					name && (
						name = name[1],
						string = string.replace("xmlns:" + name + "=", "xmlns:" + key + "=", "gm").replace(" " + name + ":", " " + key + ":", "gm")
					);
				});
				return string;
			}
			var fragment = document.createDocumentFragment();
			if(sel && sel.rangeCount) {
				for(var range, embed, i = 0, l = sel.rangeCount; i < l; i++) {
					range = sel.getRangeAt(i);
					embed = getNodeNs(range.commonAncestorContainer);
					if(/^(?:svg|math)$/.test(embed["name"])) {
						if(embed["node"] === document.documentElement) {
							fragment = null;
							break;
						}
						else {
							embed["node"].parentNode && (
								range.setStart(embed["node"].parentNode, 0),
								range.setEnd(embed["node"].parentNode, embed["node"].parentNode.childNodes.length)
							);
						}
					}
					fragment.appendChild(getDomTree(range.commonAncestorContainer, range.cloneContents()));
					i < l - 1 && fragment.appendChild(document.createTextNode("\n\n"));
				}
			}
			return fragment && fragment.hasChildNodes() && window.XMLSerializer ? "mode=viewSelection;value=" + replaceNamespaseToCommonPrefix(new XMLSerializer().serializeToString(fragment)) : VIEW_SOURCE;
		}

		/* switch mode by context */
		var selection = window.getSelection(), targetObj, nodeValue;
		if(selection.isCollapsed) {
			targetObj = document.activeElement;
			switch(true) {
				case (/^input$/i.test(targetObj.nodeName) && targetObj.hasAttribute("type") && targetObj.getAttribute("type") === "text") || /^textarea$/i.test(targetObj.nodeName):
					nodeValue = onEditText(targetObj) + (targetObj.value ? targetObj.value : ""); break;
				case /^(?:contenteditabl|tru)e$/i.test(targetObj.contentEditable):
					nodeValue = onEditText(targetObj) + onContentEditable(targetObj); break;
				default:
					nodeValue = VIEW_SOURCE;
			}
		}
		else {
			targetObj = selection.getRangeAt(0).commonAncestorContainer;
			switch(true) {
				case selection.anchorNode === selection.focusNode && selection.anchorNode.parentNode === document.documentElement:
					nodeValue = VIEW_SOURCE; break;
				case selection.rangeCount === 1 && /^(?:contenteditabl|tru)e$/i.test(targetObj.contentEditable):
					nodeValue = onEditText(targetObj) + onContentEditable(targetObj); break;
				default:
					nodeValue = onViewSelection(selection);
			}
		}
		self.postMessage(nodeValue);
	});
})();
