// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Whole-bundle behavior that fixtures cannot show: limits enforced before
// reading, packing and fingerprints, cancellation, and verdicts without a
// decoder.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bytesSource, type ByteSource } from "../src/bytes.js";
import { packBundle } from "../src/pack.js";
import { validateBundle, ValidationCanceled } from "../src/validate.js";

const EXAMPLES = new URL("../../../examples/", import.meta.url).pathname;
const passThroughDecoder = {
  name: "test decoder",
  decode: () => Promise.reject(new Error("not used")),
};

function exampleFiles(name: string) {
  const root = join(EXAMPLES, name);
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) =>
      statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)],
    );
  return walk(root).map((path) => ({
    path: relative(root, path),
    bytes: new Uint8Array(readFileSync(path)),
  }));
}

/** A ByteSource that claims a size and counts how many bytes are actually read. */
function countingSource(size: number): ByteSource & { bytesRead: number } {
  const source = {
    size,
    bytesRead: 0,
    read(_offset: number, length: number) {
      source.bytesRead += length;
      return Promise.resolve(new Uint8Array(Math.min(length, 64)));
    },
  };
  return source;
}

describe("validateBundle", () => {
  it("rejects an oversized archive after reading only its first bytes (OWM-LIM-002)", async () => {
    const source = countingSource(200 * 1024 * 1024);
    const original = source.read.bind(source);
    source.read = (offset, length) =>
      original(offset, length).then((bytes) =>
        offset === 0 ? Uint8Array.from([0x50, 0x4b, 3, 4]) : bytes,
      );
    const { report } = await validateBundle(source);
    expect(report.diagnostics.map((d) => d.rule)).toEqual(["OWM-LIM-001"]);
    expect(source.bytesRead).toBeLessThanOrEqual(4);
  });

  it("rejects an oversized text bundle without reading it", async () => {
    const source = countingSource(9 * 1024 * 1024);
    const { report } = await validateBundle(source);
    expect(report.conformance).toBe("not-conforming");
    expect(source.bytesRead).toBeLessThanOrEqual(4);
  });

  it("reports incomplete, not conforming, when no image decoder is available (OWM-VAL-003)", async () => {
    const { archive } = packBundle(exampleFiles("anatomy-basics"));
    const { report, bundle } = await validateBundle(bytesSource(archive));
    expect(report.conformance).toBe("incomplete");
    expect(report.checks.find((check) => check.id === "image-decode")?.status).toBe("skipped");
    expect(bundle).toBeUndefined();
  });

  it("reports a decoder failure as OWM-IMG-009", async () => {
    const { archive } = packBundle(exampleFiles("anatomy-basics"));
    const { report } = await validateBundle(bytesSource(archive), {
      imageDecoder: passThroughDecoder,
    });
    expect(report.diagnostics.map((d) => d.rule)).toContain("OWM-IMG-009");
  });

  it("stops with ValidationCanceled when the signal is set", async () => {
    const { archive } = packBundle(exampleFiles("networking-fundamentals"));
    await expect(
      validateBundle(bytesSource(archive), { signal: { aborted: true } }),
    ).rejects.toBeInstanceOf(ValidationCanceled);
  });

  it("caps the diagnostics it keeps but counts them all", async () => {
    const manifest = `format_version: "0.1"\nid: 4c5e2a10-8b7d-4f3e-9a21-6d0c3b5e7f81\ntitle: T\nversion: 1.0.0\nlanguage: en\nflashcards:\n${Array.from({ length: 50 }, () => "  - id: BAD\n    front:\n      text: F\n    back:\n      text: B\n").join("")}`;
    const { report } = await validateBundle(bytesSource(new TextEncoder().encode(manifest)), {
      maxDiagnostics: 10,
    });
    expect(report.diagnostics).toHaveLength(10);
    expect(report.errors).toBe(50);
    expect(report.truncated).toBe(true);
  });
});

describe("packBundle", () => {
  it("is deterministic and ignores input order", () => {
    const files = exampleFiles("networking-fundamentals");
    expect(packBundle(files).archive).toEqual(packBundle([...files].reverse()).archive);
  });

  it("leaves out operating-system metadata", () => {
    const files = [
      ...exampleFiles("networking-fundamentals"),
      { path: ".DS_Store", bytes: new Uint8Array(3) },
    ];
    expect(packBundle(files).skipped).toEqual([".DS_Store"]);
  });

  it("produces conforming archives for every example, whose fingerprint survives repacking (OWM-UPD-005)", async () => {
    for (const name of ["networking-fundamentals", "anatomy-basics", "rendering-showcase"]) {
      const files = exampleFiles(name);
      const ours = await validateBundle(bytesSource(packBundle(files).archive), {
        imageDecoder: realSizes(files),
      });
      expect(ours.report.conformance, name).toBe("conforming");
      // A different ZIP writer, different compression, same content: same fingerprint.
      const theirs = zipSync(
        Object.fromEntries(files.map((file) => [file.path, [file.bytes, { level: 1 }]])),
      );
      const other = await validateBundle(bytesSource(theirs), { imageDecoder: realSizes(files) });
      expect(other.report.conformance, `${name} via fflate`).toBe("conforming");
      expect(other.report.fingerprint).toBe(ours.report.fingerprint);
    }
  });
});

/** A stand-in decoder that reports each image's real header dimensions, for tests that are not about decoding. */
function realSizes(files: { path: string; bytes: Uint8Array }[]) {
  return {
    name: "header dimensions",
    async decode(bytes: Uint8Array) {
      const { inspectImage } = await import("../src/images.js");
      const result = inspectImage(bytes);
      if (!result.ok || !files.some((file) => file.bytes.length === bytes.length))
        throw new Error("unexpected image");
      return { width: result.info.width, height: result.info.height };
    },
  };
}
