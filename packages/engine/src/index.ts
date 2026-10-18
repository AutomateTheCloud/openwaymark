// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Reference validation engine for OpenWaymark study bundles.
 *
 * The engine runs unchanged in Node (the CLI) and in a browser Web Worker
 * (the Waymark Study importer), so it may use only standard ECMAScript APIs.
 * Node built-ins are rejected by lint, and Node globals by the typechecker.
 */

/** Engine release version. Kept equal to `version` in package.json by test. */
export const ENGINE_VERSION = "0.0.0";
