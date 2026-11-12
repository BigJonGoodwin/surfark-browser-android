/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Surfark Companion: turns the plain content tree (see tree.js) into markdown for notes.
// Output is plain CommonMark plus pipe tables, which Obsidian reads as is.

(function (root) {
  "use strict";
  const T = (typeof module !== "undefined" && module.exports) ? require("./tree.js") : root.Surfark.tree;

  function escapeText(s) {
    return s.replace(/([\\`*_\[\]<>])/g, "\\$1");
  }
  // Keeps one space where the source had whitespace; trims nothing (callers trim blocks).
  function squash(s) {
    return s.replace(/\s+/g, " ");
  }
  function wrapMark(mark, inner) {
    const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
  }
  function linkTarget(url) {
    // Brackets and spaces would end the link early in markdown.
    return url.replace(/[()\s]/g, (c) => (c === "(" ? "%28" : c === ")" ? "%29" : "%20"));
  }

  function inline(node) {
    if (node.text !== undefined) return escapeText(squash(node.text));
    const inner = () => node.children.map(inline).join("");
    switch (node.tag) {
      case "br": return "  \n";
      case "strong": case "b": return wrapMark("**", inner());
      case "em": case "i": case "cite": return wrapMark("*", inner());
      case "del": case "s": return wrapMark("~~", inner());
      case "mark": return wrapMark("==", inner());
      case "code": case "kbd": {
        const raw = T.textOf(node).replace(/\s+/g, " ");
        if (!raw.trim()) return "";
        const fence = raw.includes("`") ? "``" : "`";
        return fence + (raw.includes("`") ? " " + raw + " " : raw) + fence;
      }
      case "a": {
        const label = inner().trim();
        if (!node.attrs.href) return label;
        return label ? "[" + label + "](" + linkTarget(node.attrs.href) + ")" : "";
      }
      case "img": {
        if (node.attrs.src.startsWith("data:")) return node.attrs.alt ? "(image: " + escapeText(node.attrs.alt) + ")" : "";
        return "![" + escapeText(node.attrs.alt || "") + "](" + linkTarget(node.attrs.src) + ")";
      }
      default: return inner();
    }
  }

  function indent(textBlock, pad) {
    return textBlock.split("\n").map((l, i) => (i === 0 || !l ? l : pad + l)).join("\n");
  }

  function list(node, ordered) {
    let n = ordered ? parseInt(node.attrs.start || "1", 10) : 0;
    const items = [];
    for (const child of node.children) {
      if (!child.tag) continue;
      if (child.tag !== "li") { // stray content inside a list: keep it as its own item
        const stray = blocks([child]).trim();
        if (stray) items.push("- " + indent(stray, "  "));
        continue;
      }
      const marker = ordered ? (n++) + ". " : "- ";
      const body = blocks(child.children).trim();
      if (body) items.push(marker + indent(body, " ".repeat(marker.length)));
    }
    return items.join("\n");
  }

  function table(node) {
    const rows = [];
    T.walk(node, (n) => {
      if (n.tag !== "tr") return;
      const cells = n.children.filter((c) => c.tag === "td" || c.tag === "th");
      if (cells.length) rows.push({ header: cells.every((c) => c.tag === "th"), cells });
    });
    if (!rows.length) return "";
    const width = Math.max(...rows.map((r) => r.cells.length));
    const cellText = (c) => blocks(c.children).trim().replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|");
    const line = (r) => {
      const out = r.cells.map(cellText);
      while (out.length < width) out.push("");
      return "| " + out.join(" | ") + " |";
    };
    const out = [];
    const first = rows[0].header ? rows.shift() : { cells: [] };
    out.push(line(first));
    out.push("| " + Array(width).fill("---").join(" | ") + " |");
    for (const r of rows) out.push(line(r));
    return out.join("\n");
  }

  function block(node) {
    switch (node.tag) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const t = node.children.map(inline).join("").replace(/\s+/g, " ").trim();
        return t ? "#".repeat(Number(node.tag[1])) + " " + t : "";
      }
      case "p": case "figcaption": case "dt": case "dd": case "caption":
        return node.children.map(inline).join("").replace(/[ \t]+\n/g, (m) => (m.length > 2 ? "  \n" : "\n")).trim();
      case "hr": return "---";
      case "pre": {
        const code = T.textOf(node).replace(/\n+$/, "");
        let fence = "```";
        while (code.includes(fence)) fence += "`";
        return fence + "\n" + code + "\n" + fence;
      }
      case "blockquote": {
        const body = blocks(node.children).trim();
        return body ? body.split("\n").map((l) => (l ? "> " + l : ">")).join("\n") : "";
      }
      case "ul": return list(node, false);
      case "ol": return list(node, true);
      case "table": return table(node);
      default: return blocks(node.children).trim();
    }
  }

  // A run of nodes: inline pieces are gathered into paragraphs, block pieces stand alone.
  function blocks(nodes) {
    const out = [];
    let run = "";
    const flush = () => {
      const t = run.trim();
      if (t) out.push(t);
      run = "";
    };
    for (const n of nodes) {
      if (n.tag && T.BLOCK.has(n.tag)) {
        flush();
        const b = block(n);
        if (b) out.push(b);
      } else {
        run += inline(n);
      }
    }
    flush();
    return out.join("\n\n");
  }

  function fromTree(node) {
    const md = node.tag && T.BLOCK.has(node.tag) ? block(node) : blocks([node]);
    return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function yamlString(s) {
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim() + '"';
  }

  // The whole note: front matter, title, body.
  // meta: { title, url, savedIso, selectionOnly }
  function note(contentTree, meta) {
    const head = [
      "---",
      "title: " + yamlString(meta.title),
      "source: " + yamlString(meta.url),
      "saved: " + meta.savedIso,
    ];
    if (meta.selectionOnly) head.push("selection: true");
    head.push("---", "");
    return head.join("\n") + "# " + escapeText(String(meta.title).replace(/\s+/g, " ").trim()) + "\n\n" + fromTree(contentTree);
  }

  const api = { escapeText, inline, block, blocks, fromTree, note, yamlString };
  root.Surfark = root.Surfark || {};
  root.Surfark.markdown = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
