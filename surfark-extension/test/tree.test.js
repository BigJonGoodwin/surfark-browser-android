"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../src/lib/tree.js");
const { dom } = require("./helpers.js");

const BASE = "https://example.com/dir/page.html";

test("safeUrl lets web addresses through and resolves relative ones", () => {
  assert.equal(T.safeUrl("../a?b=1", BASE, false), "https://example.com/a?b=1");
  assert.equal(T.safeUrl("http://x.test/", BASE, false), "http://x.test/");
});

test("safeUrl refuses anything that is not http(s)", () => {
  for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "vbscript:x", "", null]) {
    assert.equal(T.safeUrl(bad, BASE, false), null, String(bad));
  }
});

test("safeUrl allows inline pictures only where asked, and never SVG", () => {
  const png = "data:image/png;base64,AAAA";
  assert.equal(T.safeUrl(png, BASE, true), png);
  assert.equal(T.safeUrl(png, BASE, false), null);
  assert.equal(T.safeUrl("data:image/svg+xml;base64,AAAA", BASE, true), null);
});

test("fromDom drops scripts, hidden parts and page furniture, with everything inside them", () => {
  const tree = T.fromDom(dom("body", {},
    dom("nav", {}, dom("a", { href: "/home" }, "Home")),
    dom("script", {}, "alert(1)"),
    dom("p", { hidden: "" }, "hidden"),
    dom("p", { "aria-hidden": "true" }, "also hidden"),
    dom("p", {}, "kept")), BASE);
  assert.equal(T.cleanText(tree), "kept");
});

test("fromDom unwraps unknown tags but keeps their text", () => {
  const tree = T.fromDom(dom("div", {}, dom("custom-thing", { onclick: "x()" }, dom("font", {}, "inside"))), BASE);
  assert.deepEqual(tree, { tag: "div", attrs: {}, children: [{ text: "inside" }] });
});

test("fromDom keeps only safe attributes", () => {
  const tree = T.fromDom(dom("div", {},
    dom("a", { href: "javascript:x()", onclick: "x()", style: "color:red" }, "bad link"),
    dom("a", { href: "next.html", class: "c" }, "good link"),
    dom("img", { src: "pic.png", alt: "A picture", onerror: "x()" }),
    dom("img", { src: "javascript:x()" })), BASE);
  assert.deepEqual(tree.children[0], { tag: "a", attrs: {}, children: [{ text: "bad link" }] });
  assert.deepEqual(tree.children[1].attrs, { href: "https://example.com/dir/next.html" });
  assert.deepEqual(tree.children[2].attrs, { src: "https://example.com/dir/pic.png", alt: "A picture" });
  assert.equal(tree.children.length, 3, "the image with a script address is dropped");
});

test("fromDom honours the isHidden callback", () => {
  const secret = dom("p", { id: "x" }, "secret");
  const tree = T.fromDom(dom("div", {}, secret, dom("p", {}, "shown")), BASE, (e) => e === secret);
  assert.equal(T.cleanText(tree), "shown");
});
