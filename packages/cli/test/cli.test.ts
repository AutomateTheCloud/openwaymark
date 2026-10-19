// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The CLI's exit statuses and output are an interface that scripts depend on,
// so each command is tested against real files in a temporary folder.

import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@automatethecloud/openwaymark-engine";
import {
  EXIT_INCOMPLETE,
  EXIT_IO,
  EXIT_NOT_CONFORMING,
  EXIT_OK,
  EXIT_THREAT,
  EXIT_USAGE,
  run,
  type Dependencies,
} from "../src/cli.js";
import { sharpDecoder } from "../src/decoder.js";
import type { Scanner } from "../src/scan.js";
import { CLI_VERSION } from "../src/version.js";

const REPO = new URL("../../../", import.meta.url).pathname;
const FIXTURES = join(REPO, "fixtures");

async function cli(
  args: string[],
  scanner: Scanner = () =>
    Promise.resolve({ status: "unavailable", reason: "not installed in tests" }),
) {
  let stdout = "";
  let stderr = "";
  const deps: Dependencies = { scanner, imageDecoder: sharpDecoder };
  const status = await run(
    args,
    { stdout: (text) => (stdout += text), stderr: (text) => (stderr += text) },
    deps,
  );
  return { status, stdout, stderr };
}

let work: string;
let bundle: string;

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), "openwaymark-cli-"));
  bundle = join(work, "anatomy.waymark");
  const packed = await cli(["pack", join(REPO, "examples/anatomy-basics"), "-o", bundle]);
  expect(packed.status).toBe(EXIT_OK);
});

describe("help and version", () => {
  it("prints help and succeeds with --help", async () => {
    const result = await cli(["--help"]);
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("Usage: openwaymark");
  });

  it("prints help but reports a usage error with no arguments", async () => {
    expect((await cli([])).status).toBe(EXIT_USAGE);
  });

  it("prints CLI and engine versions", async () => {
    const result = await cli(["--version"]);
    expect(result.stdout).toBe(`openwaymark ${CLI_VERSION} (engine ${ENGINE_VERSION})\n`);
  });

  it("rejects unknown commands, unknown options, and missing paths", async () => {
    expect((await cli(["frobnicate", "x"])).status).toBe(EXIT_USAGE);
    expect((await cli(["validate", "--bogus", "x"])).status).toBe(EXIT_USAGE);
    expect((await cli(["validate"])).status).toBe(EXIT_USAGE);
    expect((await cli(["validate", "a", "b"])).status).toBe(EXIT_USAGE);
  });

  it("keeps CLI_VERSION equal to the package version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(CLI_VERSION).toBe(pkg.version);
  });
});

describe("validate", () => {
  it("exits 0 for a conforming bundle, and says what that does not mean", async () => {
    const result = await cli(["validate", bundle]);
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("passed the configured checks");
    expect(result.stdout).toContain("does not mean it is safe");
  });

  it("exits 1 and names the rule for a malicious archive", async () => {
    const result = await cli(["validate", join(FIXTURES, "zip-traversal/input.waymark")]);
    expect(result.status).toBe(EXIT_NOT_CONFORMING);
    expect(result.stdout).toContain("OWM-PATH-001");
  });

  it("prints the engine report as JSON with --json", async () => {
    const result = await cli([
      "validate",
      "--json",
      join(FIXTURES, "image-spoofed-type/input.waymark"),
    ]);
    const report = JSON.parse(result.stdout) as {
      conformance: string;
      diagnostics: { rule: string }[];
    };
    expect(report.conformance).toBe("not-conforming");
    expect(report.diagnostics.map((d) => d.rule)).toContain("OWM-IMG-007");
  });

  it("exits 3 when the file cannot be read", async () => {
    expect((await cli(["validate", join(work, "missing.waymark")])).status).toBe(EXIT_IO);
  });
});

describe("validating a folder", () => {
  it("packs the folder in memory and validates it", async () => {
    const result = await cli(["validate", join(REPO, "examples/biology-terms")]);
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("passed the configured checks");
  });

  it("explains that a lone YAML file is not a bundle (OWM-PKG-001)", async () => {
    const result = await cli(["validate", join(REPO, "examples/biology-terms/study.yaml")]);
    expect(result.status).toBe(EXIT_NOT_CONFORMING);
    expect(result.stdout).toContain("OWM-PKG-001");
    expect(result.stdout).toContain("put it in a folder and pack the folder");
  });
});

describe("lint", () => {
  const ambiguous = join(FIXTURES, "lint-yaml11-ambiguous/input.waymark");

  it("reports warnings but succeeds", async () => {
    const result = await cli(["lint", ambiguous]);
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("OWM-LINT-012");
  });

  it("fails on warnings with --warnings-as-errors", async () => {
    expect((await cli(["lint", "--warnings-as-errors", ambiguous])).status).toBe(
      EXIT_NOT_CONFORMING,
    );
  });
});

describe("inspect", () => {
  it("describes the contents", async () => {
    const result = await cli(["inspect", bundle]);
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toMatch(/questions:\s+4/);
    expect(result.stdout).toContain("integrity.json: present, every file matches");
    expect(result.stdout).toContain("assets/heart-chambers.png  PNG 800 × 860");
  });

  it("includes assets in JSON output", async () => {
    const report = JSON.parse((await cli(["inspect", "--json", bundle])).stdout) as {
      assets: { path: string }[];
    };
    expect(report.assets.map((asset) => asset.path)).toContain("assets/blood-flow.webp");
  });
});

describe("scan", () => {
  it("exits 4 when no scanner is available, and never claims a clean result", async () => {
    const result = await cli(["scan", bundle]);
    expect(result.status).toBe(EXIT_INCOMPLETE);
    expect(result.stdout).toContain("malware scan: not performed");
    expect(result.stdout).not.toMatch(/malware-free|no threats detected/);
  });

  it("exits 0 when the scanner detects nothing, and says so precisely", async () => {
    const result = await cli(["scan", bundle], () =>
      Promise.resolve({ status: "clean", engine: "ClamAV 1.4.0" }),
    );
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("no threats detected by ClamAV 1.4.0");
  });

  it("exits 5 when the scanner detects a threat", async () => {
    const result = await cli(["scan", bundle], () =>
      Promise.resolve({ status: "threats", engine: "ClamAV", threats: ["Eicar-Signature"] }),
    );
    expect(result.status).toBe(EXIT_THREAT);
    expect(result.stdout).toContain("Eicar-Signature");
  });
});

describe("pack", () => {
  it("writes a bundle with integrity.json by default", async () => {
    const out = join(work, "net.waymark");
    const result = await cli(["pack", join(REPO, "examples/networking-fundamentals"), "-o", out]);
    expect(result.status).toBe(EXIT_OK);
    expect(readFileSync(out).includes(Buffer.from("integrity.json"))).toBe(true);
  });

  it("leaves out integrity.json with --no-integrity", async () => {
    const out = join(work, "net-plain.waymark");
    await cli([
      "pack",
      "--no-integrity",
      join(REPO, "examples/networking-fundamentals"),
      "-o",
      out,
    ]);
    expect(readFileSync(out).includes(Buffer.from("integrity.json"))).toBe(false);
  });

  it("writes nothing and exits 1 when the folder is not a valid bundle", async () => {
    const folder = join(work, "broken");
    mkdirSync(folder);
    writeFileSync(join(folder, "study.yaml"), 'format_version: "0.1"\ntitle: Missing fields\n');
    const out = join(work, "broken.waymark");
    const result = await cli(["pack", folder, "-o", out]);
    expect(result.status).toBe(EXIT_NOT_CONFORMING);
    expect(result.stdout).toContain("Nothing was written");
    expect(existsSync(out)).toBe(false);
  });

  it("refuses symbolic links instead of following them", async () => {
    const folder = join(work, "linked");
    cpSync(join(REPO, "examples/networking-fundamentals"), folder, { recursive: true });
    symlinkSync("/etc/hostname", join(folder, "assets", "secret.png"));
    const result = await cli(["pack", folder, "-o", join(work, "linked.waymark")]);
    expect(result.status).toBe(EXIT_IO);
    expect(result.stderr).toContain("symbolic link");
  });
});
