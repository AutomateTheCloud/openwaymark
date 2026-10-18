// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Builds archive bundles that satisfy the ZIP profile (spec section 3.2):
// stored or deflate entries, no ZIP64, no extra fields, no data descriptors,
// no gaps. Output is deterministic: the manifest comes first, then the
// integrity file, then assets in sorted order, and every timestamp is
// 1980-01-01 00:00.

import { deflateSync } from "fflate";
import { crc32, encodeUtf8 } from "./bytes.js";
import { buildIntegrity, INTEGRITY_NAME } from "./integrity.js";
import { isIgnorable, isReservedSignature, MANIFEST_NAME } from "./paths.js";

export interface PackFile {
  /** Path inside the bundle, such as `study.yaml` or `assets/a.png`. */
  path: string;
  bytes: Uint8Array;
}

export interface PackOptions {
  /** Write integrity.json with a SHA-256 of every file (spec section 3.7). Default true. */
  integrity?: boolean;
}

export interface PackResult {
  archive: Uint8Array;
  /** Operating-system metadata files, and any old integrity.json, that were left out. */
  skipped: string[];
}

const DOS_DATE_1980_01_01 = 0x0021;

function packOrder(path: string): string {
  // Sort keys: control characters sort before every printable path, so the
  // manifest comes first and the integrity file second.
  return path === MANIFEST_NAME ? "\u0000" : path === INTEGRITY_NAME ? "\u0001" : path;
}

/** Packs files into a `.waymark` archive. Validate the result before sharing it. */
export function packBundle(files: readonly PackFile[], options: PackOptions = {}): PackResult {
  // An old integrity file or signature would describe the old content, so the
  // integrity file is always rebuilt and signatures are dropped.
  const skipped = files
    .filter(
      (file) =>
        isIgnorable(file.path) || isReservedSignature(file.path) || file.path === INTEGRITY_NAME,
    )
    .map((file) => file.path);
  const content = files.filter(
    (file) =>
      !isIgnorable(file.path) && !isReservedSignature(file.path) && file.path !== INTEGRITY_NAME,
  );
  const included = [...content];
  if (options.integrity ?? true) {
    const integrity = buildIntegrity(new Map(content.map((file) => [file.path, file.bytes])));
    included.push({ path: INTEGRITY_NAME, bytes: encodeUtf8(integrity) });
  }
  included.sort((a, b) => {
    const [x, y] = [packOrder(a.path), packOrder(b.path)];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of included) {
    const name = Uint8Array.from(file.path, (char) => char.charCodeAt(0) & 0xff);
    const deflated = deflateSync(file.bytes, { level: 9 });
    const stored = deflated.length >= file.bytes.length;
    const data = stored ? file.bytes : deflated;
    const crc = crc32(file.bytes);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, stored ? 0 : 8, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, DOS_DATE_1980_01_01, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, file.bytes.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    header.set(name, 30);
    const record = new Uint8Array(46 + name.length);
    const cd = new DataView(record.buffer);
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0, true);
    cd.setUint16(10, stored ? 0 : 8, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, DOS_DATE_1980_01_01, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, file.bytes.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    record.set(name, 46);
    local.push(header, data);
    central.push(record);
    offset += header.length + data.length;
  }
  const cdSize = central.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const eocd = new DataView(end.buffer);
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, included.length, true);
  eocd.setUint16(10, included.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);
  const archive = new Uint8Array(offset + cdSize + end.length);
  let position = 0;
  for (const part of [...local, ...central, end]) {
    archive.set(part, position);
    position += part.length;
  }
  return { archive, skipped };
}
