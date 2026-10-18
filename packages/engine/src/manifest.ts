// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Structural and cross-reference validation of the manifest data model
// (spec sections 5 to 10). Each problem is reported against the most specific
// rule, with a JSON Pointer and the source position of the value.

import { LIMITS } from "./limits.js";
import { checkMarkdown } from "./markdown.js";
import { assetPathProblem } from "./paths.js";
import type { ReportBuilder } from "./report.js";
import {
  isValidDate,
  isValidSpdxExpression,
  isWellFormedLanguageTag,
  urlProblem,
} from "./syntax.js";
import { utf8Length } from "./bytes.js";
import { pointerJoin, type Mapping, type ParsedManifest, type Value } from "./yaml.js";

export const SUPPORTED_FORMAT_VERSIONS = ["0.1"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const ITEM_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FEATURE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAMESPACE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;
const FORMAT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export type ImageRole =
  "prompt" | "choice" | "front" | "back" | "hint" | "explanation" | "description";

export interface ImageReference {
  src: string;
  alt: string;
  pointer: string;
  role: ImageRole;
  /** An image object (which can carry a credit) or a Markdown image. */
  kind: "object" | "markdown";
}

export interface ManifestFindings {
  /** False when the format version is unsupported, so nothing else was checked. */
  checked: boolean;
  images: ImageReference[];
  descriptionSetextHeadings: number;
  questions: number;
  flashcards: number;
}

export interface ManifestContext {
  isTextBundle: boolean;
  /** Asset paths present in the bundle. */
  assets: ReadonlySet<string>;
}

const isMapping = (value: Value | undefined): value is Mapping =>
  typeof value === "object" && !Array.isArray(value);

function describeType(value: Value): string {
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "a mapping";
  if (typeof value === "string") return "text";
  return typeof value === "number" ? `the number ${String(value)}` : `the boolean ${String(value)}`;
}

/** Capitalizes the first letter, so a message built from a phrase reads as a sentence. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function codePoints(text: string): number {
  return Array.from(text).length;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

export function validateManifest(
  parsed: ParsedManifest,
  context: ManifestContext,
  report: ReportBuilder,
  entry: string | undefined,
): ManifestFindings {
  const findings: ManifestFindings = {
    checked: true,
    images: [],
    descriptionSetextHeadings: 0,
    questions: 0,
    flashcards: 0,
  };
  const err = (rule: string, pointer: string, message: string, useKey = false) => {
    const where =
      (useKey ? parsed.keyPositions.get(pointer) : undefined) ??
      parsed.positions.get(pointer) ??
      parsed.keyPositions.get(pointer);
    report.add(rule, message, {
      ...(entry !== undefined ? { entry } : {}),
      pointer,
      ...(where ? { line: where.line, column: where.column } : {}),
    });
  };

  /** Checks members: unknown ones (OWM-VER-004) and missing required ones. */
  const members = (
    map: Mapping,
    pointer: string,
    allowed: readonly string[],
    required: Record<string, string>,
    what: string,
  ) => {
    for (const key of Object.keys(map)) {
      if (allowed.includes(key)) continue;
      const suggestion = allowed.find((candidate) => editDistance(key, candidate) <= 2);
      err(
        "OWM-VER-004",
        pointerJoin(pointer, key),
        `Unknown member "${key}" in ${what}.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
        true,
      );
    }
    for (const [key, rule] of Object.entries(required)) {
      if (!(key in map))
        err(rule, pointer, `${sentence(what)} is missing the required member "${key}".`);
    }
  };

  const string = (
    value: Value | undefined,
    pointer: string,
    name: string,
    options: { rule: string; max?: number; allowEmpty?: boolean },
  ) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      err(
        "OWM-YAML-006",
        pointer,
        `${name} must be text, not ${describeType(value)}. Put it in quotes.`,
      );
      return undefined;
    }
    if (!(options.allowEmpty && value === "") && !/\S/.test(value)) {
      err("OWM-YAML-010", pointer, `${name} must not be blank.`);
      return undefined;
    }
    if (options.max !== undefined && codePoints(value) > options.max) {
      err(options.rule, pointer, `${name} is longer than ${options.max} characters.`);
    }
    return value;
  };

  const sequence = (
    value: Value | undefined,
    pointer: string,
    name: string,
    max: number | undefined,
    maxRule: string,
  ) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      err("OWM-VER-007", pointer, `${name} must be a list, not ${describeType(value)}.`);
      return undefined;
    }
    if (value.length === 0) {
      err(
        "OWM-COL-016",
        pointer,
        `${name} must not be an empty list. Leave the member out instead.`,
      );
      return undefined;
    }
    if (max !== undefined && value.length > max)
      err(maxRule, pointer, `${name} has ${value.length} entries; at most ${max} are permitted.`);
    return value;
  };

  const mapping = (value: Value | undefined, pointer: string, name: string) => {
    if (value === undefined) return undefined;
    if (!isMapping(value)) {
      err(
        "OWM-VER-007",
        pointer,
        `${name} must be a mapping of members, not ${describeType(value)}.`,
      );
      return undefined;
    }
    return value;
  };

  const url = (value: Value | undefined, pointer: string, name: string) => {
    const text = string(value, pointer, name, { rule: "OWM-LINK-001" });
    if (text === undefined) return;
    const problem = urlProblem(text);
    if (problem) err("OWM-LINK-001", pointer, `${name} ${problem}.`);
  };

  const tags = (value: Value | undefined, pointer: string, max: number) => {
    const list = sequence(value, pointer, "tags", max, "OWM-ITEM-004");
    if (!list) return;
    const seen = new Set<string>();
    list.forEach((tag, index) => {
      const at = pointerJoin(pointer, index);
      const text = string(tag, at, "A tag", { rule: "OWM-ITEM-004", max: LIMITS.tagChars });
      if (text === undefined) return;
      if (!TAG.test(text))
        err(
          "OWM-ITEM-004",
          at,
          `The tag "${text}" must be lowercase letters and digits, joined by single hyphens, such as "record-types".`,
        );
      if (seen.has(text)) err("OWM-ITEM-004", at, `The tag "${text}" appears twice.`);
      seen.add(text);
    });
  };

  const references = (value: Value | undefined, pointer: string, name: string, max: number) => {
    const list = sequence(value, pointer, name, max, "OWM-ITEM-006");
    list?.forEach((entryValue, index) => {
      const at = pointerJoin(pointer, index);
      const reference = mapping(entryValue, at, `Each entry in ${name}`);
      if (!reference) return;
      members(
        reference,
        at,
        ["title", "reference", "url"],
        { title: "OWM-ITEM-006" },
        `an entry in ${name}`,
      );
      string(reference.title, pointerJoin(at, "title"), "title", {
        rule: "OWM-ITEM-006",
        max: LIMITS.referenceChars,
      });
      string(reference.reference, pointerJoin(at, "reference"), "reference", {
        rule: "OWM-ITEM-006",
        max: LIMITS.referenceChars,
      });
      url(reference.url, pointerJoin(at, "url"), "url");
    });
  };

  const extensions = (value: Value | undefined, pointer: string) => {
    const map = mapping(value, pointer, "extensions");
    if (!map) return;
    for (const key of Object.keys(map)) {
      if (!NAMESPACE.test(key)) {
        err(
          "OWM-EXT-001",
          pointerJoin(pointer, key),
          `The extension key "${key}" must be a lowercase reverse domain name, such as "com.example.feature".`,
          true,
        );
      }
    }
  };

  const markdown = (text: string, pointer: string, role: ImageRole) => {
    const result = checkMarkdown(text, {
      isDescription: role === "description",
      isTextBundle: context.isTextBundle,
    });
    for (const finding of result.findings) err(finding.rule, pointer, finding.message);
    if (role === "description") findings.descriptionSetextHeadings += result.setextHeadings;
    for (const image of result.images) {
      findings.images.push({ ...image, pointer, role, kind: "markdown" });
      if (!context.assets.has(image.src))
        err("OWM-MD-009", pointer, `The image ${image.src} is not in the bundle.`);
    }
  };

  const text = (value: Value | undefined, pointer: string, name: string, role: ImageRole) => {
    const content = string(value, pointer, name, {
      rule: role === "description" ? "OWM-MD-008" : "OWM-CONT-001",
    });
    if (content === undefined) return;
    if (utf8Length(content) > LIMITS.textBytes) {
      err(
        role === "description" ? "OWM-MD-008" : "OWM-CONT-001",
        pointer,
        `${name} is longer than ${LIMITS.textBytes} bytes.`,
      );
      return;
    }
    markdown(content, pointer, role);
  };

  const image = (value: Value | undefined, pointer: string, role: ImageRole) => {
    const object = mapping(value, pointer, "image");
    if (!object) return;
    members(
      object,
      pointer,
      ["src", "alt", "credit", "credit_url"],
      { src: "OWM-IMG-001", alt: "OWM-IMG-002" },
      "an image",
    );
    const alt = string(object.alt, pointerJoin(pointer, "alt"), "alt", {
      rule: "OWM-IMG-002",
      max: LIMITS.altChars,
      allowEmpty: true,
    });
    string(object.credit, pointerJoin(pointer, "credit"), "credit", {
      rule: "OWM-IMG-003",
      max: LIMITS.creditChars,
    });
    if ("credit_url" in object) {
      if (!("credit" in object))
        err("OWM-IMG-003", pointerJoin(pointer, "credit_url"), "credit_url requires a credit.");
      url(object.credit_url, pointerJoin(pointer, "credit_url"), "credit_url");
    }
    const srcPointer = pointerJoin(pointer, "src");
    const src = string(object.src, srcPointer, "src", { rule: "OWM-IMG-004" });
    if (src === undefined) return;
    if (context.isTextBundle) {
      err(
        "OWM-TEXT-002",
        srcPointer,
        `A text bundle cannot reference assets, but this image refers to ${src}.`,
      );
      return;
    }
    const problem = assetPathProblem(src);
    if (problem) {
      err(
        problem.includes("extension") ? "OWM-IMG-006" : "OWM-IMG-004",
        srcPointer,
        `The image path ${src} ${problem}.`,
      );
      return;
    }
    if (!context.assets.has(src))
      err("OWM-IMG-001", srcPointer, `The image ${src} is not in the bundle.`);
    findings.images.push({ src, alt: alt ?? "", pointer, role, kind: "object" });
  };

  /** The language of one part of the bundle (OWM-CONT-003). */
  const partLanguage = (value: Value | undefined, pointer: string) => {
    const tag = string(value, pointer, "language", { rule: "OWM-CONT-003" });
    if (tag !== undefined && !isWellFormedLanguageTag(tag)) {
      err(
        "OWM-CONT-003",
        pointer,
        `language "${tag}" is not a well-formed BCP 47 language tag, such as es or ar.`,
      );
    }
  };

  const content = (value: Value | undefined, pointer: string, name: string, role: ImageRole) => {
    const object = mapping(value, pointer, name);
    if (!object) return;
    members(object, pointer, ["text", "image", "language"], {}, name);
    partLanguage(object.language, pointerJoin(pointer, "language"));
    if (!("text" in object) && !("image" in object)) {
      err(
        role === "front" || role === "back" ? "OWM-CARD-001" : "OWM-CONT-001",
        pointer,
        `${name} must have text, an image, or both.`,
      );
    }
    text(object.text, pointerJoin(pointer, "text"), `${name} text`, role);
    if ("image" in object) image(object.image, pointerJoin(pointer, "image"), role);
  };

  const revision = (value: Value | undefined, pointer: string) => {
    if (value === undefined) return;
    if (typeof value !== "number" || value < 1)
      err("OWM-ITEM-001", pointer, "revision must be a whole number of at least 1.");
  };

  const itemIds = new Map<string, string>();
  const itemId = (value: Value | undefined, pointer: string) => {
    const id = string(value, pointer, "id", { rule: "OWM-ID-001" });
    if (id === undefined) return undefined;
    if (!ITEM_ID.test(id)) {
      err(
        "OWM-ID-001",
        pointer,
        `The id "${id}" must be 1 to 64 lowercase letters, digits, "-", or "_", starting with a letter or digit.`,
      );
      return id;
    }
    const first = itemIds.get(id);
    if (first !== undefined)
      err(
        "OWM-ID-002",
        pointer,
        `The id "${id}" is already used at ${first}. Questions and flashcards share one set of identifiers.`,
      );
    else itemIds.set(id, pointer);
    return id;
  };

  const question = (value: Value, pointer: string) => {
    const q = mapping(value, pointer, "Each question");
    if (!q) return;
    members(
      q,
      pointer,
      [
        "id",
        "type",
        "selection",
        "prompt",
        "choices",
        "correct_answers",
        "selection_count",
        "shuffle_choices",
        "explanation",
        "hint",
        "tags",
        "references",
        "revision",
        "extensions",
      ],
      {
        id: "OWM-ID-001",
        type: "OWM-Q-001",
        selection: "OWM-Q-002",
        prompt: "OWM-VER-007",
        choices: "OWM-Q-003",
        correct_answers: "OWM-Q-004",
      },
      `question ${typeof q.id === "string" ? `"${q.id}"` : pointer}`,
    );
    itemId(q.id, pointerJoin(pointer, "id"));
    const type = string(q.type, pointerJoin(pointer, "type"), "type", { rule: "OWM-Q-001" });
    if (type !== undefined && type !== "multiple_choice")
      err(
        "OWM-Q-001",
        pointerJoin(pointer, "type"),
        `The question type "${type}" is not defined in format 0.1; use multiple_choice.`,
      );
    const selection = string(q.selection, pointerJoin(pointer, "selection"), "selection", {
      rule: "OWM-Q-002",
    });
    if (selection !== undefined && selection !== "single" && selection !== "multiple") {
      err(
        "OWM-Q-002",
        pointerJoin(pointer, "selection"),
        `selection must be "single" or "multiple", not "${selection}".`,
      );
    }
    content(q.prompt, pointerJoin(pointer, "prompt"), "prompt", "prompt");

    const choiceIds: string[] = [];
    const choicesPointer = pointerJoin(pointer, "choices");
    const choices = sequence(q.choices, choicesPointer, "choices", undefined, "OWM-Q-003");
    if (choices && (choices.length < LIMITS.choicesMin || choices.length > LIMITS.choicesMax)) {
      err(
        "OWM-Q-003",
        choicesPointer,
        `A question needs ${LIMITS.choicesMin} to ${LIMITS.choicesMax} choices; this one has ${choices.length}.`,
      );
    }
    choices?.forEach((choiceValue, index) => {
      const at = pointerJoin(choicesPointer, index);
      const choice = mapping(choiceValue, at, "Each choice");
      if (!choice) return;
      members(
        choice,
        at,
        ["id", "text", "image", "explanation", "language", "extensions"],
        { id: "OWM-ID-003" },
        "a choice",
      );
      partLanguage(choice.language, pointerJoin(at, "language"));
      const id = string(choice.id, pointerJoin(at, "id"), "Choice id", { rule: "OWM-ID-003" });
      if (id !== undefined) {
        if (!ITEM_ID.test(id))
          err(
            "OWM-ID-003",
            pointerJoin(at, "id"),
            `The choice id "${id}" must be 1 to 64 lowercase letters, digits, "-", or "_".`,
          );
        if (choiceIds.includes(id))
          err(
            "OWM-ID-003",
            pointerJoin(at, "id"),
            `The choice id "${id}" appears twice in this question.`,
          );
        choiceIds.push(id);
      }
      if (!("text" in choice) && !("image" in choice))
        err("OWM-Q-008", at, "A choice must have text, an image, or both.");
      text(choice.text, pointerJoin(at, "text"), "Choice text", "choice");
      if ("image" in choice) image(choice.image, pointerJoin(at, "image"), "choice");
      if ("explanation" in choice)
        content(
          choice.explanation,
          pointerJoin(at, "explanation"),
          "Choice explanation",
          "explanation",
        );
      if ("extensions" in choice) extensions(choice.extensions, pointerJoin(at, "extensions"));
    });

    const correctPointer = pointerJoin(pointer, "correct_answers");
    const correct = sequence(
      q.correct_answers,
      correctPointer,
      "correct_answers",
      undefined,
      "OWM-Q-004",
    );
    const correctIds: string[] = [];
    correct?.forEach((answer, index) => {
      const at = pointerJoin(correctPointer, index);
      const id = string(answer, at, "A correct answer", { rule: "OWM-Q-004" });
      if (id === undefined) return;
      if (correctIds.includes(id))
        err("OWM-Q-004", at, `The correct answer "${id}" is listed twice.`);
      else if (choices && !choiceIds.includes(id))
        err(
          "OWM-Q-004",
          at,
          `The correct answer "${id}" is not the id of a choice in this question.`,
        );
      correctIds.push(id);
    });
    if (
      q.correct_answers !== undefined &&
      Array.isArray(q.correct_answers) &&
      q.correct_answers.length === 0
    ) {
      // Reported as OWM-COL-016 by sequence(); also a nonempty requirement of OWM-Q-004.
      err("OWM-Q-004", correctPointer, "correct_answers must list at least one choice.");
    }
    const countPointer = pointerJoin(pointer, "selection_count");
    if (q.selection_count !== undefined && typeof q.selection_count !== "number") {
      err("OWM-VER-007", countPointer, "selection_count must be a whole number.");
    }
    if (selection === "single") {
      if (correct && correctIds.length !== 1)
        err(
          "OWM-Q-005",
          correctPointer,
          `A single-answer question needs exactly one correct answer; this one lists ${correctIds.length}.`,
        );
      if (q.selection_count !== undefined)
        err("OWM-Q-005", countPointer, "selection_count is only for multiple-answer questions.");
    }
    if (
      selection === "multiple" &&
      typeof q.selection_count === "number" &&
      correct &&
      q.selection_count !== correctIds.length
    ) {
      err(
        "OWM-Q-006",
        countPointer,
        `selection_count is ${q.selection_count}, but correct_answers lists ${correctIds.length}.`,
      );
    }
    if (q.shuffle_choices !== undefined && typeof q.shuffle_choices !== "boolean") {
      err(
        "OWM-Q-007",
        pointerJoin(pointer, "shuffle_choices"),
        "shuffle_choices must be true or false.",
      );
    }
    if ("explanation" in q)
      content(q.explanation, pointerJoin(pointer, "explanation"), "explanation", "explanation");
    if ("hint" in q) content(q.hint, pointerJoin(pointer, "hint"), "hint", "hint");
    tags(q.tags, pointerJoin(pointer, "tags"), LIMITS.itemTags);
    references(q.references, pointerJoin(pointer, "references"), "references", LIMITS.references);
    revision(q.revision, pointerJoin(pointer, "revision"));
    if ("extensions" in q) extensions(q.extensions, pointerJoin(pointer, "extensions"));
  };

  const flashcard = (value: Value, pointer: string) => {
    const card = mapping(value, pointer, "Each flashcard");
    if (!card) return;
    members(
      card,
      pointer,
      ["id", "front", "back", "hint", "tags", "references", "revision", "extensions"],
      { id: "OWM-ID-001", front: "OWM-CARD-001", back: "OWM-CARD-001" },
      `flashcard ${typeof card.id === "string" ? `"${card.id}"` : pointer}`,
    );
    itemId(card.id, pointerJoin(pointer, "id"));
    if ("front" in card) content(card.front, pointerJoin(pointer, "front"), "front", "front");
    if ("back" in card) content(card.back, pointerJoin(pointer, "back"), "back", "back");
    if ("hint" in card) content(card.hint, pointerJoin(pointer, "hint"), "hint", "hint");
    tags(card.tags, pointerJoin(pointer, "tags"), LIMITS.itemTags);
    references(
      card.references,
      pointerJoin(pointer, "references"),
      "references",
      LIMITS.references,
    );
    revision(card.revision, pointerJoin(pointer, "revision"));
    if ("extensions" in card) extensions(card.extensions, pointerJoin(pointer, "extensions"));
  };

  // The collection (section 6).
  const root = parsed.root;
  const formatVersion = string(root.format_version, "/format_version", "format_version", {
    rule: "OWM-VER-001",
  });
  if (formatVersion === undefined) {
    if (!("format_version" in root))
      err(
        "OWM-CONF-004",
        "",
        'The manifest has no format_version. For this version of the format, add format_version: "0.1".',
      );
    findings.checked = false;
    return findings;
  }
  if (!FORMAT_VERSION.test(formatVersion)) {
    err(
      "OWM-VER-001",
      "/format_version",
      `format_version "${formatVersion}" is not of the form MAJOR.MINOR.`,
    );
    findings.checked = false;
    return findings;
  }
  if (!(SUPPORTED_FORMAT_VERSIONS as readonly string[]).includes(formatVersion)) {
    err(
      "OWM-VER-002",
      "/format_version",
      `format_version "${formatVersion}" is not supported. This validator supports ${SUPPORTED_FORMAT_VERSIONS.join(", ")}.`,
    );
    findings.checked = false;
    return findings;
  }

  members(
    root,
    "",
    [
      "format_version",
      "id",
      "title",
      "version",
      "language",
      "description",
      "subject",
      "tags",
      "authors",
      "license",
      "created",
      "updated",
      "sources",
      "practice_defaults",
      "requires",
      "extensions",
      "questions",
      "flashcards",
    ],
    { id: "OWM-COL-001", title: "OWM-COL-001", version: "OWM-COL-001", language: "OWM-COL-001" },
    "the collection",
  );
  const id = string(root.id, "/id", "id", { rule: "OWM-COL-004" });
  if (
    id !== undefined &&
    (!UUID.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$|^f{8}-f{4}-f{4}-f{4}-f{12}$/.test(id))
  ) {
    err(
      "OWM-COL-004",
      "/id",
      `The collection id "${id}" must be a lowercase UUID such as 6d5a39e7-9461-4c21-a736-f7b014b05783, other than the nil and max UUIDs.`,
    );
  }
  string(root.title, "/title", "title", { rule: "OWM-COL-003", max: LIMITS.titleChars });
  const version = string(root.version, "/version", "version", { rule: "OWM-COL-006" });
  if (version !== undefined && !SEMVER.test(version))
    err(
      "OWM-COL-006",
      "/version",
      `version "${version}" must be a Semantic Versioning version, such as 1.0.0.`,
    );
  const language = string(root.language, "/language", "language", { rule: "OWM-COL-008" });
  if (language !== undefined && !isWellFormedLanguageTag(language))
    err(
      "OWM-COL-008",
      "/language",
      `language "${language}" is not a well-formed BCP 47 language tag, such as en or pt-BR.`,
    );
  text(root.description, "/description", "description", "description");
  string(root.subject, "/subject", "subject", { rule: "OWM-COL-003", max: LIMITS.titleChars });
  tags(root.tags, "/tags", LIMITS.collectionTags);

  const authors = sequence(root.authors, "/authors", "authors", LIMITS.authors, "OWM-COL-009");
  authors?.forEach((authorValue, index) => {
    const at = pointerJoin("/authors", index);
    const author = mapping(authorValue, at, "Each author");
    if (!author) return;
    members(author, at, ["name", "url"], { name: "OWM-COL-009" }, "an author");
    string(author.name, pointerJoin(at, "name"), "name", {
      rule: "OWM-COL-009",
      max: LIMITS.plainNameChars,
    });
    url(author.url, pointerJoin(at, "url"), "url");
  });

  const license = mapping(root.license, "/license", "license");
  if (license) {
    members(license, "/license", ["spdx", "statement", "url"], {}, "license");
    if (!("spdx" in license) && !("statement" in license) && !("url" in license)) {
      err("OWM-COL-010", "/license", "license needs at least one of spdx, statement, or url.");
    }
    const spdx = string(license.spdx, "/license/spdx", "spdx", {
      rule: "OWM-COL-010",
      max: LIMITS.spdxChars,
    });
    if (spdx !== undefined && !isValidSpdxExpression(spdx))
      err(
        "OWM-COL-011",
        "/license/spdx",
        `"${spdx}" is not a valid SPDX license expression, such as CC-BY-4.0 or MIT OR Apache-2.0.`,
      );
    string(license.statement, "/license/statement", "statement", {
      rule: "OWM-COL-010",
      max: LIMITS.licenseStatementChars,
    });
    url(license.url, "/license/url", "url");
  }
  for (const key of ["created", "updated"] as const) {
    const date = string(root[key], `/${key}`, key, { rule: "OWM-COL-013" });
    if (date !== undefined && !isValidDate(date))
      err(
        "OWM-COL-013",
        `/${key}`,
        `${key} "${date}" must be a real date written as YYYY-MM-DD, in quotes.`,
      );
  }
  references(root.sources, "/sources", "sources", LIMITS.sources);

  const defaults = mapping(root.practice_defaults, "/practice_defaults", "practice_defaults");
  if (defaults) {
    members(defaults, "/practice_defaults", ["passing_percentage"], {}, "practice_defaults");
    const percentage = defaults.passing_percentage;
    if (
      percentage !== undefined &&
      (typeof percentage !== "number" || percentage < 1 || percentage > 100)
    ) {
      err(
        "OWM-COL-014",
        "/practice_defaults/passing_percentage",
        "passing_percentage must be a whole number from 1 to 100.",
      );
    }
  }

  const requires = sequence(root.requires, "/requires", "requires", undefined, "OWM-VER-005");
  const features = new Set<string>();
  requires?.forEach((featureValue, index) => {
    const at = pointerJoin("/requires", index);
    const feature = string(featureValue, at, "A required feature", { rule: "OWM-VER-005" });
    if (feature === undefined) return;
    if (!FEATURE.test(feature) && !NAMESPACE.test(feature))
      err("OWM-VER-005", at, `"${feature}" is not a valid feature identifier.`);
    else if (features.has(feature))
      err("OWM-VER-005", at, `The feature "${feature}" is listed twice.`);
    else
      err(
        "OWM-VER-006",
        at,
        `This bundle requires the feature "${feature}", which this validator does not implement.`,
      );
    features.add(feature);
  });
  if ("extensions" in root) extensions(root.extensions, "/extensions");

  const questions = sequence(root.questions, "/questions", "questions", undefined, "OWM-COL-002");
  const flashcards = sequence(
    root.flashcards,
    "/flashcards",
    "flashcards",
    undefined,
    "OWM-COL-002",
  );
  if (root.questions === undefined && root.flashcards === undefined) {
    err("OWM-COL-002", "", "The collection has no items. Add questions, flashcards, or both.");
  }
  findings.questions = questions?.length ?? 0;
  findings.flashcards = flashcards?.length ?? 0;
  if (findings.questions + findings.flashcards > LIMITS.items) {
    err(
      "OWM-LIM-001",
      "",
      `The collection has ${findings.questions + findings.flashcards} items; the limit is ${LIMITS.items}.`,
    );
  }
  questions?.forEach((value, index) => {
    question(value, pointerJoin("/questions", index));
  });
  flashcards?.forEach((value, index) => {
    flashcard(value, pointerJoin("/flashcards", index));
  });
  return findings;
}
