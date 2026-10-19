// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Messages between the page and the validation worker. The worker does the
// heavy work, so the page stays responsive while a large bundle is checked.

import type { ImageInfo, Report } from "@automatethecloud/openwaymark-engine";

export type Request =
  { type: "validate"; file: File } | { type: "pack"; files: { path: string; file: File }[] };

export interface AssetSummary {
  path: string;
  info: ImageInfo;
  bytes: number;
}

export type Response =
  | { type: "validated"; name: string; report: Report; assets: AssetSummary[] }
  | { type: "packed"; report: Report; archive?: Uint8Array; skipped: string[] }
  | { type: "failed"; message: string };
