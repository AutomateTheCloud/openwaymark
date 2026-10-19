// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Full image decoding for the CLI (OWM-IMG-009), using sharp (libvips). The
// engine has already checked the declared dimensions against the limits, so
// sharp's own pixel limit is a second line of defense, not the first.

import sharp from "sharp";
import type { ImageDecoder } from "@automatethecloud/openwaymark-engine";
import { LIMITS } from "@automatethecloud/openwaymark-engine";

export const sharpDecoder: ImageDecoder = {
  name: `sharp ${sharp.versions.sharp} (libvips ${sharp.versions.vips})`,
  async decode(bytes) {
    const { info } = await sharp(bytes, { limitInputPixels: LIMITS.imagePixels, failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height };
  },
};
