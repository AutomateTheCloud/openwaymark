// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXIT_USAGE, run } from "../src/cli.js";
import { CLI_VERSION } from "../src/version.js";

function capture(args: string[]) {
  let stdout = "";
  let stderr = "";
  const status = run(args, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { status, stdout, stderr };
}

describe("openwaymark CLI", () => {
  it("prints help and succeeds with --help", () => {
    const result = capture(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: openwaymark");
    expect(result.stderr).toBe("");
  });

  it("prints help but reports a usage error with no arguments", () => {
    const result = capture([]);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stdout).toContain("Usage: openwaymark");
  });

  it("prints CLI and engine versions with --version", () => {
    const result = capture(["--version"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("openwaymark 0.0.0 (engine 0.0.0)\n");
  });

  it("rejects an unknown command on stderr with a usage error", () => {
    const result = capture(["frobnicate"]);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown command or option 'frobnicate'");
  });

  it("keeps CLI_VERSION equal to the package version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(CLI_VERSION).toBe(pkg.version);
  });
});
