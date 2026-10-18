// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { checkMarkdown } from "../src/markdown.js";

const item = { isDescription: false, isTextBundle: false };
const rules = (text: string, context = item) =>
  checkMarkdown(text, context).findings.map((finding) => finding.rule);

describe("checkMarkdown", () => {
  it("accepts the whole permitted profile", () => {
    const text = [
      "Text with **strong**, _emphasis_, and `code`.",
      "",
      "- a list",
      "  1. nested",
      "",
      "> a quote",
      "",
      "```html",
      "<script>alert(1)</script>",
      "```",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "[a link](https://example.org) and <https://example.org/auto>, &lt;b&gt;, \\<b>",
      "",
      "![a diagram](assets/diagram.png)",
    ].join("\n");
    expect(rules(text)).toEqual([]);
  });

  it("finds raw HTML, inline or block (OWM-MD-003)", () => {
    expect(rules("Hello <b>there</b>")).toContain("OWM-MD-003");
    expect(rules("<div>\nblock\n</div>")).toContain("OWM-MD-003");
    expect(rules("<!-- a comment -->")).toContain("OWM-MD-003");
  });

  it("allows headings only in the description, up to level 3 (OWM-MD-007, OWM-MD-008)", () => {
    expect(rules("# Title")).toEqual(["OWM-MD-007"]);
    expect(rules("Accidental\n---")).toEqual(["OWM-MD-007"]);
    expect(rules("### Fine", { ...item, isDescription: true })).toEqual([]);
    expect(rules("#### Too deep", { ...item, isDescription: true })).toEqual(["OWM-MD-008"]);
  });

  it("allows only https links, including through references (OWM-LINK-001)", () => {
    expect(rules("[x](http://example.org)")).toEqual(["OWM-LINK-001"]);
    expect(rules("[x][r]\n\n[r]: javascript:alert(1)")).toEqual(["OWM-LINK-001"]);
    expect(rules("<mailto:me@example.org>")).toEqual(["OWM-LINK-001"]);
    expect(rules("Bare https://example.org stays text")).toEqual([]);
  });

  it("allows only bundle images (OWM-MD-009, OWM-TEXT-002)", () => {
    expect(rules("![x](https://example.org/p.png)")).toEqual(["OWM-MD-009"]);
    expect(rules("![x](assets/../a.png)")).toEqual(["OWM-MD-009"]);
    expect(rules("![x](assets/a.png)", { ...item, isTextBundle: true })).toEqual(["OWM-TEXT-002"]);
  });

  it("limits nesting to 8 levels (OWM-MD-006)", () => {
    expect(rules(`${"> ".repeat(8)}ok`)).toEqual([]);
    expect(rules(`${"> ".repeat(9)}too deep`)).toEqual(["OWM-MD-006"]);
  });

  it("collects image references with their alt text", () => {
    expect(checkMarkdown("![A chart](assets/c.webp) and ![](assets/d.png)", item).images).toEqual([
      { src: "assets/c.webp", alt: "A chart" },
      { src: "assets/d.png", alt: "" },
    ]);
  });
});
