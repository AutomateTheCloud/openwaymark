#!/usr/bin/env node
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Fails when a source file lacks the two-line copyright and SPDX header that
// Automate the Cloud's licensing playbook requires. A shebang line, if present,
// stays first. The year is not checked: each file keeps the year it was written.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs)$/i;
const COPYRIGHT = /^\/\/ Copyright \d{4} Automate the Cloud Inc\.$/;
const SPDX = "// SPDX-License-Identifier: Apache-2.0";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => path !== "" && SOURCE_FILE.test(path));

const missing = files.filter((path) => {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines[0]?.startsWith("#!") ? 1 : 0;
  return !(COPYRIGHT.test(lines[start] ?? "") && lines[start + 1] === SPDX);
});

if (missing.length > 0) {
  console.error(`Missing copyright/SPDX header (${missing.length}):\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`License header check passed (${files.length} files).`);
