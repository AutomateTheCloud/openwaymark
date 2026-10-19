// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The validation worker. It reads files with Blob.slice, so a large bundle is
// read piece by piece rather than all at once, and it decodes images with the
// browser's own decoder (createImageBitmap) for the full-decode check.

import {
  bytesSource,
  packBundle,
  validateBundle,
  type ByteSource,
  type ImageDecoder,
} from "@automatethecloud/openwaymark-engine";
import type { Request, Response } from "./protocol.js";

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;

const browserDecoder: ImageDecoder = {
  name: "browser createImageBitmap",
  async decode(bytes, format) {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: MIME[format] }));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  },
};

function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    async read(offset, length) {
      return new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
    },
  };
}

const post = (message: Response, transfer: Transferable[] = []) => {
  self.postMessage(message, { transfer });
};

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "validate") {
      const { report, bundle } = await validateBundle(blobSource(request.file), {
        imageDecoder: browserDecoder,
        lint: true,
      });
      const assets = bundle
        ? [...bundle.assetInfo].map(([path, info]) => ({
            path,
            info,
            bytes: bundle.assets.get(path)?.length ?? 0,
          }))
        : [];
      post({ type: "validated", name: request.file.name, report, assets });
      return;
    }
    const files = await Promise.all(
      request.files.map(async ({ path, file }) => ({
        path,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    const { archive, skipped } = packBundle(files);
    const { report } = await validateBundle(bytesSource(archive), {
      imageDecoder: browserDecoder,
      lint: true,
    });
    if (report.conformance === "conforming")
      post({ type: "packed", report, archive, skipped }, [archive.buffer]);
    else post({ type: "packed", report, skipped });
  } catch (error) {
    post({ type: "failed", message: error instanceof Error ? error.message : String(error) });
  }
};
