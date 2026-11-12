/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: file names, dates and CSS address fixing. Pure functions, no browser needed.

(function (root) {
  "use strict";

  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i; // names Windows refuses

  // A title made safe as a file name on Windows, Android and Linux.
  function slug(title, maxLength) {
    let s = String(title || "")
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, "")
      .slice(0, maxLength || 80)
      .replace(/[. ]+$/, "");
    if (!s || RESERVED.test(s)) s = "page";
    return s;
  }

  // A folder name from settings, limited to one or more safe path parts. Never absolute.
  function folder(value, fallback) {
    const parts = String(value || "")
      .split(/[\\/]+/)
      .map((p) => slug(p, 60))
      .filter((p) => p && p !== "page" && p !== "..");
    return parts.length ? parts.join("/") : fallback;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  // Local date and time with the UTC offset, for the note's front matter: 2026-11-12T04:10:00-06:00
  function localIso(date) {
    const off = -date.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
      sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
  }
  function day(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }
  function clock(date) {
    return pad(date.getHours()) + pad(date.getMinutes());
  }

  function noteFile(dir, title, date) {
    return dir + "/" + day(date) + " " + slug(title) + ".md";
  }
  function snapshotFile(dir, title, date) {
    return dir + "/" + day(date) + " " + clock(date) + " " + slug(title) + ".html";
  }

  // Rewrites every url(...) and @import "..." in a stylesheet to a full address, so a stylesheet
  // copied into a saved page still finds its fonts and images. data: and # references stay.
  function absolutizeCss(css, base) {
    const fix = (raw) => {
      const u = raw.trim();
      if (!u || /^(data:|blob:|about:|#)/i.test(u)) return raw;
      try {
        const full = new URL(u, base);
        return full.protocol === "http:" || full.protocol === "https:" ? full.href : raw;
      } catch (e) {
        return raw;
      }
    };
    return String(css)
      .replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (m, q, u) => "url(" + q + fix(u) + q + ")")
      .replace(/(@import\s+)(['"])([^'"]+)\2/gi, (m, pre, q, u) => pre + q + fix(u) + q);
  }

  const api = { slug, folder, localIso, day, clock, noteFile, snapshotFile, absolutizeCss };
  root.Surfark = root.Surfark || {};
  root.Surfark.names = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
