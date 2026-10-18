// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The Markdown profile (spec sections 9.3 to 9.6): CommonMark 0.31.2 with the
// GFM table extension only. Text is parsed into a syntax tree and checked for
// prohibited constructs. The same tree is what a reader renders, so a reader
// that renders only the node types allowed here never interprets HTML.

import type { Nodes, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";
import { LIMITS } from "./limits.js";
import { assetPathProblem } from "./paths.js";
import { urlProblem } from "./syntax.js";

export interface MarkdownFinding {
  rule: string;
  message: string;
}

export interface MarkdownContext {
  /** Whether headings are permitted: only in the collection description. */
  isDescription: boolean;
  /** Whether the bundle is a text bundle, which may reference no assets. */
  isTextBundle: boolean;
}

export interface MarkdownResult {
  findings: MarkdownFinding[];
  /** Asset paths referenced by images, in order. */
  images: { src: string; alt: string }[];
  /** Whether a heading spans two lines, the mark of a setext heading (OWM-LINT-017). */
  setextHeadings: number;
}

/** Parses profile Markdown into a syntax tree. */
export function parseMarkdown(text: string): Root {
  return fromMarkdown(text, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()],
  });
}

const NESTING_TYPES = new Set(["blockquote", "list"]);

export function checkMarkdown(text: string, context: MarkdownContext): MarkdownResult {
  const tree = parseMarkdown(text);
  const findings: MarkdownFinding[] = [];
  const images: { src: string; alt: string }[] = [];
  let setextHeadings = 0;
  const definitions = new Map<string, string>();
  const visitDefinitions = (node: Nodes) => {
    if (node.type === "definition") definitions.set(node.identifier, node.url);
    if ("children" in node) node.children.forEach(visitDefinitions);
  };
  visitDefinitions(tree);

  const image = (url: string, alt: string) => {
    if (context.isTextBundle) {
      findings.push({
        rule: "OWM-TEXT-002",
        message: `A text bundle cannot contain images, but this text includes ![${alt}](${url}).`,
      });
      return;
    }
    const problem = assetPathProblem(url);
    if (problem)
      findings.push({
        rule: "OWM-MD-009",
        message: `The image ${url} ${problem}. Markdown images must name an asset in the bundle.`,
      });
    else images.push({ src: url, alt });
  };
  const link = (url: string) => {
    const problem = urlProblem(url);
    if (problem)
      findings.push({ rule: "OWM-LINK-001", message: `The link ${url || "(empty)"} ${problem}.` });
  };

  const visit = (node: Nodes, nesting: number) => {
    const depth = NESTING_TYPES.has(node.type) ? nesting + 1 : nesting;
    if (
      depth > LIMITS.markdownNesting &&
      NESTING_TYPES.has(node.type) &&
      nesting === LIMITS.markdownNesting
    ) {
      findings.push({
        rule: "OWM-MD-006",
        message: `Lists and block quotes are nested more than ${LIMITS.markdownNesting} levels deep.`,
      });
    }
    switch (node.type) {
      case "html":
        findings.push({
          rule: "OWM-MD-003",
          message: `Raw HTML is not permitted: ${node.value.slice(0, 60)}. To show it as text, put it in backticks.`,
        });
        break;
      case "heading": {
        const spansLines = node.position && node.position.end.line > node.position.start.line;
        if (spansLines) setextHeadings++;
        if (!context.isDescription) {
          findings.push({
            rule: "OWM-MD-007",
            message: spansLines
              ? "Headings are not permitted here. A line of '-' or '=' directly under text makes it a heading; add a blank line before the line."
              : "Headings are not permitted outside the collection description.",
          });
        } else if (node.depth > 3) {
          findings.push({
            rule: "OWM-MD-008",
            message: `Description headings may use levels 1 to 3; this one is level ${node.depth}.`,
          });
        }
        break;
      }
      case "link":
        link(node.url);
        break;
      case "linkReference":
        link(definitions.get(node.identifier) ?? "");
        break;
      case "image":
        image(node.url, node.alt ?? "");
        break;
      case "imageReference":
        image(definitions.get(node.identifier) ?? "", node.alt ?? "");
        break;
      default:
        break;
    }
    if ("children" in node) {
      for (const child of node.children) visit(child, depth);
    }
  };
  visit(tree, 0);
  return { findings, images, setextHeadings };
}
