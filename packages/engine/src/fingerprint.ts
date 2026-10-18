// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Content fingerprint (spec section 12.3, OWM-UPD-005): SHA-256 over a
// version line, the manifest in the JSON Canonicalization Scheme (RFC 8785),
// and the sorted list of asset paths with their SHA-256 digests.

import { encodeUtf8, sha256Hex } from "./bytes.js";
import type { Value } from "./yaml.js";

/**
 * RFC 8785 serialization. The data model of format 0.1 contains no
 * floating-point numbers, so numbers are integers and serialize as such.
 * Keys sort by UTF-16 code units, which is JavaScript's default string order.
 */
export function canonicalJson(value: Value): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as Value)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareBytes(a: string, b: string): number {
  // Asset paths are ASCII, so code-unit order equals byte order.
  return a < b ? -1 : a > b ? 1 : 0;
}

export function contentFingerprint(
  manifest: Value,
  assets: ReadonlyMap<string, Uint8Array>,
): string {
  const lines = ["openwaymark-fingerprint-v1\n", `${canonicalJson(manifest)}\n`];
  for (const path of [...assets.keys()].sort(compareBytes)) {
    const bytes = assets.get(path);
    if (bytes) lines.push(`${path}\t${sha256Hex(bytes)}\n`);
  }
  return sha256Hex(encodeUtf8(lines.join("")));
}
