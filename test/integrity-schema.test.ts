// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The integrity files the packer writes must satisfy the published schema, so
// the schema and the engine describe the same file (spec section 3.7).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { buildIntegrity } from "../packages/engine/src/integrity.js";

const EXAMPLES = new URL("../examples/", import.meta.url).pathname;
const schema = JSON.parse(
  readFileSync(new URL("../schema/openwaymark-integrity-0.1.schema.json", import.meta.url), "utf8"),
) as object;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

describe("integrity.json written by the packer", () => {
  const archives = readdirSync(EXAMPLES).filter((name) =>
    statSync(join(EXAMPLES, name)).isDirectory(),
  );

  it.each(archives)("%s matches the integrity schema", (name) => {
    const root = join(EXAMPLES, name);
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) =>
        statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)],
      );
    const files = new Map(
      walk(root).map((path) => [relative(root, path), new Uint8Array(readFileSync(path))]),
    );
    const integrity = JSON.parse(buildIntegrity(files)) as unknown;
    validate(integrity);
    expect(validate.errors ?? []).toEqual([]);
  });

  it("rejects an unknown algorithm and a malformed digest", () => {
    expect(validate({ algorithm: "md5", files: { "study.yaml": "0".repeat(64) } })).toBe(false);
    expect(validate({ algorithm: "sha-256", files: { "study.yaml": "ABC" } })).toBe(false);
  });
});
