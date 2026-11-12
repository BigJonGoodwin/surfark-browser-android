/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: finds the main content of a page in the plain tree (see tree.js).
//
// This is what makes the reader "forced": Firefox's own reader view refuses pages it does not
// consider articles, while this always returns something (the best-scoring block, or the whole
// page when nothing stands out).
//
// The method is a simple text-density score, our own code. It is weaker than Mozilla's
// Readability.js (Apache-2.0), which could replace `findMain` later without touching callers.

(function (root) {
  "use strict";
  const T = (typeof module !== "undefined" && module.exports) ? require("./tree.js") : root.Surfark.tree;

  const CONTAINERS = new Set(["article", "main", "section", "div", "td"]);

  // Text directly useful for reading: text inside paragraphs-like children, minus link text.
  function measure(node) {
    let chars = 0, linkChars = 0, paragraphs = 0, commas = 0;
    (function visit(n, inLink) {
      if (n.text !== undefined) {
        const len = n.text.replace(/\s+/g, " ").trim().length;
        chars += len;
        if (inLink) linkChars += len;
        commas += (n.text.match(/[,，、]/g) || []).length;
        return;
      }
      if (n.tag === "p" || n.tag === "pre" || n.tag === "blockquote" || n.tag === "li") {
        if (T.cleanText(n).length >= 40) paragraphs++;
      }
      for (const c of n.children) visit(c, inLink || n.tag === "a");
    })(node, false);
    return { chars, linkChars, paragraphs, commas };
  }

  function score(node) {
    const m = measure(node);
    if (m.chars < 140) return 0;
    const linkDensity = m.linkChars / m.chars;
    let s = (m.chars - m.linkChars) / 100 + m.paragraphs * 3 + Math.min(m.commas, 30);
    s *= 1 - Math.min(linkDensity * 1.5, 0.95); // menus and link lists score low
    if (node.tag === "article") s *= 1.25;
    if (node.tag === "main") s *= 1.15;
    return s;
  }

  // Returns the node that best holds the article. Prefers the smallest container that still has
  // most of the best score, so wrappers full of sidebars lose to the article inside them.
  function findMain(tree) {
    const candidates = [{ node: tree, score: score(tree), chars: measure(tree).chars }];
    T.walk(tree, (n) => {
      if (!n.tag || !CONTAINERS.has(n.tag) || n === tree) return;
      const s = score(n);
      if (s > 0) candidates.push({ node: n, score: s, chars: measure(n).chars });
    });
    let top = 0;
    for (const c of candidates) top = Math.max(top, c.score);
    if (top <= 0) return tree;
    // Everything within 15% of the best score is "the article or a wrapper around it".
    // Of those, the one with the least text is the tightest fit.
    let best = null;
    for (const c of candidates) {
      if (c.score < top * 0.85) continue;
      if (!best || c.chars < best.chars) best = c;
    }
    return best.node;
  }

  // The first h1 inside the content, else the given fallback (the tab's title).
  function findTitle(tree, fallback) {
    let found = "";
    T.walk(tree, (n) => {
      if (!found && n.tag === "h1") found = T.cleanText(n);
    });
    const tidy = String(fallback || "").replace(/\s+/g, " ").trim();
    return found || tidy || "Untitled";
  }

  // Removes a leading h1 that repeats the title, so the title is not shown twice.
  function dropLeadingTitle(node, title) {
    let done = false;
    (function visit(n) {
      if (done || !n.children) return;
      for (let i = 0; i < n.children.length; i++) {
        const c = n.children[i];
        if (c.text !== undefined) {
          if (c.text.trim()) { done = true; return; }
          continue;
        }
        if (c.tag === "h1" && T.cleanText(c) === title) {
          n.children.splice(i, 1);
          done = true;
          return;
        }
        visit(c);
        if (done) return;
        if (T.cleanText(c)) { done = true; return; }
      }
    })(node);
    return node;
  }

  // tree: the whole page as a plain tree. Returns { title, content } where content is a tree.
  function article(tree, tabTitle) {
    const main = findMain(tree);
    const title = findTitle(main, tabTitle);
    return { title, content: dropLeadingTitle(main, title) };
  }

  const api = { measure, score, findMain, findTitle, dropLeadingTitle, article };
  root.Surfark = root.Surfark || {};
  root.Surfark.extract = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
