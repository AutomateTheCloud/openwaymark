// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Reference validation engine for OpenWaymark study bundles.
 *
 * The engine runs unchanged in Node (the CLI) and in a browser Web Worker
 * (the Waymark Study importer and the browser validator), so it may use only
 * standard ECMAScript APIs. Node built-ins are rejected by lint, and Node
 * globals by the typechecker. Platform work, such as reading files and
 * decoding images, is supplied by the caller.
 */

export { bytesSource, sha256Hex, type ByteSource } from "./bytes.js";
export { canonicalJson, contentFingerprint } from "./fingerprint.js";
export { gradeResponse, meetsPassingPercentage, type Grade } from "./grading.js";
export { inspectImage, sniffFormat, type ImageDecoder, type ImageInfo } from "./images.js";
export { LIMITS } from "./limits.js";
export { checkMarkdown, parseMarkdown } from "./markdown.js";
export { SUPPORTED_FORMAT_VERSIONS } from "./manifest.js";
export { packBundle, type PackFile, type PackResult } from "./pack.js";
export { isIgnorable } from "./paths.js";
export type {
  BundleSummary,
  CheckId,
  CheckRecord,
  CheckStatus,
  Conformance,
  Diagnostic,
  Location,
  Report,
  Severity,
} from "./report.js";
export {
  ENGINE_VERSION,
  validateBundle,
  ValidationCanceled,
  type ValidateOptions,
  type ValidatedBundle,
  type ValidationResult,
} from "./validate.js";
export type { Mapping, Value } from "./yaml.js";
