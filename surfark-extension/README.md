# Surfark Companion

<!--
Context for whoever reads this next (person or AI):
- This is the WebExtension shared by both halves of Surfark Browser (Android: this repository;
  Windows: github.com/BigJonGoodwin/surfark-browser-desktop). The plan's rule: a feature that is
  about the page or the home server, not about the browser's own shell, belongs here, because
  one codebase then serves both browsers and survives Firefox updates.
- It lives in the Android repository for now only because that was the quickest place to put it.
  It can move to its own repository later (`git subtree split --prefix surfark-extension`).
- Written 2026-11-12 by an AI session without a browser to run it in. The logic in src/lib/ is
  unit-tested; the parts that talk to the browser (background.js, page.js, popup, reader,
  options) have NOT been run in Firefox, Zen or on Android yet. Expect to fix things on first use.
- It is not bundled into either browser yet. Nothing in the Android app's build touches this folder.
-->

Version 0.1.0 does three things, each from the toolbar button's popup (on desktop also from the
right-click menu and a keyboard shortcut):

| Action | What you get | Shortcut |
|---|---|---|
| **Save to notes** | A markdown file with the page's main text (or just the text you selected), its title, address and the time. Goes to `Downloads/Surfark Notes/`. | Alt+Shift+N |
| **Save snapshot** | The page as it looks now, in one HTML file that opens without the internet: styles and pictures are copied into the file, scripts are removed. Goes to `Downloads/Surfark Snapshots/`. | Alt+Shift+S |
| **Reader view** | The page's main text in a clean, readable column. Unlike Firefox's own reader, it works on every page. | Alt+Shift+R |

The two folder names can be changed in the extension's settings.

## Try it

Desktop (Zen or Firefox): open `about:debugging#/runtime/this-firefox`, choose "Load Temporary
Add-on…" and pick `surfark-extension/src/manifest.json`. It stays until the browser closes.

Android: not possible by hand yet. It needs either `web-ext run -t firefox-android` over USB, or
bundling into the Surfark Browser app (planned).

## Develop

```sh
cd surfark-extension
npm test        # unit tests, plain Node 20+, nothing to install
npm run lint    # Mozilla's web-ext lint (downloads web-ext on first use)
npm run build   # makes dist/surfark_companion-<version>.zip
```

CI runs the tests, the lint and the build on every change to this folder
(`.github/workflows/surfark-extension.yml`).

## How it is put together

```
src/manifest.json      Manifest V3, Firefox 128 or newer, desktop and Android
src/background.js      owns the three actions, saves files, fetches other sites' styles/pictures
src/page.js            runs inside the web page, only after you press a button
src/lib/tree.js        copies the page's content into plain data, keeping only safe tags/attributes
src/lib/extract.js     finds the main content (our own simple text-density scoring)
src/lib/markdown.js    plain data -> markdown
src/lib/names.js       file names, dates, fixing addresses inside CSS
src/popup/             the three buttons
src/reader/            the reader page
src/options/           the two folder names
test/                  unit tests for src/lib/
```

Safety choices worth knowing before changing things:

- The page script is injected only when a button is pressed. Nothing runs on pages you merely visit.
- The page's HTML never reaches the reader page. Content is copied into plain data with an
  allow-list of tags and attributes, and the reader rebuilds it with `createElement`.
- Only `http:` and `https:` addresses survive (plus inline pictures); `javascript:` and the rest
  are dropped.
- Snapshots contain no scripts, frames or event handlers and carry a policy line that forbids
  scripts, so a saved page cannot run code when opened later. Password fields are never copied.
- Folder names from the settings are cleaned so a file can only land inside Downloads.

## Known limits of 0.1.0

- Not yet run in a real browser (see the note at the top).
- The main-content finder is simple. Mozilla's Readability.js (Apache-2.0) would do better and
  can replace `extract.findMain` without touching the rest.
- Snapshots copy pictures in `<img>` tags (up to 3 MB each, 30 MB per page). Background pictures
  and fonts named in CSS stay as web addresses, so they need the internet. Frames, video, audio
  and anything a script draws later are left out.
- Notes link to pictures by web address; the pictures themselves are not saved.
- Files can only go to the Downloads folder. That is a limit WebExtensions have.

## Planned

- Send notes and snapshots to the home server (into the Obsidian vault) instead of, or as well
  as, Downloads. Needs a small receiver on the server first.
- YouTube links to a self-hosted Piped.
- Bundle the extension into both browsers so it is there from the first start.
