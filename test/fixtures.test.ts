// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Runs the conformance fixtures through the reference engine in Node, with
// sharp decoding images. Each fixture's expect.json states the outcome
// (normative: accept or reject) and rules that must be among those reported
// (informative: other validators may use their own identifiers).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bytesSource, validateBundle } from "../packages/engine/src/index.js";
import { sharpDecoder } from "../packages/cli/src/decoder.js";
import { generateFixtures } from "../tools/generate-fixtures.mjs";

interface Expectation {
  description: string;
  format_version: string;
  mode: "validate" | "lint";
  outcome: "accept" | "reject";
  rules: string[];
}

const FIXTURES = new URL("../fixtures/", import.meta.url).pathname;
const ids = readdirSync(FIXTURES)
  .filter((name) => statSync(join(FIXTURES, name)).isDirectory())
  .sort();

describe("conformance fixtures", () => {
  it("match what tools/generate-fixtures.mjs produces", () => {
    const generated = generateFixtures();
    const committed = ids.flatMap((id) =>
      readdirSync(join(FIXTURES, id)).map((file) => `${id}/${file}`),
    );
    expect(committed.sort()).toEqual([...generated.keys()].sort());
    for (const [path, bytes] of generated) {
      expect(Buffer.from(readFileSync(join(FIXTURES, path))).equals(Buffer.from(bytes)), path).toBe(
        true,
      );
    }
  });

  it("stay small: no input over 1 MiB", () => {
    for (const id of ids) {
      for (const file of readdirSync(join(FIXTURES, id))) {
        expect(statSync(join(FIXTURES, id, file)).size, `${id}/${file}`).toBeLessThanOrEqual(
          1024 * 1024,
        );
      }
    }
  });

  it.each(ids)("%s", async (id) => {
    const dir = join(FIXTURES, id);
    const expectation = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8")) as Expectation;
    const input = existsSync(join(dir, "input.waymark"))
      ? join(dir, "input.waymark")
      : join(dir, "input.yaml");
    const { report, bundle } = await validateBundle(bytesSource(readFileSync(input)), {
      imageDecoder: sharpDecoder,
      lint: expectation.mode === "lint",
    });
    const reported = report.diagnostics.map((diagnostic) => diagnostic.rule);
    expect(report.conformance, JSON.stringify(report.diagnostics, null, 2)).toBe(
      expectation.outcome === "accept" ? "conforming" : "not-conforming",
    );
    for (const rule of expectation.rules)
      expect(reported, `${id} should report ${rule}`).toContain(rule);
    expect(bundle !== undefined).toBe(expectation.outcome === "accept");
  });
});
