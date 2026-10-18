// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Every example in examples/ must conform to draft 0.1, as far as checks
// available before the reference engine (M2) can tell: YAML profile, JSON
// Schema (Ajv), cross-references, asset presence and signatures, and https-only
// links. The examples are also expected to be lint-clean: no unused assets.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileSchema,
  imageReferences,
  parseManifest,
  semanticProblems,
} from "./support/manifest.js";
import type { Manifest, Value } from "./support/manifest.js";

const EXAMPLES = new URL("../examples/", import.meta.url).pathname;
const ASSET_PATH =
  /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}\/){0,7}[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}\.(png|jpg|jpeg|webp)$/;
const validate = compileSchema();

const archiveExamples = readdirSync(EXAMPLES).filter((name) =>
  statSync(join(EXAMPLES, name)).isDirectory(),
);

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((name) => join(directory, name))
    .filter((path) => statSync(path).isFile());
}

function load(path: string): Manifest {
  return parseManifest(readFileSync(path, "utf8"));
}

function signatureFormat(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  return "unknown";
}

function urlsIn(value: Value, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((entry) => urlsIn(entry));
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, child]) =>
      childKey === "extensions" ? [] : urlsIn(child, childKey),
    );
  }
  if (typeof value !== "string") return [];
  if (key === "url" || key === "credit_url") return [value];
  if (key === "text" || key === "description") {
    return [...value.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map((match) => match[1] ?? "");
  }
  return [];
}

describe("example bundles", () => {
  it("include bundles with images and bundles without", () => {
    expect(archiveExamples.length).toBeGreaterThanOrEqual(5);
    expect(archiveExamples.some((name) => !existsSync(join(EXAMPLES, name, "assets")))).toBe(true);
  });

  describe.each(archiveExamples)("%s", (name) => {
    const root = join(EXAMPLES, name);
    const manifest = load(join(root, "study.yaml"));

    it("validates against the JSON Schema", () => {
      validate(manifest);
      expect(validate.errors ?? []).toEqual([]);
    });

    it("satisfies the cross-reference rules", () => {
      expect(semanticProblems(manifest)).toEqual([]);
    });

    it("contains only study.yaml and permitted assets", () => {
      const files = filesUnder(root).map((path) => relative(root, path));
      for (const file of files) {
        if (file === "study.yaml") continue;
        expect(file, file).toMatch(ASSET_PATH);
      }
    });

    it("references only present assets, each with a matching signature", () => {
      for (const { src, pointer } of imageReferences(manifest)) {
        expect(src, pointer).toMatch(ASSET_PATH);
        const bytes = readFileSync(join(root, src));
        const extension = src.split(".").pop() === "jpg" ? "jpeg" : src.split(".").pop();
        expect(signatureFormat(bytes), src).toBe(extension);
        expect(bytes.length, src).toBeLessThanOrEqual(10 * 1024 * 1024);
      }
    });

    it("has no unreferenced assets", () => {
      const referenced = new Set(imageReferences(manifest).map((ref) => ref.src));
      const assets = filesUnder(join(root, "assets")).map((path) => relative(root, path));
      expect(assets.filter((asset) => !referenced.has(asset))).toEqual([]);
    });

    it("uses only https URLs", () => {
      for (const url of urlsIn(manifest)) expect(url).toMatch(/^https:\/\/[^\s/?#@]+/);
    });
  });
});
