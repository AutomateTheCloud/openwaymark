// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Type declarations for generate-fixtures.mjs, so TypeScript tests can import
// the plain JavaScript generator with types.

/** Every fixture file, keyed by its path relative to fixtures/. */
export function generateFixtures(): Map<string, Uint8Array>;
