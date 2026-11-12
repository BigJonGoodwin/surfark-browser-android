/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion settings: the two folder names. Saved as soon as a field loses focus.
"use strict";

const api = globalThis.browser || globalThis.chrome;
const names = globalThis.Surfark.names;
const DEFAULTS = { notesFolder: "Surfark Notes", snapshotsFolder: "Surfark Snapshots" };
const saved = document.getElementById("saved");

(async function start() {
  const stored = await api.storage.local.get(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    input.value = names.folder(stored[key], DEFAULTS[key]);
    input.addEventListener("change", async () => {
      input.value = names.folder(input.value, DEFAULTS[key]); // cleaned: no drive letters, no ".."
      await api.storage.local.set({ [key]: input.value });
      saved.textContent = "Saved.";
    });
  }
})();
