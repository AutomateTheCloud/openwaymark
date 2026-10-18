// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Complete manifests shown in the documentation must stay valid, so the docs
// cannot drift from the format. A YAML code block counts as a complete
// manifest when it starts with `format_version`. Partial snippets are skipped.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileSchema, parseManifest, semanticProblems } from "./support/manifest.js";

const DOCUMENTS = ["README.md", "spec/openwaymark.md", "spec/authoring-guide.md"];
const validate = compileSchema();

function manifestsIn(path: string): string[] {
  const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  return [...text.matchAll(/^```yaml\n([\s\S]*?)^```$/gm)]
    .map((match) => match[1] ?? "")
    .filter((block) => block.startsWith("format_version"));
}

describe.each(DOCUMENTS)("manifests in %s", (path) => {
  const manifests = manifestsIn(path);

  it("include at least one complete manifest", () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it.each(manifests.map((source, index) => [index + 1, source] as const))(
    "manifest %i is valid",
    (_n, source) => {
      const manifest = parseManifest(source);
      validate(manifest);
      expect(validate.errors ?? []).toEqual([]);
      expect(semanticProblems(manifest)).toEqual([]);
    },
  );
});
