/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: the part that runs inside the web page.
//
// It is injected only when the user presses one of the companion's buttons (see background.js),
// after lib/tree.js, lib/extract.js and lib/names.js. It answers one message and does nothing
// on its own. It never changes the page.
//
//   { surfark: "article" }   -> { title, url, content, selectionOnly }   (content: plain tree)
//   { surfark: "snapshot" }  -> { title, url, html, skipped }            (one-file copy of the page)

(function () {
  "use strict";
  if (globalThis.__surfarkPageLoaded) return; // injected twice: keep the first listener only
  globalThis.__surfarkPageLoaded = true;

  const { tree, extract, names } = globalThis.Surfark;
  const api = globalThis.browser || globalThis.chrome;

  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // one picture
  const MAX_TOTAL_BYTES = 30 * 1024 * 1024;  // all pictures in one snapshot

  function isHidden(element) {
    const style = getComputedStyle(element);
    return style.display === "none" || style.visibility === "hidden";
  }

  function article() {
    const base = document.baseURI;
    const selection = getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      const fragment = selection.getRangeAt(0).cloneContents();
      return {
        title: document.title || location.hostname,
        url: location.href,
        content: tree.fromDom(fragment, base, null),
        selectionOnly: true,
      };
    }
    const whole = tree.fromDom(document.body, base, isHidden);
    const found = extract.article(whole, document.title);
    return { title: found.title, url: location.href, content: found.content, selectionOnly: false };
  }

  // Asks the background script to fetch something the page itself may not read (other sites'
  // stylesheets and pictures). Returns null on any failure.
  async function fetchVia(kind, url, maxBytes) {
    try {
      const reply = await api.runtime.sendMessage({ surfark: "fetch", kind, url, maxBytes });
      return reply && reply.ok ? reply.value : null;
    } catch (e) {
      return null;
    }
  }

  async function stylesheetText(sheet) {
    const base = sheet.href || document.baseURI;
    try {
      let css = "";
      for (const rule of sheet.cssRules) css += rule.cssText + "\n";
      return names.absolutizeCss(css, base);
    } catch (e) { // another site's stylesheet: the page may not read its rules
      if (!sheet.href) return "";
      const fetched = await fetchVia("text", sheet.href, 5 * 1024 * 1024);
      return fetched ? names.absolutizeCss(fetched, base) : null;
    }
  }

  const URL_ATTRS = [["a", "href"], ["area", "href"], ["img", "src"], ["source", "src"], ["video", "src"],
    ["audio", "src"], ["video", "poster"], ["link", "href"], ["track", "src"]];

  async function snapshot() {
    const skipped = { stylesheets: 0, images: 0 };
    const base = document.baseURI;

    // 1. Read what only the live page knows, before cloning: stylesheets, form values, canvases.
    const sheets = [];
    // Stylesheets in the page plus ones scripts attached directly ("adopted"). Styles inside
    // shadow roots (some web components) are not covered yet.
    for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) {
      if (sheet.disabled) continue;
      const media = sheet.media && sheet.media.mediaText;
      const css = await stylesheetText(sheet);
      if (css === null) { skipped.stylesheets++; continue; }
      if (css) sheets.push(media && media !== "all" ? "@media " + media + " {\n" + css + "}\n" : css);
    }
    const liveImages = Array.from(document.images);
    const liveCanvases = Array.from(document.querySelectorAll("canvas"));
    const liveFields = Array.from(document.querySelectorAll("input, textarea, select"));

    const clone = document.documentElement.cloneNode(true);
    const cloneImages = Array.from(clone.querySelectorAll("img"));
    const cloneCanvases = Array.from(clone.querySelectorAll("canvas"));
    const cloneFields = Array.from(clone.querySelectorAll("input, textarea, select"));

    // 2. Form fields show what the user typed. Passwords are never copied.
    liveFields.forEach((live, i) => {
      const copy = cloneFields[i];
      if (!copy) return;
      if (live.type === "password") { copy.removeAttribute("value"); return; }
      if (live.tagName === "TEXTAREA") copy.textContent = live.value;
      else if (live.tagName === "SELECT") {
        Array.from(copy.options).forEach((o, j) => (j === live.selectedIndex ? o.setAttribute("selected", "") : o.removeAttribute("selected")));
      } else if (live.type === "checkbox" || live.type === "radio") {
        live.checked ? copy.setAttribute("checked", "") : copy.removeAttribute("checked");
      } else if (live.type !== "file" && live.type !== "hidden") copy.setAttribute("value", live.value);
    });

    // 3. Canvases become pictures (a canvas has no content once copied).
    liveCanvases.forEach((live, i) => {
      const copy = cloneCanvases[i];
      if (!copy) return;
      try {
        const img = document.createElement("img");
        img.src = live.toDataURL("image/png");
        img.width = live.width;
        img.height = live.height;
        img.style.cssText = live.style.cssText;
        copy.replaceWith(img);
      } catch (e) { /* a canvas drawn from another site cannot be read: leave it empty */ }
    });

    // 4. Nothing that runs: scripts, frames, event handlers, refreshes, the page's own policies.
    clone.querySelectorAll("script, noscript, iframe, frame, object, embed, base, " +
      "link[rel~='stylesheet'], style, link[rel~='preload'], link[rel~='modulepreload'], " +
      "link[rel~='prefetch'], link[rel~='preconnect'], link[rel~='dns-prefetch'], link[rel~='manifest'], " +
      "meta[http-equiv]").forEach((n) => n.remove());
    clone.querySelectorAll("*").forEach((element) => {
      for (const attr of Array.from(element.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || name === "srcdoc" || name === "nonce" || name === "integrity") element.removeAttribute(attr.name);
        else if ((name === "href" || name === "src" || name === "action" || name === "formaction" || name === "xlink:href") &&
          /^\s*javascript:/i.test(attr.value)) element.removeAttribute(attr.name);
      }
    });

    // 5. Addresses become full addresses, so links and remaining pictures still work.
    for (const [tag, attr] of URL_ATTRS) {
      clone.querySelectorAll(tag + "[" + attr + "]").forEach((element) => {
        const value = element.getAttribute(attr);
        if (!value || value.startsWith("#") || /^(data:|blob:|mailto:|tel:)/i.test(value)) return;
        try { element.setAttribute(attr, new URL(value, base).href); } catch (e) { /* leave as is */ }
      });
    }

    // 6. Pictures are copied into the file, within the size limits.
    let total = 0;
    const cache = new Map();
    for (let i = 0; i < cloneImages.length; i++) {
      const copy = cloneImages[i];
      const live = liveImages[i];
      copy.removeAttribute("srcset");
      copy.removeAttribute("sizes");
      copy.removeAttribute("loading");
      const src = (live && live.currentSrc) || copy.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      let full;
      try { full = new URL(src, base).href; } catch (e) { continue; }
      copy.setAttribute("src", full);
      if (!/^https?:/i.test(full) || total >= MAX_TOTAL_BYTES) { skipped.images++; continue; }
      if (!cache.has(full)) cache.set(full, await fetchVia("dataUrl", full, MAX_IMAGE_BYTES));
      const data = cache.get(full);
      if (!data) { skipped.images++; continue; }
      total += data.length;
      copy.setAttribute("src", data);
    }
    clone.querySelectorAll("picture > source").forEach((n) => n.remove());

    // 7. Put the gathered styles back, add our own header lines.
    let head = clone.querySelector("head");
    if (!head) { head = document.createElement("head"); clone.insertBefore(head, clone.firstChild); }
    const policy = document.createElement("meta");
    policy.setAttribute("http-equiv", "Content-Security-Policy");
    policy.setAttribute("content", "default-src 'none'; img-src data: http: https:; media-src data: http: https:; " +
      "style-src 'unsafe-inline' http: https:; font-src data: http: https:");
    const charset = document.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    const source = document.createElement("meta");
    source.setAttribute("name", "surfark-snapshot-source");
    source.setAttribute("content", location.href);
    const when = document.createElement("meta");
    when.setAttribute("name", "surfark-snapshot-saved");
    when.setAttribute("content", names.localIso(new Date()));
    clone.querySelectorAll("meta[charset]").forEach((n) => n.remove());
    head.prepend(charset, policy, source, when);
    for (const css of sheets) {
      const style = document.createElement("style");
      style.textContent = css;
      head.appendChild(style);
    }

    const note = "<!-- Saved by Surfark Companion from " + location.href.replace(/--/g, "- -") +
      " on " + names.localIso(new Date()) + " -->\n";
    return {
      title: document.title || location.hostname,
      url: location.href,
      html: "<!DOCTYPE html>\n" + note + clone.outerHTML,
      skipped,
    };
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || (message.surfark !== "article" && message.surfark !== "snapshot")) return undefined;
    Promise.resolve()
      .then(() => (message.surfark === "article" ? article() : snapshot()))
      .then((value) => sendResponse({ ok: true, value }), (error) => sendResponse({ ok: false, error: String(error && error.message || error) }));
    return true; // the answer comes later
  });
})();
