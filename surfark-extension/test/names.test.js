"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../src/lib/names.js");

test("slug removes what Windows, Android and Linux refuse in file names", () => {
  assert.equal(N.slug('What? A "title": with/slashes\\ and <tags> | pipes*'), "What A title with slashes and tags pipes");
  assert.equal(N.slug("  trailing dots and spaces... "), "trailing dots and spaces");
  assert.equal(N.slug("...hidden"), "hidden");
  assert.equal(N.slug("tab\tand\nnewline"), "tab and newline");
});

test("slug never returns an empty or reserved name", () => {
  for (const bad of ["", "   ", "???", "CON", "nul", "com1", null, undefined]) assert.equal(N.slug(bad), "page", String(bad));
});

test("slug cuts long titles and does not leave a trailing space or dot", () => {
  const s = N.slug("word ".repeat(40), 22);
  assert.ok(s.length <= 22);
  assert.ok(!/[ .]$/.test(s));
});

test("folder keeps sub-folders but can never leave Downloads", () => {
  assert.equal(N.folder("Notes/Web", "x"), "Notes/Web");
  assert.equal(N.folder("C:\\Users\\me\\Notes", "x"), "C/Users/me/Notes");
  assert.equal(N.folder("../../etc", "x"), "etc");
  assert.equal(N.folder("/absolute/path", "x"), "absolute/path");
  assert.equal(N.folder("..", "Fallback"), "Fallback");
  assert.equal(N.folder("", "Fallback"), "Fallback");
});

test("file names carry the date, and the time for snapshots", () => {
  const d = new Date(2026, 10, 12, 4, 7, 9); // local time
  assert.equal(N.noteFile("Surfark Notes", "A title", d), "Surfark Notes/2026-11-12 A title.md");
  assert.equal(N.snapshotFile("Snaps", "A title", d), "Snaps/2026-11-12 0407 A title.html");
});

test("localIso has the shape 2026-11-12T04:07:09+hh:mm and the right moment", () => {
  const d = new Date(2026, 10, 12, 4, 7, 9);
  const iso = N.localIso(d);
  assert.match(iso, /^2026-11-12T04:07:09[+-]\d\d:\d\d$/);
  assert.equal(new Date(iso).getTime(), d.getTime());
});

test("absolutizeCss completes relative addresses and leaves the rest", () => {
  const base = "https://cdn.example.com/css/site.css";
  const css = [
    "a{background:url(../img/a.png)}",
    "b{background:url( 'b.png' )}",
    'c{background:url("https://other.example/c.png")}',
    "d{background:url(data:image/png;base64,AAAA)}",
    "e{filter:url(#blur)}",
    '@import "more.css";',
    "@font-face{src:url(/fonts/f.woff2) format('woff2')}",
  ].join("\n");
  assert.equal(N.absolutizeCss(css, base), [
    "a{background:url(https://cdn.example.com/img/a.png)}",
    "b{background:url('https://cdn.example.com/css/b.png')}",
    'c{background:url("https://other.example/c.png")}',
    "d{background:url(data:image/png;base64,AAAA)}",
    "e{filter:url(#blur)}",
    '@import "https://cdn.example.com/css/more.css";',
    "@font-face{src:url(https://cdn.example.com/fonts/f.woff2) format('woff2')}",
  ].join("\n"));
});
