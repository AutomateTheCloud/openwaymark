// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Optional malware scanning with a local ClamAV installation (spec
// OWM-VAL-004). Nothing is sent anywhere: clamscan reads the file on this
// computer. A scan only finds what the scanner's signatures know about, so a
// clean result is reported as "no threats detected by ClamAV", never "safe".

import { execFile } from "node:child_process";

export type ScanResult =
  | { status: "clean"; engine: string }
  | { status: "threats"; engine: string; threats: string[] }
  | { status: "unavailable"; reason: string }
  | { status: "error"; engine: string; reason: string };

export type Scanner = (path: string) => Promise<ScanResult>;

function run(
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string; missing: boolean }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { maxBuffer: 1024 * 1024, timeout: 10 * 60 * 1000 },
      (error, stdout, stderr) => {
        const missing = (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
        const code = error ? (typeof error.code === "number" ? error.code : null) : 0;
        resolve({ code, stdout, stderr, missing });
      },
    );
  });
}

/**
 * Scans a file with clamscan, which also looks inside ZIP archives. Exit
 * status 0 means nothing was found, 1 means something was, and anything else
 * is an error (ClamAV's documented convention).
 */
export const clamscan: Scanner = async (path) => {
  const version = await run("clamscan", ["--version"]);
  if (version.missing)
    return {
      status: "unavailable",
      reason: "clamscan was not found. Install ClamAV to scan bundles.",
    };
  const engine = version.stdout.trim() || "ClamAV";
  // --recursive scans every file when the bundle is still a folder.
  const result = await run("clamscan", [
    "--no-summary",
    "--infected",
    "--stdout",
    "--recursive",
    path,
  ]);
  if (result.code === 0) return { status: "clean", engine };
  if (result.code === 1) {
    const threats = result.stdout
      .split("\n")
      .filter((line) => line.endsWith(" FOUND"))
      .map((line) => line.slice(line.lastIndexOf(": ") + 2, -" FOUND".length));
    return { status: "threats", engine, threats };
  }
  return {
    status: "error",
    engine,
    reason:
      (result.stderr || result.stdout).trim() ||
      `clamscan exited with status ${String(result.code)}`,
  };
};
