// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The YAML profile (spec section 4). The manifest is parsed with the YAML 1.2
// core schema and converted into the data model of section 4.3, recording the
// source position of every value. Mappings become null-prototype objects, so a
// key such as "__proto__" is ordinary data.

import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments } from "yaml";
import type { Node } from "yaml";
import { LIMITS } from "./limits.js";
import type { Location, ReportBuilder } from "./report.js";

export type Value = string | number | boolean | Value[] | Mapping;
export interface Mapping {
  [key: string]: Value;
}

export interface Position {
  line: number;
  column: number;
}

export interface ParsedManifest {
  root: Mapping;
  /** Position of each value, by JSON Pointer. */
  positions: Map<string, Position>;
  /** Position of each member's key, by the member's JSON Pointer. */
  keyPositions: Map<string, Position>;
  /** Plain scalars that a YAML 1.1 parser would resolve differently (OWM-LINT-012). */
  ambiguousScalars: { pointer: string; source: string }[];
}

const INTEGER_SOURCE = /^[-+]?(?:[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$/;
const YAML11_AMBIGUOUS = [
  /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)$/,
  /^\d{4}-\d{1,2}-\d{1,2}(?:[Tt ].*)?$/,
  /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/,
  /^[-+]?0[0-9_]+$/,
  /^[-+]?0b[01_]+$/,
  /^[-+]?[0-9][0-9]*_[0-9_]*$/,
];

export function pointerJoin(pointer: string, key: string | number): string {
  return `${pointer}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

/** Characters prohibited anywhere in the manifest (OWM-ENC-002). */
export function checkCharacters(
  text: string,
  report: ReportBuilder,
  entry: string | undefined,
): void {
  let line = 1;
  let column = 1;
  let found = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const prohibited =
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0xfffe ||
      code === 0xffff;
    if (prohibited && found++ < 10) {
      const location: Location = { line, column };
      if (entry !== undefined) location.entry = entry;
      report.add(
        "OWM-ENC-002",
        `The manifest contains the prohibited character U+${code.toString(16).toUpperCase().padStart(4, "0")}.`,
        location,
      );
    }
    if (char === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
}

export function parseManifestText(
  text: string,
  report: ReportBuilder,
  entry: string | undefined,
): ParsedManifest | undefined {
  const lineCounter = new LineCounter();
  const at = (offset: number | undefined, pointer?: string): Location => {
    const location: Location = {};
    if (entry !== undefined) location.entry = entry;
    if (pointer !== undefined) location.pointer = pointer;
    if (offset !== undefined) {
      const { line, col } = lineCounter.linePos(offset);
      location.line = line;
      location.column = col;
    }
    return location;
  };
  const documents = parseAllDocuments(text, {
    version: "1.2",
    schema: "core",
    uniqueKeys: true,
    merge: false,
    strict: true,
    prettyErrors: false,
    lineCounter,
  });
  if (!Array.isArray(documents) || documents.length === 0) {
    report.add("OWM-YAML-001", "The manifest contains no YAML document.", at(undefined));
    return undefined;
  }
  if (documents.length > 1) {
    report.add(
      "OWM-YAML-001",
      `The manifest contains ${documents.length} YAML documents; exactly one is permitted.`,
      at(documents[1]?.range[0]),
    );
    return undefined;
  }
  const document = documents[0];
  if (!document) return undefined;
  let wellFormed = true;
  for (const error of document.errors) {
    const rule = error.code === "DUPLICATE_KEY" ? "OWM-YAML-004" : "OWM-YAML-011";
    report.add(
      rule,
      error.code === "DUPLICATE_KEY"
        ? "A mapping contains the same key twice."
        : `The manifest is not well-formed YAML: ${error.message.split("\n")[0] ?? ""}`,
      at(error.pos[0]),
    );
    wellFormed = false;
  }
  const tagHandles = Object.keys(document.directives.tags).filter(
    (handle) => handle !== "!" && handle !== "!!",
  );
  if (document.directives.yaml.explicit || tagHandles.length > 0) {
    report.add("OWM-YAML-001", "Directives (%YAML, %TAG) are not permitted.", at(0));
    wellFormed = false;
  }
  if (!wellFormed) return undefined;

  const positions = new Map<string, Position>();
  const keyPositions = new Map<string, Position>();
  const ambiguousScalars: { pointer: string; source: string }[] = [];
  let nodes = 0;
  const state = { ok: true };
  const fail = (rule: string, message: string, offset: number | undefined, pointer: string) => {
    report.add(rule, message, at(offset, pointer));
    state.ok = false;
  };
  const position = (offset: number | undefined): Position | undefined => {
    if (offset === undefined) return undefined;
    const { line, col } = lineCounter.linePos(offset);
    return { line, column: col };
  };

  const convert = (
    node: Node | null,
    pointer: string,
    depth: number,
    keyOffset: number | undefined,
  ): Value | undefined => {
    if (node === null) {
      fail(
        "OWM-YAML-008",
        "A null (empty) value is not permitted. Leave the member out instead.",
        keyOffset,
        pointer,
      );
      return undefined;
    }
    if (++nodes > LIMITS.yamlNodes) {
      if (nodes === LIMITS.yamlNodes + 1)
        fail(
          "OWM-LIM-001",
          `The manifest has more than ${LIMITS.yamlNodes} nodes.`,
          node.range?.[0],
          pointer,
        );
      return undefined;
    }
    if (depth > LIMITS.yamlDepth) {
      fail(
        "OWM-LIM-001",
        `The manifest is nested more than ${LIMITS.yamlDepth} levels deep.`,
        node.range?.[0],
        pointer,
      );
      return undefined;
    }
    const offset = node.range?.[0];
    const where = position(offset);
    if (where) positions.set(pointer, where);
    if (isAlias(node)) {
      fail("OWM-YAML-002", "Aliases (*name) are not permitted.", offset, pointer);
      return undefined;
    }
    if (node.anchor)
      fail("OWM-YAML-002", `Anchors (&${node.anchor}) are not permitted.`, offset, pointer);
    // The parser sets `tag` only for tags written explicitly in the source.
    if (node.tag)
      fail("OWM-YAML-002", `Explicit tags (${node.tag}) are not permitted.`, offset, pointer);
    if (isMap(node)) {
      const result = Object.create(null) as Mapping;
      for (const pair of node.items) {
        const key = pair.key;
        if (!isScalar(key) || typeof key.value !== "string") {
          const keyRange = (key as Node | null)?.range?.[0];
          fail(
            "OWM-YAML-003",
            "Every mapping key must be a string. Complex and non-string keys are not permitted.",
            keyRange ?? offset,
            pointer,
          );
          continue;
        }
        if (key.anchor || key.tag)
          fail(
            "OWM-YAML-002",
            "Anchors and tags are not permitted on keys.",
            key.range?.[0],
            pointer,
          );
        const childPointer = pointerJoin(pointer, key.value);
        const keyWhere = position(key.range?.[0]);
        if (keyWhere) keyPositions.set(childPointer, keyWhere);
        const value = convert(pair.value as Node | null, childPointer, depth + 1, key.range?.[0]);
        if (value !== undefined) result[key.value] = value;
      }
      return result;
    }
    if (isSeq(node)) {
      const result: Value[] = [];
      node.items.forEach((item, index) => {
        const value = convert(item as Node | null, pointerJoin(pointer, index), depth + 1, offset);
        if (value !== undefined) result.push(value);
      });
      return result;
    }
    if (isScalar(node)) {
      const value = node.value;
      const source = node.source ?? "";
      if (value === null) {
        fail(
          "OWM-YAML-008",
          "Null values are not permitted. Leave the member out instead.",
          offset,
          pointer,
        );
        return undefined;
      }
      if (typeof value === "number") {
        if (!INTEGER_SOURCE.test(source)) {
          fail(
            "OWM-YAML-009",
            `Floating-point numbers such as ${source} are not permitted. Quote it if it is text.`,
            offset,
            pointer,
          );
          return undefined;
        }
        if (!Number.isSafeInteger(value)) {
          fail(
            "OWM-YAML-007",
            `The integer ${source} is outside the permitted range.`,
            offset,
            pointer,
          );
          return undefined;
        }
      }
      if (node.type === "PLAIN" && YAML11_AMBIGUOUS.some((pattern) => pattern.test(source))) {
        ambiguousScalars.push({ pointer, source });
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
      fail("OWM-YAML-011", "Unsupported scalar value.", offset, pointer);
      return undefined;
    }
    fail("OWM-YAML-011", "Unsupported YAML node.", offset, pointer);
    return undefined;
  };

  const contents = document.contents as Node | null;
  const root = convert(contents, "", 1, 0);
  if (!state.ok || root === undefined) return undefined;
  if (typeof root !== "object" || Array.isArray(root)) {
    report.add(
      "OWM-COL-001",
      "The manifest's top level must be a mapping of members.",
      at(contents?.range?.[0], ""),
    );
    return undefined;
  }
  return { root, positions, keyPositions, ambiguousScalars };
}
