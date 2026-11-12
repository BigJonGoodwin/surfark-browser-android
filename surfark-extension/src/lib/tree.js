/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: a plain-data copy of a page's content.
//
// Why this exists: the reader view and "save to notes" both need the page's main content, and
// both must be safe to run on untrusted pages. So the page's DOM is copied once into a small
// tree of plain objects, with only known-safe tags and attributes kept. Everything after that
// (finding the article, writing markdown, drawing the reader page) works on this tree and never
// touches the page's own HTML again. Plain data also makes the logic testable in Node without a
// browser.
//
// Node shapes:  { text: "..." }   or   { tag: "p", attrs: { href: "..." }, children: [...] }

(function (root) {
  "use strict";

  // Tags we keep. Anything else is unwrapped: its children are kept, the tag itself is dropped.
  const KEEP = new Set([
    "a", "abbr", "article", "b", "blockquote", "br", "caption", "cite", "code", "dd", "del", "div",
    "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
    "ins", "kbd", "li", "main", "mark", "ol", "p", "pre", "q", "s", "section", "small", "span",
    "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul",
  ]);
  // Tags dropped together with everything inside them.
  const DROP = new Set([
    "script", "style", "noscript", "template", "iframe", "object", "embed", "svg", "canvas", "video",
    "audio", "form", "input", "button", "select", "textarea", "nav", "aside", "footer", "header",
    "dialog", "menu", "link", "meta", "head", "title",
  ]);
  const BLOCK = new Set([
    "article", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "h1", "h2", "h3", "h4",
    "h5", "h6", "hr", "li", "main", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th",
    "thead", "tr", "ul",
  ]);

  // Only web addresses and inline images get through. javascript:, file: and the rest are dropped.
  function safeUrl(value, base, allowDataImage) {
    if (typeof value !== "string" || !value.trim()) return null;
    const trimmed = value.trim();
    if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed, base || undefined);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function el(tag, attrs, children) {
    return { tag, attrs: attrs || {}, children: children || [] };
  }
  function text(value) {
    return { text: String(value) };
  }

  // Copies a DOM node into the plain tree. `base` is the page's address, for relative links.
  // `isHidden` is optional: given an element, says whether the page hides it.
  function fromDom(node, base, isHidden) {
    const out = [];
    copyInto(node, base, isHidden, out);
    return out.length === 1 && out[0].tag ? out[0] : el("div", {}, out);
  }

  function copyInto(node, base, isHidden, out) {
    if (node.nodeType === 3) {
      if (node.nodeValue) out.push(text(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return; // elements and fragments only
    const tag = node.nodeType === 1 ? String(node.localName || node.nodeName || "").toLowerCase() : "";
    if (tag) {
      if (DROP.has(tag)) return;
      if (node.getAttribute && (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("hidden"))) return;
      if (isHidden && isHidden(node)) return;
    }
    const children = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      copyInto(child, base, isHidden, children);
    }
    if (!tag || !KEEP.has(tag)) {
      for (const c of children) out.push(c);
      return;
    }
    const attrs = {};
    if (tag === "a") {
      const href = safeUrl(node.getAttribute("href"), base, false);
      if (href) attrs.href = href;
    } else if (tag === "img") {
      const src = safeUrl(node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src"), base, true);
      if (!src) return; // an image with nothing to show
      attrs.src = src;
      const alt = node.getAttribute("alt");
      if (alt) attrs.alt = alt;
    } else if (tag === "td" || tag === "th") {
      const span = parseInt(node.getAttribute("colspan"), 10);
      if (span > 1 && span < 50) attrs.colspan = String(span);
    } else if (tag === "ol") {
      const start = parseInt(node.getAttribute("start"), 10);
      if (Number.isFinite(start) && start !== 1) attrs.start = String(start);
    } else if (tag === "time") {
      const when = node.getAttribute("datetime");
      if (when) attrs.datetime = when;
    }
    out.push(el(tag, attrs, children));
  }

  // All text under a node, with whitespace collapsed.
  function textOf(node) {
    if (!node) return "";
    if (node.text !== undefined) return node.text;
    let s = "";
    for (const c of node.children) s += textOf(c);
    return s;
  }
  function cleanText(node) {
    return textOf(node).replace(/\s+/g, " ").trim();
  }

  function walk(node, visit) {
    visit(node);
    if (node.children) for (const c of node.children) walk(c, visit);
  }

  const api = { KEEP, DROP, BLOCK, safeUrl, el, text, fromDom, textOf, cleanText, walk };
  root.Surfark = root.Surfark || {};
  root.Surfark.tree = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
