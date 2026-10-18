// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { ENGINE_VERSION } from "@openwaymark/engine";
import { CLI_VERSION } from "./version.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

/** Exit status for a command line that could not be understood. */
export const EXIT_USAGE = 2;

const USAGE = `Usage: openwaymark <command> [options]

Options:
  --help       Show this help
  --version    Show the CLI and engine versions

Commands are added as the specification is drafted:
validate, lint, inspect, scan, and pack.
`;

/** Runs the CLI with the given arguments and returns the process exit status. */
export function run(args: readonly string[], io: Io): number {
  const [first] = args;
  if (first === undefined || first === "--help" || first === "-h") {
    io.stdout(USAGE);
    return first === undefined ? EXIT_USAGE : 0;
  }
  if (first === "--version") {
    io.stdout(`openwaymark ${CLI_VERSION} (engine ${ENGINE_VERSION})\n`);
    return 0;
  }
  io.stderr(`openwaymark: unknown command or option '${first}'\n\n${USAGE}`);
  return EXIT_USAGE;
}
