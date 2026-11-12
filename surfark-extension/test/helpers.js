// Test helpers: build content trees by hand, and fake just enough of a DOM for tree.fromDom.
"use strict";
const T = require("../src/lib/tree.js");

// h("p", {attrs}, child, child...) where a child is a string (text) or another node.
function h(tag, attrs, ...children) {
  return T.el(tag, attrs || {}, children.map((c) => (typeof c === "string" ? T.text(c) : c)));
}

// A fake DOM element/text node with the handful of members fromDom reads.
function dom(tag, attrs, ...children) {
  const node = {
    nodeType: 1, localName: tag, _attrs: attrs || {},
    getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; },
    hasAttribute(name) { return name in this._attrs; },
    firstChild: null, nextSibling: null,
  };
  const kids = children.map((c) => (typeof c === "string" ? { nodeType: 3, nodeValue: c, nextSibling: null } : c));
  kids.forEach((k, i) => (k.nextSibling = kids[i + 1] || null));
  node.firstChild = kids[0] || null;
  return node;
}

const lorem = (n) => Array.from({ length: n }, (_, i) => "Sentence number " + (i + 1) + " has some words, and a comma.").join(" ");

module.exports = { h, dom, lorem };
