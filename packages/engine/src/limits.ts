// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Resource limits from spec section 11 and the per-field limits in sections
// 6 to 10. Bundles exceeding any of them are not conforming (OWM-LIM-001).

const MiB = 1024 * 1024;

export const LIMITS = {
  archiveBytes: 100 * MiB,
  entries: 2_000,
  totalUncompressedBytes: 256 * MiB,
  manifestBytes: 8 * MiB,
  assetBytes: 10 * MiB,
  /** Applies only to entries whose uncompressed size exceeds `ratioThresholdBytes`. */
  compressionRatio: 100,
  ratioThresholdBytes: 1 * MiB,
  yamlDepth: 32,
  yamlNodes: 1_000_000,
  items: 10_000,
  imageSide: 8_192,
  imagePixels: 25_000_000,
  textBytes: 65_536,
  titleChars: 200,
  plainNameChars: 200,
  referenceChars: 500,
  altChars: 1_000,
  creditChars: 500,
  licenseStatementChars: 2_000,
  spdxChars: 1_000,
  urlChars: 2_048,
  choicesMin: 2,
  choicesMax: 26,
  itemTags: 32,
  collectionTags: 64,
  tagChars: 64,
  authors: 32,
  sources: 64,
  references: 16,
  markdownNesting: 8,
  assetPathBytes: 255,
  assetSegments: 8,
} as const;
