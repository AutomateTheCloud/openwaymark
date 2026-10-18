#!/usr/bin/env node
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Fails when a British spelling appears in a tracked or new text file.
//
// Each rule is a whole-word pattern and the American spelling to use instead. The
// -ise verbs list their endings explicitly rather than matching any word that starts
// with the stem, so correct words are not caught: "organism" is not "organise",
// "realism" is not "realise", and "programmer" is not "programme". Many American
// words end in -ise too (exercise, promise, otherwise), so there is no suffix rule.
//
// To exempt text that quotes a proper name or a source verbatim, put
// `allow-british-line` on the line, or wrap a block between `allow-british` and
// `/allow-british` lines.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const IZE = "(e|ed|es|ing|ation|ations|er|ers)";
const RULES = [
  ["acknowledgements?", "acknowledgment"],
  ["analys(e|ed|ing)", "analyze"],
  ["behaviours?", "behavior"],
  ["cancell(ed|ing)", "canceled, canceling"],
  ["catalogues?", "catalog"],
  ["centres?", "center"],
  ["colour(s|ed|ful|ing)?", "color"],
  ["defences?", "defense"],
  ["favour(s|ed|ing|ite|ites)?", "favor"],
  ["grey", "gray"],
  ["honour(s|ed|ing)?", "honor"],
  ["judgements?", "judgment"],
  ["labell(ed|ing)", "labeled, labeling"],
  ["licence", "license"],
  ["modell(ed|ing)", "modeled, modeling"],
  ["neighbour(s|ing)?", "neighbor"],
  ["offences?", "offense"],
  ["programmes", "programs"],
  ["programme", "program"],
  ["signall(ed|ing)", "signaled, signaling"],
  ["travell(ed|ing)", "traveled, traveling"],
  ["whilst", "while"],
  ...[
    "authoris",
    "categoris",
    "customis",
    "finalis",
    "initialis",
    "maximis",
    "minimis",
    "normalis",
    "optimis",
    "organis",
    "prioritis",
    "realis",
    "recognis",
    "sanitis",
    "serialis",
    "standardis",
    "summaris",
    "synchronis",
    "utilis",
    "visualis",
  ].map((stem) => [`${stem}${IZE}`, `${stem.slice(0, -1)}z…`]),
];

const TEXT_FILE = /\.(md|txt|ts|tsx|js|mjs|cjs|json|ya?ml|html|css)$/i;
const THIS_FILE = "tools/check-american.mjs";
const PATTERNS = RULES.map(([source, american]) => [new RegExp(`\\b${source}\\b`, "gi"), american]);

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => path !== "" && path !== THIS_FILE && TEXT_FILE.test(path));

const problems = [];
for (const path of files) {
  let exempt = false;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (line.includes("allow-british-line")) return;
      if (line.includes("/allow-british")) {
        exempt = false;
        return;
      }
      if (line.includes("allow-british")) {
        exempt = true;
        return;
      }
      if (exempt) return;
      for (const [pattern, american] of PATTERNS) {
        for (const match of line.matchAll(pattern)) {
          problems.push(`${path}:${index + 1}: "${match[0]}" (American: ${american})`);
        }
      }
    });
}

if (problems.length > 0) {
  console.error(`British spellings found (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`American English check passed (${files.length} files).`);
