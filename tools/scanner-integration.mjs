#!/usr/bin/env node
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// End-to-end check of `openwaymark scan` against a real ClamAV, run in CI
// where ClamAV is installed. It packs a clean example and expects exit 0, then
// builds an archive and a folder containing the EICAR test file and expects
// exit 5 for each.
//
// EICAR is a harmless string that every antivirus product deliberately
// detects, so scanners can be tested without real malware. It is stored here
// base64-encoded, so that antivirus software does not flag this repository.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";

const EICAR = Buffer.from(
  "WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=",
  "base64",
);
const cli = join(import.meta.dirname, "../packages/cli/dist/main.js");
const work = mkdtempSync(join(tmpdir(), "openwaymark-scan-"));

const clean = join(work, "clean.waymark");
execFileSync("node", [cli, "pack", "examples/networking-fundamentals", "-o", clean], {
  stdio: "inherit",
});

const infected = join(work, "eicar.waymark");
writeFileSync(
  infected,
  zipSync({ "study.yaml": Buffer.from('format_version: "0.1"\n'), "assets/eicar.png": EICAR }),
);

// A bundle that is still a folder: the scanner must look inside it.
const infectedFolder = join(work, "eicar-folder");
mkdirSync(join(infectedFolder, "assets"), { recursive: true });
writeFileSync(join(infectedFolder, "study.yaml"), 'format_version: "0.1"\n');
writeFileSync(join(infectedFolder, "assets/eicar.png"), EICAR);

let failed = false;
for (const [file, expected] of [
  [clean, 0],
  [infected, 5],
  [infectedFolder, 5],
]) {
  const result = spawnSync("node", [cli, "scan", file], { encoding: "utf8" });
  process.stdout.write(result.stdout);
  if (result.status !== expected) {
    console.error(`Expected exit ${expected} for ${file}, got ${result.status}.`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
