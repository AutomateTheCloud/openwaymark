// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Test-only helpers for checking example manifests against draft 0.1. They are
// not the reference engine (milestone M2) and cover only what the examples
// need: the YAML profile (section 4), schema validation with an off-the-shelf
// validator, and the cross-reference rules a schema cannot express.

import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { isMap, isScalar, parseAllDocuments, visit } from "yaml";

const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

const SCHEMA_PATH = new URL("../../schema/openwaymark-0.1.schema.json", import.meta.url);
const INTEGER_SOURCE = /^[-+]?(?:[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$/;

export type Value = string | number | boolean | Value[] | { [key: string]: Value };
export type Manifest = { [key: string]: Value };

/** A value as text for messages and comparisons; non-strings become JSON. */
export function asText(value: Value | undefined): string {
  if (value === undefined) return "undefined";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Parses YAML text under the OpenWaymark YAML profile, or throws with the reasons. */
export function parseManifest(source: string): Manifest {
  const documents = parseAllDocuments(source, {
    version: "1.2",
    schema: "core",
    uniqueKeys: true,
    merge: false,
    prettyErrors: false,
  });
  if (!Array.isArray(documents) || documents.length !== 1) {
    throw new Error("OWM-YAML-001: the manifest must contain exactly one YAML document");
  }
  const [document] = documents;
  if (!document) throw new Error("OWM-YAML-001: no document");
  const problems: string[] = document.errors.map((error) => error.message);
  if (document.directives.yaml.explicit || source.trimStart().startsWith("%")) {
    problems.push("OWM-YAML-001: directives are not permitted");
  }
  // The yaml library calls a type-specific visitor instead of `Node`, so the
  // anchor and tag check runs from each one.
  const checkNode = (node: { anchor?: string | undefined; tag?: string | undefined }) => {
    if (node.anchor) problems.push(`OWM-YAML-002: anchor &${node.anchor} is not permitted`);
    // The parser sets `tag` only for tags written explicitly in the source.
    if (node.tag) problems.push(`OWM-YAML-002: explicit tag ${node.tag} is not permitted`);
  };
  visit(document, {
    Alias() {
      problems.push("OWM-YAML-002: aliases are not permitted");
    },
    Map(_key, node) {
      checkNode(node);
    },
    Seq(_key, node) {
      checkNode(node);
    },
    Pair(_key, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
        problems.push("OWM-YAML-003: every mapping key must be a string scalar");
      }
    },
    Scalar(_key, node) {
      checkNode(node);
      if (node.value === null) problems.push("OWM-YAML-008: null values are not permitted");
      if (typeof node.value === "number" && !INTEGER_SOURCE.test(node.source ?? "")) {
        problems.push(
          `OWM-YAML-009: floating-point number ${String(node.source)} is not permitted`,
        );
      }
    },
  });
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const contents = document.contents;
  if (!isMap(contents)) throw new Error("OWM-COL-001: the root must be a mapping");
  return document.toJS() as Manifest;
}

/** Compiles the draft 0.1 schema with Ajv in strict mode. */
export function compileSchema() {
  // strictRequired is off: `required` inside anyOf names properties defined at the parent,
  // which is valid JSON Schema but a style Ajv's strict mode rejects.
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as object;
  return ajv.compile(schema);
}

export interface ImageRef {
  pointer: string;
  src: string;
}

/** Every asset path referenced by image objects and Markdown images. */
export function imageReferences(manifest: Manifest): ImageRef[] {
  const refs: ImageRef[] = [];
  const walk = (value: Value, pointer: string, key: string) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        walk(entry, `${pointer}/${String(index)}`, String(index));
      });
    } else if (typeof value === "object") {
      if (key === "image" && typeof value.src === "string") refs.push({ pointer, src: value.src });
      if (key === "extensions") return;
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, `${pointer}/${childKey}`, childKey);
      }
    } else if (typeof value === "string" && (key === "text" || key === "description")) {
      for (const match of value.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?/g)) {
        if (match[1]) refs.push({ pointer, src: match[1] });
      }
    }
  };
  walk(manifest, "", "");
  return refs;
}

/** Cross-reference rules from sections 7 and 9 that the schema cannot express. */
export function semanticProblems(manifest: Manifest): string[] {
  const problems: string[] = [];
  const questions = (manifest.questions ?? []) as Manifest[];
  const flashcards = (manifest.flashcards ?? []) as Manifest[];
  const seen = new Set<string>();
  for (const item of [...questions, ...flashcards]) {
    const id = asText(item.id);
    if (seen.has(id)) problems.push(`OWM-ID-002: item id ${id} is not unique`);
    seen.add(id);
  }
  for (const question of questions) {
    const choiceIds = ((question.choices ?? []) as Manifest[]).map((choice) => asText(choice.id));
    if (new Set(choiceIds).size !== choiceIds.length) {
      problems.push(`OWM-ID-003: duplicate choice id in ${asText(question.id)}`);
    }
    const correct = (question.correct_answers ?? []) as string[];
    for (const answer of correct) {
      if (!choiceIds.includes(answer)) {
        problems.push(`OWM-Q-004: ${asText(question.id)} lists unknown choice ${answer}`);
      }
    }
    if (question.selection_count !== undefined && question.selection_count !== correct.length) {
      problems.push(
        `OWM-Q-006: ${asText(question.id)} selection_count differs from correct_answers`,
      );
    }
  }
  if (questions.length + flashcards.length > 10_000) problems.push("Section 11: too many items");
  return problems;
}
