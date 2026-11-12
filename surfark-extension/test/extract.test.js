"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/lib/extract.js");
const T = require("../src/lib/tree.js");
const { h, lorem } = require("./helpers.js");

function page() {
  const article = h("article", {},
    h("h1", {}, "The real headline"),
    h("p", {}, lorem(4)), h("p", {}, lorem(5)), h("p", {}, lorem(3)));
  const linkList = h("div", {}, h("ul", {},
    ...Array.from({ length: 30 }, (_, i) => h("li", {}, h("a", { href: "https://example.com/" + i }, "Related story number " + i + " with a longer title")))));
  const comments = h("section", {}, h("p", {}, "Short comment."), h("p", {}, "Another one."));
  return { tree: h("div", {}, h("div", {}, linkList, article, comments)), article };
}

test("findMain picks the article, not its wrapper or the link list", () => {
  const { tree, article } = page();
  assert.equal(E.findMain(tree), article);
});

test("link lists score far below prose of the same length", () => {
  const prose = h("div", {}, h("p", {}, lorem(6)));
  const links = h("div", {}, h("p", {}, h("a", { href: "https://example.com" }, lorem(6))));
  assert.ok(E.score(prose) > E.score(links) * 5);
});

test("a page with no clear article is returned whole", () => {
  const tree = h("div", {}, h("p", {}, "Tiny."), h("p", {}, "Page."));
  assert.equal(E.findMain(tree), tree);
});

test("an article split into sections is kept together", () => {
  const sections = [1, 2, 3].map(() => h("section", {}, h("p", {}, lorem(4)), h("p", {}, lorem(4))));
  const article = h("article", {}, ...sections);
  assert.equal(E.findMain(h("div", {}, article)), article);
});

test("article() takes the title from the h1 and does not repeat it in the content", () => {
  const { tree } = page();
  const found = E.article(tree, "The real headline | Example Site");
  assert.equal(found.title, "The real headline");
  assert.ok(!T.cleanText(found.content).startsWith("The real headline"));
  assert.ok(T.cleanText(found.content).startsWith("Sentence number 1"));
});

test("article() falls back to the tab title, then to Untitled", () => {
  const body = h("div", {}, h("p", {}, lorem(5)));
  assert.equal(E.article(body, "  Tab   title ").title, "Tab title");
  assert.equal(E.article(h("div", {}, h("p", {}, lorem(5))), "").title, "Untitled");
});

test("a heading that is not the first thing in the content is left alone", () => {
  const content = h("article", {}, h("p", {}, lorem(4)), h("h1", {}, "Late heading"), h("p", {}, lorem(4)));
  const found = E.article(h("div", {}, content), "x");
  assert.equal(found.title, "Late heading");
  assert.ok(T.cleanText(found.content).includes("Late heading"));
});
