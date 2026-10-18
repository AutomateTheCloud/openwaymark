// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The integrity file (spec section 3.7): `integrity.json` lists a SHA-256
// digest of every file in an archive bundle, so a reader can tell whether any
// file changed after packing. It detects change, not tampering: whoever changes
// a file can rewrite this file too (OWM-INT-005).

import { parseDocument } from "yaml";
import { decodeUtf8, sha256Hex } from "./bytes.js";
import type { ReportBuilder } from "./report.js";

export const INTEGRITY_NAME = "integrity.json";
export const INTEGRITY_MAX_BYTES = 1024 * 1024;
const DIGEST = /^[0-9a-f]{64}$/;

/** Parses and checks the integrity file (OWM-INT-002). Returns the digests by file name. */
export function parseIntegrity(
  bytes: Uint8Array,
  report: ReportBuilder,
): Map<string, string> | undefined {
  const at = { entry: INTEGRITY_NAME };
  const fail = (message: string): Map<string, string> | undefined => {
    report.add("OWM-INT-002", message, at);
    return undefined;
  };
  const decoded = decodeUtf8(bytes);
  if (!decoded.ok) return fail("integrity.json is not valid UTF-8.");
  // JSON is a subset of YAML 1.2, and the yaml library's JSON schema reports
  // duplicate keys, which JSON.parse silently accepts.
  const document = parseDocument(decoded.text, {
    schema: "json",
    uniqueKeys: true,
    strict: true,
    prettyErrors: false,
  });
  if (document.errors.length > 0) {
    const duplicate = document.errors.some((error) => error.code === "DUPLICATE_KEY");
    return fail(
      duplicate ? "integrity.json contains a duplicate key." : "integrity.json is not valid JSON.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(decoded.text);
  } catch {
    return fail("integrity.json is not valid JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return fail("integrity.json must contain a JSON object.");
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("algorithm") || !keys.includes("files")) {
    return fail('integrity.json must have exactly two members: "algorithm" and "files".');
  }
  const { algorithm, files } = value as { algorithm: unknown; files: unknown };
  if (algorithm !== "sha-256") return fail('integrity.json "algorithm" must be "sha-256".');
  if (typeof files !== "object" || files === null || Array.isArray(files))
    return fail('integrity.json "files" must be an object.');
  const digests = new Map<string, string>();
  for (const [name, digest] of Object.entries(files)) {
    if (typeof digest !== "string" || !DIGEST.test(digest)) {
      return fail(
        `The digest for ${name} in integrity.json must be 64 lowercase hexadecimal digits.`,
      );
    }
    digests.set(name, digest);
  }
  return digests;
}

/**
 * Checks that the integrity file lists exactly the bundle's files
 * (OWM-INT-003) and that every digest matches (OWM-INT-004).
 * `files` holds every file that could be read; `unreadable` names files that
 * exist but failed earlier checks, so their digests cannot be compared.
 */
export function verifyIntegrity(
  digests: ReadonlyMap<string, string>,
  files: ReadonlyMap<string, Uint8Array>,
  unreadable: ReadonlySet<string>,
  report: ReportBuilder,
): void {
  for (const name of [...files.keys(), ...unreadable]) {
    if (!digests.has(name))
      report.add("OWM-INT-003", `integrity.json does not list ${name}.`, { entry: name });
  }
  for (const [name, digest] of digests) {
    const bytes = files.get(name);
    if (bytes === undefined) {
      if (!unreadable.has(name))
        report.add(
          "OWM-INT-003",
          `integrity.json lists ${name}, which is not a file in the bundle.`,
          { entry: INTEGRITY_NAME },
        );
      continue;
    }
    if (sha256Hex(bytes) !== digest) {
      report.add(
        "OWM-INT-004",
        `${name} has changed since integrity.json was written. Repack the bundle with a tool that writes a new integrity file, or delete integrity.json.`,
        { entry: name },
      );
    }
  }
}

/** The integrity file for a set of files, as written by the packer: sorted keys, two-space indent. */
export function buildIntegrity(files: ReadonlyMap<string, Uint8Array>): string {
  const sorted = [...files.keys()].sort();
  const entries = Object.fromEntries(
    sorted.map((name) => [name, sha256Hex(files.get(name) ?? new Uint8Array(0))]),
  );
  return `${JSON.stringify({ algorithm: "sha-256", files: entries }, null, 2)}\n`;
}
