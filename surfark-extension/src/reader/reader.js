/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark reader view: draws the content tree that the background script stored for this tab.
//
// Safety: the page's own HTML never reaches this document. The content arrives as plain data
// (see lib/tree.js) and is rebuilt here with createElement, using only the tags and attributes
// on the allow-list, so nothing from the page can run here.
"use strict";

const api = globalThis.browser || globalThis.chrome;
const tree = globalThis.Surfark.tree;

function build(node) {
  if (node.text !== undefined) return document.createTextNode(node.text);
  if (!tree.KEEP.has(node.tag)) return document.createTextNode("");
  const element = document.createElement(node.tag);
  if (node.tag === "a") {
    const href = tree.safeUrl(node.attrs.href, null, false);
    if (href) { element.href = href; element.rel = "noreferrer noopener"; }
  } else if (node.tag === "img") {
    const src = tree.safeUrl(node.attrs.src, null, true);
    if (!src) return document.createTextNode("");
    element.src = src;
    element.alt = node.attrs.alt || "";
    element.loading = "lazy";
    element.referrerPolicy = "no-referrer";
  } else if ((node.tag === "td" || node.tag === "th") && node.attrs.colspan) {
    element.colSpan = Number(node.attrs.colspan) || 1;
  } else if (node.tag === "ol" && node.attrs.start) {
    element.start = Number(node.attrs.start) || 1;
  }
  for (const child of node.children || []) element.appendChild(build(child));
  return element;
}

function setSize(px) {
  const size = Math.min(30, Math.max(14, px));
  document.documentElement.style.setProperty("--size", size + "px");
  api.storage.local.set({ readerSize: size });
  return size;
}

(async function start() {
  let size = (await api.storage.local.get({ readerSize: 19 })).readerSize;
  size = setSize(size);
  document.getElementById("smaller").addEventListener("click", () => (size = setSize(size - 1)));
  document.getElementById("larger").addEventListener("click", () => (size = setSize(size + 1)));

  const id = new URLSearchParams(location.search).get("id") || "";
  const stored = id ? (await api.storage.session.get(id))[id] : null;
  if (!stored) {
    const problem = document.getElementById("problem");
    problem.hidden = false;
    problem.textContent = "This reader page has expired. Go back to the page and open the reader again.";
    document.getElementById("source").textContent = "Back";
    document.getElementById("source").addEventListener("click", () => history.back());
    return;
  }
  document.title = stored.title + " (reader)";
  document.getElementById("title").textContent = stored.title;
  const source = document.getElementById("source");
  const url = tree.safeUrl(stored.url, null, false);
  if (url) {
    source.href = url;
    document.getElementById("origin").textContent = new URL(url).hostname.replace(/^www\./, "");
  }
  document.getElementById("content").appendChild(build(stored.content));
})();
