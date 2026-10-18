// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Recommended lint checks (spec Appendix A). They run only on bundles whose
// structure is valid, report warnings, and never affect conformance.

import type { ImageInfo } from "./images.js";
import type { ImageReference } from "./manifest.js";
import type { ReportBuilder } from "./report.js";
import { pointerJoin, type Mapping, type ParsedManifest, type Value } from "./yaml.js";

const ORDER_DEPENDENT =
  /\b(all|none|neither|both) of the (above|below|preceding|following)\b|\bboth [a-z] and [a-z]\b|\b(options?|choices?|answers?) [a-z](,? (and|or) [a-z])+\b/i;
const GENERIC_ALT = new Set([
  "image",
  "picture",
  "photo",
  "diagram",
  "figure",
  "graphic",
  "chart",
  "img",
  "screenshot",
  "icon",
]);
const BIDI_CONTROL = /[‪-‮⁦-⁩]/;

export interface LintInput {
  parsed: ParsedManifest;
  images: ImageReference[];
  assetInfo: ReadonlyMap<string, ImageInfo>;
  assets: ReadonlySet<string>;
  ignorableEntries: readonly string[];
  descriptionSetextHeadings: number;
  entry: string | undefined;
}

const list = (value: Value | undefined): Mapping[] =>
  Array.isArray(value)
    ? value.filter((item): item is Mapping => typeof item === "object" && !Array.isArray(item))
    : [];

const idOf = (item: Mapping): string => (typeof item.id === "string" ? item.id : "(no id)");

export function lintBundle(input: LintInput, report: ReportBuilder): void {
  const { parsed, entry } = input;
  const root = parsed.root;
  const warn = (rule: string, pointer: string | undefined, message: string, entryName = entry) => {
    const where = pointer === undefined ? undefined : parsed.positions.get(pointer);
    report.add(rule, message, {
      ...(entryName !== undefined ? { entry: entryName } : {}),
      ...(pointer !== undefined ? { pointer } : {}),
      ...(where ? { line: where.line, column: where.column } : {}),
    });
  };

  list(root.questions).forEach((question, index) => {
    const pointer = pointerJoin("/questions", index);
    const choices = list(question.choices);
    const correct = Array.isArray(question.correct_answers) ? question.correct_answers : [];
    if (
      question.explanation === undefined &&
      choices.every((choice) => choice.explanation === undefined)
    ) {
      warn("OWM-LINT-001", pointer, `Question "${idOf(question)}" has no explanation.`);
    }
    const seen = new Map<string, number>();
    choices.forEach((choice, choiceIndex) => {
      if (typeof choice.text !== "string") return;
      const key = choice.text.trim().toLowerCase();
      if (seen.has(key))
        warn(
          "OWM-LINT-003",
          pointerJoin(pointerJoin(pointer, "choices"), choiceIndex),
          `Two choices in "${idOf(question)}" have the same text.`,
        );
      seen.set(key, choiceIndex);
      if (question.shuffle_choices !== false && ORDER_DEPENDENT.test(choice.text)) {
        warn(
          "OWM-LINT-004",
          pointerJoin(pointerJoin(pointer, "choices"), choiceIndex),
          `"${choice.text}" refers to other choices, but shuffling is allowed. Set shuffle_choices: false if order matters.`,
        );
      }
    });
    if (
      question.selection === "multiple" &&
      choices.length > 0 &&
      correct.length === choices.length
    ) {
      warn("OWM-LINT-006", pointer, `Every choice in "${idOf(question)}" is correct.`);
    }
    if (choices.length > 8)
      warn(
        "OWM-LINT-007",
        pointerJoin(pointer, "choices"),
        `"${idOf(question)}" has ${choices.length} choices.`,
      );
    if (
      question.selection === "multiple" &&
      correct.length === 1 &&
      question.selection_count === undefined
    ) {
      warn(
        "OWM-LINT-015",
        pointer,
        `"${idOf(question)}" allows several answers but has exactly one correct answer and no selection_count. Check that this is intended.`,
      );
    }
  });

  for (const image of input.images) {
    const fileName = image.src.split("/").pop() ?? "";
    const alt = image.alt.trim().toLowerCase();
    if (alt === "") {
      if (image.role === "prompt" || image.role === "choice") {
        warn(
          "OWM-LINT-008",
          image.pointer,
          `The ${image.role} image ${image.src} has empty alt text, so it is marked decorative.`,
        );
      }
    } else if (
      alt === fileName.toLowerCase() ||
      alt === fileName.replace(/\.[a-z]+$/, "").toLowerCase() ||
      GENERIC_ALT.has(alt.replace(/[.!]$/, ""))
    ) {
      warn(
        "OWM-LINT-002",
        image.pointer,
        `The alt text "${image.alt}" for ${image.src} does not describe the image.`,
      );
    }
  }

  const referenced = new Set(input.images.map((image) => image.src));
  for (const asset of input.assets) {
    if (!referenced.has(asset))
      warn("OWM-LINT-005", undefined, `The asset ${asset} is not referenced.`, asset);
  }
  for (const [asset, info] of input.assetInfo) {
    if (info.hasGps)
      warn(
        "OWM-LINT-013",
        undefined,
        `${asset} carries GPS location data. Remove the image metadata before sharing.`,
        asset,
      );
    if (info.orientation !== undefined && info.orientation !== 1) {
      warn(
        "OWM-LINT-014",
        undefined,
        `${asset} has Exif orientation ${info.orientation}. Store the image upright instead.`,
        asset,
      );
    }
  }

  if (
    typeof root.created === "string" &&
    typeof root.updated === "string" &&
    root.updated < root.created
  ) {
    warn("OWM-LINT-009", "/updated", "updated is earlier than created.");
  }
  if (root.license === undefined)
    warn("OWM-LINT-010", "", "The bundle has no license, so nobody may assume they can share it.");

  const visitText = (value: Value, pointer: string) => {
    if (typeof value === "string") {
      if (BIDI_CONTROL.test(value))
        warn(
          "OWM-LINT-011",
          pointer,
          "The text contains bidirectional control characters, which can make it display differently from how it reads.",
        );
    } else if (Array.isArray(value)) {
      value.forEach((child, index) => {
        visitText(child, pointerJoin(pointer, index));
      });
    } else if (typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key !== "extensions") visitText(child, pointerJoin(pointer, key));
      }
    }
  };
  visitText(root, "");

  for (const scalar of parsed.ambiguousScalars) {
    warn(
      "OWM-LINT-012",
      scalar.pointer,
      `The unquoted value ${scalar.source} is read differently by YAML 1.1 tools. Put it in quotes.`,
    );
  }
  for (const name of input.ignorableEntries) {
    warn(
      "OWM-LINT-016",
      undefined,
      `${name} is operating-system metadata. Readers ignore it; leave it out of the archive.`,
      name,
    );
  }
  if (input.descriptionSetextHeadings > 0) {
    warn(
      "OWM-LINT-017",
      "/description",
      "The description contains a heading underlined with '-' or '='. Check that a paragraph did not become a heading by accident.",
    );
  }
}
