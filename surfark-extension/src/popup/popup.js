/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion popup: three buttons that ask the background script to do the work.
"use strict";

const api = globalThis.browser || globalThis.chrome;
const status = document.getElementById("status");
const buttons = Array.from(document.querySelectorAll("button[data-action]"));

// Remember which tab was in front when the popup opened (on Android the popup can take its place).
const tabAtOpen = api.tabs.query({ active: true, currentWindow: true })
  .then(([tab]) => (tab && /^https?:/i.test(tab.url || "") ? tab.id : undefined))
  .catch(() => undefined);

async function run(action) {
  buttons.forEach((b) => (b.disabled = true));
  status.className = "";
  status.textContent = "Working…";
  try {
    const reply = await api.runtime.sendMessage({ surfark: "run", action, tabId: await tabAtOpen });
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || "No answer from the companion.");
    status.textContent = reply.value.message || "Done.";
    if (action === "reader") window.close();
  } catch (error) {
    status.className = "error";
    status.textContent = String(error && error.message || error);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

buttons.forEach((b) => b.addEventListener("click", () => run(b.dataset.action)));
document.getElementById("options").addEventListener("click", (event) => {
  event.preventDefault();
  api.runtime.openOptionsPage();
});
