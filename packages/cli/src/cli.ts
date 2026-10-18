// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The openwaymark command line. `run` takes the arguments and returns the exit
// status instead of exiting, so tests can call it directly. Exit statuses are
// part of the interface, so scripts can rely on them:
//
//   0  success (conforming, and anything else the command checks)
//   1  the bundle is not conforming (or, with --warnings-as-errors, has warnings)
//   2  the command line could not be understood
//   3  the input could not be read or written
//   4  no errors, but a required check could not be performed
//   5  the malware scanner detected a threat

import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import {
  bytesSource,
  ENGINE_VERSION,
  packBundle,
  validateBundle,
  type ImageDecoder,
  type Report,
  type ValidationResult,
} from "@openwaymark/engine";
import { sharpDecoder } from "./decoder.js";
import { openFileSource, readFolder } from "./files.js";
import { formatDiagnostics, formatScan, formatSummary, formatVerdict } from "./format.js";
import { clamscan, type Scanner, type ScanResult } from "./scan.js";
import { CLI_VERSION } from "./version.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

/** Replaceable parts, so tests can supply a fake scanner or decoder. */
export interface Dependencies {
  scanner: Scanner;
  imageDecoder: ImageDecoder;
}

export const EXIT_OK = 0;
export const EXIT_NOT_CONFORMING = 1;
export const EXIT_USAGE = 2;
export const EXIT_IO = 3;
export const EXIT_INCOMPLETE = 4;
export const EXIT_THREAT = 5;

const USAGE = `Usage: openwaymark <command> [options] <path>

Commands:
  validate <bundle>   Check that a bundle conforms to the OpenWaymark format
  lint <bundle>       Validate, and also report likely mistakes as warnings
  inspect <bundle>    Validate, and describe what the bundle contains
  scan <bundle>       Validate, and scan for malware with a local ClamAV
  pack <folder>       Make a .waymark bundle from a folder with study.yaml

Options:
  --json                    Print a machine-readable JSON report
  --warnings-as-errors      (lint) Exit with status 1 if there are warnings
  -o, --output <file>       (pack) Where to write the bundle (default: <folder>.waymark)
  --no-integrity            (pack) Leave out integrity.json
  --max-diagnostics <n>     List at most n problems (default 500)
  -h, --help                Show this help
  --version                 Show the CLI and engine versions

Exit status: 0 success, 1 not conforming, 2 usage error, 3 read or write
error, 4 a required check could not run, 5 malware detected.
`;

function exitFor(report: Report): number {
  if (report.conformance === "not-conforming") return EXIT_NOT_CONFORMING;
  return report.conformance === "incomplete" ? EXIT_INCOMPLETE : EXIT_OK;
}

async function validateFile(
  path: string,
  lint: boolean,
  maxDiagnostics: number,
  deps: Dependencies,
): Promise<ValidationResult> {
  const source = await openFileSource(path);
  try {
    return await validateBundle(source, { imageDecoder: deps.imageDecoder, lint, maxDiagnostics });
  } finally {
    await source.close();
  }
}

/** Runs the CLI with the given arguments and returns the process exit status. */
export async function run(
  args: readonly string[],
  io: Io,
  deps: Dependencies = { scanner: clamscan, imageDecoder: sharpDecoder },
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: {
        json: { type: "boolean" },
        "warnings-as-errors": { type: "boolean" },
        output: { type: "string", short: "o" },
        "no-integrity": { type: "boolean" },
        "max-diagnostics": { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean" },
      },
    });
  } catch (error) {
    io.stderr(`openwaymark: ${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  const { values, positionals } = parsed;
  if (values.version) {
    io.stdout(`openwaymark ${CLI_VERSION} (engine ${ENGINE_VERSION})\n`);
    return EXIT_OK;
  }
  const [command, path, ...extra] = positionals;
  if (values.help || command === "help") {
    io.stdout(USAGE);
    return EXIT_OK;
  }
  if (command === undefined) {
    io.stdout(USAGE);
    return EXIT_USAGE;
  }
  if (!["validate", "lint", "inspect", "scan", "pack"].includes(command)) {
    io.stderr(`openwaymark: unknown command or option '${command}'\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (path === undefined || extra.length > 0) {
    io.stderr(
      `openwaymark: ${command} needs exactly one ${command === "pack" ? "folder" : "bundle file"}.\n\n${USAGE}`,
    );
    return EXIT_USAGE;
  }
  const maxDiagnostics =
    values["max-diagnostics"] === undefined ? 500 : Number(values["max-diagnostics"]);
  if (!Number.isInteger(maxDiagnostics) || maxDiagnostics < 0) {
    io.stderr("openwaymark: --max-diagnostics needs a whole number.\n");
    return EXIT_USAGE;
  }
  const json = values.json ?? false;
  const print = (text: string, report: unknown) => {
    io.stdout(json ? `${JSON.stringify(report, null, 2)}\n` : text);
  };

  if (command === "pack")
    return pack(
      path,
      values.output,
      !(values["no-integrity"] ?? false),
      maxDiagnostics,
      json,
      io,
      deps,
    );

  let result: ValidationResult;
  try {
    result = await validateFile(path, command === "lint", maxDiagnostics, deps);
  } catch (error) {
    io.stderr(
      `openwaymark: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return EXIT_IO;
  }
  const { report } = result;
  const text = formatVerdict(path, report) + formatDiagnostics(report);

  if (command === "validate") {
    print(text, report);
    return exitFor(report);
  }
  if (command === "lint") {
    print(text, report);
    const status = exitFor(report);
    return status === EXIT_OK && values["warnings-as-errors"] && report.warnings > 0
      ? EXIT_NOT_CONFORMING
      : status;
  }
  if (command === "inspect") {
    // Image details exist only for a conforming bundle, whose content was fully read.
    const bundle = result.bundle;
    const assets = bundle
      ? [...bundle.assetInfo].map(([assetPath, info]) => ({
          path: assetPath,
          format: info.format,
          width: info.width,
          height: info.height,
          bytes: bundle.assets.get(assetPath)?.length ?? 0,
        }))
      : [];
    print(text + formatSummary(report, assets), { ...report, assets });
    return exitFor(report);
  }

  // scan: a malware scan in addition to validation (OWM-VAL-004). The scan runs
  // even when the bundle is not conforming, because a malformed file is exactly
  // the kind someone might want scanned.
  const scan: ScanResult = await deps.scanner(path);
  print(text + formatScan(scan), { ...report, malwareScan: scan });
  if (scan.status === "threats") return EXIT_THREAT;
  const status = exitFor(report);
  if (status !== EXIT_OK) return status;
  return scan.status === "clean" ? EXIT_OK : EXIT_INCOMPLETE;
}

async function pack(
  folder: string,
  output: string | undefined,
  integrity: boolean,
  maxDiagnostics: number,
  json: boolean,
  io: Io,
  deps: Dependencies,
): Promise<number> {
  let files;
  try {
    files = await readFolder(folder);
  } catch (error) {
    io.stderr(
      `openwaymark: cannot read ${folder}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return EXIT_IO;
  }
  const { archive, skipped } = packBundle(files, { integrity });
  const { report } = await validateBundle(bytesSource(archive), {
    imageDecoder: deps.imageDecoder,
    maxDiagnostics,
  });
  const target = output ?? `${folder.replace(/[/\\]+$/, "")}.waymark`;
  const notes = skipped.map((name) => `  left out: ${name}\n`).join("");
  if (report.conformance !== "conforming") {
    const text = `${formatVerdict(basename(target), report)}${formatDiagnostics(report)}${notes}  Nothing was written. Fix the problems above and pack again.\n`;
    io.stdout(json ? `${JSON.stringify({ ...report, written: false, skipped }, null, 2)}\n` : text);
    return exitFor(report);
  }
  try {
    await writeFile(target, archive);
  } catch (error) {
    io.stderr(
      `openwaymark: cannot write ${target}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return EXIT_IO;
  }
  const text = `Wrote ${target} (${archive.length} bytes${integrity ? ", with integrity.json" : ""}).\n${formatVerdict(basename(target), report)}${formatDiagnostics(report)}${notes}`;
  io.stdout(json ? `${JSON.stringify({ ...report, written: target, skipped }, null, 2)}\n` : text);
  return EXIT_OK;
}
