// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The engine implements CRC-32, SHA-256, and UTF-8 itself so it behaves the
// same everywhere. These tests compare each one with Node's implementation on
// thousands of random inputs (property-based testing with fast-check).

import { createHash } from "node:crypto";
import { crc32 as zlibCrc32 } from "node:zlib";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { crc32, decodeUtf8, encodeUtf8, sha256Hex, utf8Length } from "../src/bytes.js";

describe("crc32", () => {
  it("matches zlib on random data", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 4096 }), (bytes) => crc32(bytes) === zlibCrc32(bytes)),
    );
  });

  it("continues across chunks", () => {
    fc.assert(
      fc.property(fc.uint8Array(), fc.uint8Array(), (a, b) => {
        const whole = new Uint8Array([...a, ...b]);
        return crc32(b, crc32(a)) === crc32(whole);
      }),
    );
  });
});

describe("sha256Hex", () => {
  it("matches node:crypto on random data", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 2048 }),
        (bytes) => sha256Hex(bytes) === createHash("sha256").update(bytes).digest("hex"),
      ),
    );
  });

  it("gives the published digest of the empty string", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("decodeUtf8", () => {
  const strict = new TextDecoder("utf-8", { fatal: true });

  it("accepts exactly what a strict WHATWG decoder accepts, with the same text", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        let expected: string | undefined;
        try {
          expected = strict.decode(bytes);
        } catch {
          expected = undefined;
        }
        const result = decodeUtf8(bytes);
        return result.ok ? result.text === expected : expected === undefined;
      }),
      { numRuns: 20_000 },
    );
  });

  it("removes a leading byte order mark and reports it", () => {
    const result = decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]));
    expect(result).toEqual({ ok: true, text: "a", hadBom: true });
  });

  it("rejects overlong encodings and surrogates", () => {
    expect(decodeUtf8(new Uint8Array([0xc0, 0xaf])).ok).toBe(false);
    expect(decodeUtf8(new Uint8Array([0xed, 0xa0, 0x80])).ok).toBe(false);
  });

  it("round-trips through encodeUtf8, and utf8Length agrees", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), (text) => {
        const bytes = encodeUtf8(text);
        const decoded = decodeUtf8(bytes);
        return (
          decoded.ok &&
          decoded.text === text &&
          bytes.length === utf8Length(text) &&
          bytes.length === new TextEncoder().encode(text).length
        );
      }),
    );
  });
});
