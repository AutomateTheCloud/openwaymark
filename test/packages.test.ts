// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The packages published to npm must carry the license and notice, be public,
// and share one version, because one release tag publishes them together.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PUBLISHED = ["packages/engine", "packages/cli"];

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  license?: string;
  files?: string[];
  publishConfig?: { access?: string };
  dependencies?: Record<string, string>;
}

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function manifest(dir: string): Manifest {
  return JSON.parse(read(`${dir}/package.json`)) as Manifest;
}

describe.each(PUBLISHED)("published package %s", (dir) => {
  const pkg = manifest(dir);

  it("is publishable and public", () => {
    expect(pkg.private).toBeUndefined();
    expect(pkg.name.startsWith("@automatethecloud/")).toBe(true);
    expect(pkg.publishConfig?.access).toBe("public");
  });

  it("ships the repository's LICENSE and NOTICE unchanged", () => {
    expect(pkg.license).toBe("Apache-2.0");
    expect(pkg.files).toContain("NOTICE");
    expect(read(`${dir}/LICENSE`)).toBe(read("LICENSE"));
    expect(read(`${dir}/NOTICE`)).toBe(read("NOTICE"));
  });

  it("ships its sources, which the source maps point to", () => {
    expect(pkg.files).toContain("src");
  });
});

describe("published packages together", () => {
  const packages = PUBLISHED.map(manifest);

  it("share one version", () => {
    expect(new Set(packages.map((pkg) => pkg.version)).size).toBe(1);
  });

  it("depend on each other through the workspace", () => {
    const names = new Set(packages.map((pkg) => pkg.name));
    for (const pkg of packages) {
      for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
        if (names.has(name)) expect(range).toBe("workspace:*");
      }
    }
  });
});
