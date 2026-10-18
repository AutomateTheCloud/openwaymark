#!/usr/bin/env node
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Checks the rule identifiers in spec/openwaymark.md:
//
// - every paragraph, list item, or table row that uses a BCP 14 keyword in
//   capitals is a rule, which means it starts with a bold identifier such as
//   **OWM-PKG-001.**;
// - each identifier is defined once;
// - every identifier mentioned anywhere is defined (rules, or rows of the lint
//   table in Appendix A).
//
// Fenced code blocks are skipped. So is any region between `<!-- rules:off -->`
// and `<!-- rules:on -->`, which the conventions section uses to quote the
// keywords themselves.

import { readFileSync } from "node:fs";

const SPEC = process.argv[2] ?? "spec/openwaymark.md";
const KEYWORD =
  /\b(MUST NOT|MUST|REQUIRED|SHALL NOT|SHALL|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|MAY|OPTIONAL)\b/;
const RULE_START = /^- \*\*(OWM-[A-Z]+-\d{3})\.\*\*/;
const LINT_ROW = /^\| (OWM-LINT-\d{3}) \|/;
// Rows of Appendix D: retired identifiers are defined there, so mentions of
// them resolve, and they can never be defined again as rules.
const RETIRED_ROW = /^\| (OWM-[A-Z]+-\d{3}) \| Retired/;
const ID_MENTION = /\bOWM-[A-Z]+-\d{3}\b/g;

const lines = readFileSync(SPEC, "utf8").split("\n");

// Split the document into units: list items (with their continuation lines),
// table rows, and paragraphs. Each unit remembers its first line number.
const units = [];
let current = null;
let lastItem = null; // the most recent list item, which indented text continues
let inFence = false;
let rulesOff = false;
const flush = () => {
  if (current) units.push(current);
  current = null;
};
lines.forEach((line, index) => {
  const number = index + 1;
  if (/^\s*(```|~~~)/.test(line)) {
    inFence = !inFence;
    flush();
    return;
  }
  if (inFence) return;
  if (line.includes("<!-- rules:off -->")) {
    rulesOff = true;
    flush();
    return;
  }
  if (line.includes("<!-- rules:on -->")) {
    rulesOff = false;
    return;
  }
  if (rulesOff) return;
  if (line.trim() === "") {
    flush();
    return;
  }
  const startsItem = /^(-|\d+\.) /.test(line);
  const isTableRow = line.startsWith("|");
  if (current === null && lastItem && /^\s{2,}\S/.test(line)) {
    // An indented paragraph after a blank line still belongs to the list item.
    lastItem.text += `\n${line}`;
    return;
  }
  if (startsItem || isTableRow || current === null || current.table) {
    flush();
    current = { line: number, text: line, table: isTableRow };
    lastItem = startsItem ? current : null;
  } else {
    current.text += `\n${line}`;
  }
});
flush();

const problems = [];
const defined = new Map();
for (const unit of units) {
  const rule =
    RULE_START.exec(unit.text)?.[1] ??
    LINT_ROW.exec(unit.text)?.[1] ??
    RETIRED_ROW.exec(unit.text)?.[1];
  if (rule) {
    if (defined.has(rule)) {
      problems.push(
        `${SPEC}:${unit.line}: ${rule} is defined again (first at line ${defined.get(rule)})`,
      );
    } else {
      defined.set(rule, unit.line);
    }
  }
  const keyword = KEYWORD.exec(unit.text);
  if (keyword && !RULE_START.test(unit.text)) {
    problems.push(`${SPEC}:${unit.line}: "${keyword[1]}" outside a numbered rule`);
  }
}

lines.forEach((line, index) => {
  for (const [mention] of line.matchAll(ID_MENTION)) {
    if (!defined.has(mention)) problems.push(`${SPEC}:${index + 1}: ${mention} is not defined`);
  }
});

if (problems.length > 0) {
  console.error(`Specification rule check failed (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Specification rule check passed (${defined.size} identifiers).`);
