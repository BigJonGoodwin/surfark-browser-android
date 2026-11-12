"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/lib/markdown.js");
const { h } = require("./helpers.js");

test("paragraphs, headings and inline marks", () => {
  const md = M.fromTree(h("div", {},
    h("h2", {}, "A heading"),
    h("p", {}, "Plain, ", h("strong", {}, "bold"), ", ", h("em", {}, "italic"), " and ", h("code", {}, "code"), "."),
    h("p", {}, "Second paragraph.")));
  assert.equal(md, "## A heading\n\nPlain, **bold**, *italic* and `code`.\n\nSecond paragraph.\n");
});

test("emphasis marks stay outside surrounding spaces", () => {
  assert.equal(M.fromTree(h("p", {}, "a", h("strong", {}, " b "), "c")), "a **b** c\n");
  assert.equal(M.fromTree(h("p", {}, "a", h("em", {}, "  "), "c")), "a c\n");
});

test("characters that mean something in markdown are escaped in text", () => {
  assert.equal(M.fromTree(h("p", {}, "2 * 3 [not a link] <b> a_b `x`")), "2 \\* 3 \\[not a link\\] \\<b\\> a\\_b \\`x\\`\n");
});

test("links and pictures", () => {
  const md = M.fromTree(h("p", {},
    h("a", { href: "https://example.com/a (b)" }, "a link"), " ",
    h("img", { src: "https://example.com/p.png", alt: "Alt [text]" }), " ",
    h("a", {}, "no address"), " ",
    h("img", { src: "data:image/png;base64,AAAA", alt: "inline" })));
  assert.equal(md, "[a link](https://example.com/a%20%28b%29) ![Alt \\[text\\]](https://example.com/p.png) no address (image: inline)\n");
});

test("nested lists, and ordered lists that start elsewhere", () => {
  const md = M.fromTree(h("div", {},
    h("ul", {}, h("li", {}, "one"), h("li", {}, "two", h("ul", {}, h("li", {}, "two a"), h("li", {}, "two b")))),
    h("ol", { start: "3" }, h("li", {}, "three"), h("li", {}, h("p", {}, "four")))));
  assert.equal(md, "- one\n- two\n\n  - two a\n  - two b\n\n3. three\n4. four\n");
});

test("code blocks keep their text exactly and get a long enough fence", () => {
  const md = M.fromTree(h("pre", {}, h("code", {}, "a *b*\n  ```\nc")));
  assert.equal(md, "````\na *b*\n  ```\nc\n````\n");
});

test("block quotes", () => {
  assert.equal(M.fromTree(h("blockquote", {}, h("p", {}, "one"), h("p", {}, "two"))), "> one\n>\n> two\n");
});

test("tables, with and without a header row", () => {
  const withHead = h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "A"), h("th", {}, "B"))),
    h("tbody", {}, h("tr", {}, h("td", {}, "1"), h("td", {}, "x | y"))));
  assert.equal(M.fromTree(withHead), "| A | B |\n| --- | --- |\n| 1 | x \\| y |\n");
  const noHead = h("table", {}, h("tr", {}, h("td", {}, "1"), h("td", {}, "2")), h("tr", {}, h("td", {}, "3")));
  assert.equal(M.fromTree(noHead), "|  |  |\n| --- | --- |\n| 1 | 2 |\n| 3 |  |\n");
});

test("loose text between blocks becomes its own paragraph", () => {
  assert.equal(M.fromTree(h("div", {}, "loose ", h("em", {}, "text"), h("p", {}, "para"), "tail")), "loose *text*\n\npara\n\ntail\n");
});

test("line breaks", () => {
  assert.equal(M.fromTree(h("p", {}, "one", h("br", {}), "two")), "one  \ntwo\n");
});

test("note() writes front matter that survives awkward titles", () => {
  const note = M.note(h("p", {}, "Body."), {
    title: 'He said "hi" \\ and\nleft', url: "https://example.com/?a=1&b=2", savedIso: "2026-11-12T04:10:00-06:00", selectionOnly: true,
  });
  assert.equal(note, [
    "---",
    'title: "He said \\"hi\\" \\\\ and left"',
    'source: "https://example.com/?a=1&b=2"',
    "saved: 2026-11-12T04:10:00-06:00",
    "selection: true",
    "---",
    '# He said "hi" \\\\ and left',
    "",
    "Body.",
    "",
  ].join("\n"));
});
