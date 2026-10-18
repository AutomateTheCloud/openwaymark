// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Image inspection (spec section 10.2 and 10.3). Headers are parsed without
// decoding, so the format, dimensions, animation, and metadata are known
// before any large allocation (OWM-IMG-010). Full decoding is delegated to a
// platform decoder supplied by the caller (OWM-IMG-009).

import { Unzlib } from "fflate";
import { ascii, crc32, u16, u16be, u32, u32be } from "./bytes.js";
import type { ImageFormat } from "./paths.js";

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
  animated: boolean;
  /** Exif orientation (1 to 8), when an orientation tag is present. */
  orientation?: number;
  /** Whether Exif metadata includes a GPS information block. */
  hasGps: boolean;
}

export type InspectResult = { ok: true; info: ImageInfo } | { ok: false; reason: string };

/** Decodes an image fully and reports its dimensions, or throws if it cannot. */
export interface ImageDecoder {
  /** A short name for reports, such as "sharp 0.35" or "browser createImageBitmap". */
  readonly name: string;
  decode(bytes: Uint8Array, format: ImageFormat): Promise<{ width: number; height: number }>;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function sniffFormat(bytes: Uint8Array): ImageFormat | undefined {
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  return undefined;
}

export function inspectImage(bytes: Uint8Array): InspectResult {
  const format = sniffFormat(bytes);
  if (format === "png") return inspectPng(bytes);
  if (format === "jpeg") return inspectJpeg(bytes);
  if (format === "webp") return inspectWebp(bytes);
  return { ok: false, reason: "is not a PNG, JPEG, or WebP image" };
}

function inspectPng(bytes: Uint8Array): InspectResult {
  if (bytes.length < 33 || ascii(bytes, 12, 4) !== "IHDR")
    return { ok: false, reason: "is a truncated PNG" };
  const info: ImageInfo = {
    format: "png",
    width: u32be(bytes, 16),
    height: u32be(bytes, 20),
    animated: false,
    hasGps: false,
  };
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    if (offset + 12 + length > bytes.length)
      return { ok: false, reason: `has a truncated ${type} chunk` };
    if (type === "acTL") info.animated = true;
    if (type === "eXIf") readExif(bytes.subarray(offset + 8, offset + 8 + length), info);
    offset += 12 + length;
    if (type === "IEND") return { ok: true, info };
  }
  return { ok: false, reason: "is a PNG without an IEND chunk" };
}

function inspectJpeg(bytes: Uint8Array): InspectResult {
  let offset = 2;
  let size: { width: number; height: number } | undefined;
  const info: ImageInfo = { format: "jpeg", width: 0, height: 0, animated: false, hasGps: false };
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return { ok: false, reason: "has a malformed JPEG marker" };
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image, or start of scan
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    const length = u16be(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length)
      return { ok: false, reason: "has a truncated JPEG segment" };
    const segment = bytes.subarray(offset + 4, offset + 2 + length);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof && segment.length >= 5)
      size = { height: u16be(segment, 1), width: u16be(segment, 3) };
    if (marker === 0xe1 && ascii(segment, 0, 6) === "Exif\0\0") readExif(segment.subarray(6), info);
    offset += 2 + length;
  }
  if (!size) return { ok: false, reason: "is a JPEG without a frame header" };
  info.width = size.width;
  info.height = size.height;
  return { ok: true, info };
}

function inspectWebp(bytes: Uint8Array): InspectResult {
  if (u32(bytes, 4) + 8 !== bytes.length)
    return { ok: false, reason: "is a WebP file whose RIFF size does not match its length" };
  const info: ImageInfo = { format: "webp", width: 0, height: 0, animated: false, hasGps: false };
  let offset = 12;
  let haveSize = false;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = u32(bytes, offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (data.length !== length)
      return { ok: false, reason: `has a truncated ${type.trim()} chunk` };
    if (type === "VP8X" && length >= 10) {
      if ((data[0] ?? 0) & 0x02) info.animated = true;
      info.width = 1 + ((data[4] ?? 0) | ((data[5] ?? 0) << 8) | ((data[6] ?? 0) << 16));
      info.height = 1 + ((data[7] ?? 0) | ((data[8] ?? 0) << 8) | ((data[9] ?? 0) << 16));
      haveSize = true;
    } else if (type === "VP8 " && length >= 10 && !haveSize) {
      if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a)
        return { ok: false, reason: "has an invalid VP8 frame header" };
      info.width = u16(data, 6) & 0x3fff;
      info.height = u16(data, 8) & 0x3fff;
      haveSize = true;
    } else if (type === "VP8L" && length >= 5 && !haveSize) {
      if (data[0] !== 0x2f) return { ok: false, reason: "has an invalid VP8L signature" };
      const bits = u32(data, 1);
      info.width = 1 + (bits & 0x3fff);
      info.height = 1 + ((bits >>> 14) & 0x3fff);
      haveSize = true;
    } else if (type === "ANIM" || type === "ANMF") {
      info.animated = true;
    } else if (type === "EXIF") {
      readExif(data, info);
    }
    offset += 8 + length + (length % 2);
  }
  if (!haveSize) return { ok: false, reason: "is a WebP file without image data" };
  return { ok: true, info };
}

/** Reads the orientation tag and the presence of a GPS block from a TIFF-structured Exif block. */
function readExif(tiff: Uint8Array, info: ImageInfo): void {
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return;
  const little = order === "II";
  const read16 = (offset: number) => (little ? u16(tiff, offset) : u16be(tiff, offset));
  const read32 = (offset: number) => (little ? u32(tiff, offset) : u32be(tiff, offset));
  if (read16(2) !== 42) return;
  const ifd = read32(4);
  const count = read16(ifd);
  for (let index = 0; index < count && ifd + 2 + index * 12 + 12 <= tiff.length; index++) {
    const entry = ifd + 2 + index * 12;
    const tag = read16(entry);
    if (tag === 0x0112) info.orientation = read16(entry + 8);
    if (tag === 0x8825) info.hasGps = true;
  }
}

/**
 * Structural checks that do not depend on a platform decoder, so that every
 * reader rejects the same damaged images. Browser decoders are often lenient,
 * drawing a damaged image as blank or partial rather than failing, so a full
 * decode alone would let some damage through in some browsers.
 *
 * PNG: every chunk's CRC-32 must match, and the compressed pixel data must
 * inflate to exactly the size the header implies. JPEG: an end-of-image marker
 * must follow the scan data. Returns a problem, or undefined if none is found.
 */
export function verifyImageStructure(bytes: Uint8Array, info: ImageInfo): string | undefined {
  if (info.format === "png") return verifyPng(bytes, info);
  if (info.format === "jpeg") return verifyJpeg(bytes);
  return undefined; // WebP chunk sizes are already checked by inspectImage.
}

const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

/** Size of the filtered pixel data the header implies, including Adam7 interlacing. */
function pngRawSize(
  width: number,
  height: number,
  bitsPerPixel: number,
  interlaced: boolean,
): number {
  const rowBytes = (w: number) => Math.ceil((w * bitsPerPixel) / 8);
  if (!interlaced) return height * (1 + rowBytes(width));
  // Adam7 passes: [x start, y start, x step, y step].
  const passes = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
  ] as const;
  let total = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const w = Math.ceil((width - x0) / dx);
    const h = Math.ceil((height - y0) / dy);
    if (w > 0 && h > 0) total += h * (1 + rowBytes(w));
  }
  return total;
}

function verifyPng(bytes: Uint8Array, info: ImageInfo): string | undefined {
  const bitDepth = bytes[24] ?? 0;
  const colorType = bytes[25] ?? 0;
  const interlace = bytes[28] ?? 0;
  const channels = PNG_CHANNELS[colorType];
  if (
    channels === undefined ||
    !(PNG_DEPTHS[colorType] ?? []).includes(bitDepth) ||
    interlace > 1
  ) {
    return "has an invalid PNG header (color type, bit depth, or interlace method)";
  }
  const expected = pngRawSize(info.width, info.height, channels * bitDepth, interlace === 1);
  let produced = 0;
  let failed = false;
  const inflater = new Unzlib();
  inflater.ondata = (chunk) => {
    produced += chunk.length;
  };
  let offset = 8;
  let sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== u32be(bytes, end - 4))
      return `has a ${type} chunk whose CRC does not match`;
    if (type === "IDAT" && !failed) {
      sawData = true;
      const data = bytes.subarray(offset + 8, end - 4);
      try {
        for (let at = 0; at < data.length && produced <= expected; at += 4096)
          inflater.push(data.subarray(at, at + 4096));
      } catch {
        failed = true;
      }
    }
    if (type === "IEND") break;
    offset = end;
  }
  if (!sawData) return "has no image data (IDAT chunk)";
  try {
    if (!failed) inflater.push(new Uint8Array(0), true);
  } catch {
    failed = true;
  }
  if (failed) return "has compressed pixel data that is damaged";
  if (produced !== expected)
    return `has ${produced} bytes of pixel data where its header implies ${expected}`;
  return undefined;
}

function verifyJpeg(bytes: Uint8Array): string | undefined {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const marker = bytes[offset + 1] ?? 0;
    if (bytes[offset] !== 0xff) return "has a malformed JPEG marker";
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0xda) {
      // Scan data follows; it must end with an end-of-image marker (FF D9).
      for (let at = bytes.length - 2; at > offset; at--)
        if (bytes[at] === 0xff && bytes[at + 1] === 0xd9) return undefined;
      return "is truncated: no end-of-image marker follows its image data";
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    offset += 2 + u16be(bytes, offset + 2);
  }
  return "has no image data (start of scan)";
}
