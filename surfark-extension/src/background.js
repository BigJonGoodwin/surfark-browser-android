/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: the background script. It owns the three actions:
//
//   note      save the page (or the selected text) as a markdown note
//   snapshot  save the page as one self-contained HTML file
//   reader    show the page's main content in the companion's own reader view
//
// Files go to the browser's Downloads folder, in the sub-folders set in the options
// ("Surfark Notes", "Surfark Snapshots"). Sending them to the home server instead is planned
// (see README.md) and is not built yet.
//
// Loaded after lib/names.js (see manifest.json), so Surfark.names is available here.

"use strict";

const api = globalThis.browser || globalThis.chrome;
const { names } = globalThis.Surfark;

const DEFAULTS = { notesFolder: "Surfark Notes", snapshotsFolder: "Surfark Snapshots" };
const PAGE_FILES = ["lib/tree.js", "lib/extract.js", "lib/names.js", "page.js"];

async function settings() {
  const stored = await api.storage.local.get(DEFAULTS);
  return {
    notesFolder: names.folder(stored.notesFolder, DEFAULTS.notesFolder),
    snapshotsFolder: names.folder(stored.snapshotsFolder, DEFAULTS.snapshotsFolder),
  };
}

const isWeb = (tab) => !!tab && !!tab.id && /^https?:/i.test(tab.url || "");

// The tab an action works on: the one the popup named, else the active one. On Android the
// popup itself can count as the active tab, so the fallback is the web page used most recently.
async function targetTab(tabId) {
  if (tabId !== undefined && tabId !== null) {
    const named = await api.tabs.get(tabId).catch(() => null);
    if (isWeb(named)) return named;
  }
  const [active] = await api.tabs.query({ active: true, currentWindow: true });
  if (isWeb(active)) return active;
  if (active && !String(active.url || "").startsWith(api.runtime.getURL(""))) {
    throw new Error("This only works on web pages (http or https).");
  }
  const web = (await api.tabs.query({})).filter(isWeb).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (!web.length) throw new Error("No web page to work on.");
  return web[0];
}

async function askPage(tab, what) {
  await api.scripting.executeScript({ target: { tabId: tab.id }, files: PAGE_FILES });
  const reply = await api.tabs.sendMessage(tab.id, { surfark: what });
  if (!reply || !reply.ok) throw new Error((reply && reply.error) || "The page did not answer.");
  return reply.value;
}

async function saveFile(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  try {
    await api.downloads.download({ url, filename, saveAs: false, conflictAction: "uniquify" });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000); // the download needs the address for a moment
  }
  return filename;
}

async function saveNote(tabId) {
  const tab = await targetTab(tabId);
  const page = await askPage(tab, "article");
  const now = new Date();
  const md = globalThis.Surfark.markdown.note(page.content, {
    title: page.title, url: page.url, savedIso: names.localIso(now), selectionOnly: page.selectionOnly,
  });
  const file = await saveFile(md, "text/markdown;charset=utf-8", names.noteFile((await settings()).notesFolder, page.title, now));
  return { message: (page.selectionOnly ? "Selection saved to " : "Note saved to ") + file };
}

async function saveSnapshot(tabId) {
  const tab = await targetTab(tabId);
  const page = await askPage(tab, "snapshot");
  const file = await saveFile(page.html, "text/html;charset=utf-8",
    names.snapshotFile((await settings()).snapshotsFolder, page.title, new Date()));
  const left = [];
  if (page.skipped.images) left.push(page.skipped.images + " picture(s) stay online-only");
  if (page.skipped.stylesheets) left.push(page.skipped.stylesheets + " stylesheet(s) could not be copied");
  return { message: "Snapshot saved to " + file + (left.length ? " (" + left.join(", ") + ")" : "") };
}

async function openReader(tabId) {
  const tab = await targetTab(tabId);
  const page = await askPage(tab, "article");
  const id = "reader-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  // Session storage: gone when the browser closes, never synced.
  await api.storage.session.set({ [id]: { title: page.title, url: page.url, content: page.content } });
  await api.tabs.update(tab.id, { url: api.runtime.getURL("reader/reader.html") + "?id=" + encodeURIComponent(id) });
  return { message: "" };
}

const ACTIONS = { note: saveNote, snapshot: saveSnapshot, reader: openReader };

// Fetches for the page script: other sites' stylesheets and pictures, which a page may not read
// itself. Web addresses only, size-limited, and only for our own page script.
async function fetchFor(message) {
  const url = new URL(message.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not a web address");
  const limit = Math.min(Number(message.maxBytes) || 0, 5 * 1024 * 1024) || 1024 * 1024;
  const response = await fetch(url.href, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("too large");
  const blob = await response.blob();
  if (blob.size > limit) throw new Error("too large");
  if (message.kind === "text") return await blob.text();
  if (!/^image\//i.test(blob.type) || /svg/i.test(blob.type)) throw new Error("not a picture we copy");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.surfark !== "string") return undefined;
  let work;
  const fromOwnPage = sender.id === api.runtime.id && String(sender.url || "").startsWith(api.runtime.getURL(""));
  if (message.surfark === "run" && ACTIONS[message.action] && fromOwnPage) {
    work = ACTIONS[message.action](message.tabId); // from our own popup only
  } else if (message.surfark === "fetch" && sender.tab && sender.id === api.runtime.id && !fromOwnPage) {
    work = fetchFor(message);
  } else {
    return undefined;
  }
  work.then((value) => sendResponse({ ok: true, value }),
    (error) => sendResponse({ ok: false, error: String(error && error.message || error) }));
  return true; // the answer comes later
});

// Right-click menu (desktop only: Firefox for Android has no such menu for extensions).
if (api.contextMenus) {
  api.runtime.onInstalled.addListener(() => {
    api.contextMenus.create({ id: "surfark-note", title: "Save to notes", contexts: ["page", "selection"] });
    api.contextMenus.create({ id: "surfark-snapshot", title: "Save snapshot of this page", contexts: ["page"] });
    api.contextMenus.create({ id: "surfark-reader", title: "Open in Surfark reader", contexts: ["page"] });
  });
  api.contextMenus.onClicked.addListener((info) => {
    const action = String(info.menuItemId).replace(/^surfark-/, "");
    if (ACTIONS[action]) ACTIONS[action](undefined).catch((e) => console.error("Surfark Companion:", e));
  });
}

// Keyboard shortcuts (desktop only).
if (api.commands) {
  api.commands.onCommand.addListener((command) => {
    if (ACTIONS[command]) ACTIONS[command]().catch((e) => console.error("Surfark Companion:", e));
  });
}
