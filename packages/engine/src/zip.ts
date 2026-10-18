// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// ZIP archive profile (spec section 3.2). The central directory is parsed and
// checked against every local header, so that no two tools can disagree about
// what the archive contains. Entry data is decompressed in small chunks so
// that limits are enforced while streaming (OWM-LIM-002).

import { Inflate } from "fflate";
import { ascii, crc32, type ByteSource, u16, u32 } from "./bytes.js";
import { LIMITS } from "./limits.js";
import type { ReportBuilder } from "./report.js";

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const DESCRIPTOR_SIGNATURE = 0x08074b50;
const EXTRA_ZIP64 = 0x0001;
const EXTRA_UNICODE_PATH = 0x7075;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_DESCRIPTOR = 0x0008;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const UNIX_HOST = 3;
const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
/** Compressed bytes per inflate step: bounds the output of one step to about 4 MiB. */
const READ_CHUNK = 4096;

export interface ZipEntry {
  /** The raw name, decoded as Latin-1 so that every byte is visible in messages. */
  name: string;
  nameBytes: Uint8Array;
  isDirectory: boolean;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  /** Offset of the entry's compressed data, known after the local header is read. */
  dataOffset: number;
  versionMadeBy: number;
  externalAttributes: number;
}

export interface ZipDirectory {
  entries: ZipEntry[];
  /** False when the archive is too damaged to read entry data reliably. */
  readable: boolean;
}

async function readFully(source: ByteSource, offset: number, length: number): Promise<Uint8Array> {
  const bytes = await source.read(offset, length);
  return bytes.length === length ? bytes : bytes.slice();
}

function extraFieldIds(extra: Uint8Array): number[] | undefined {
  const ids: number[] = [];
  let offset = 0;
  while (offset + 4 <= extra.length) {
    ids.push(u16(extra, offset));
    offset += 4 + u16(extra, offset + 2);
  }
  return offset === extra.length ? ids : undefined;
}

function checkExtra(extra: Uint8Array, entry: string, report: ReportBuilder): void {
  const ids = extraFieldIds(extra);
  if (!ids) {
    report.add("OWM-PKG-006", `The extra field of ${entry} is malformed.`, { entry });
    return;
  }
  if (ids.includes(EXTRA_ZIP64)) {
    report.add("OWM-PKG-003", `${entry} uses a ZIP64 extra field, which is not permitted.`, {
      entry,
    });
  }
  if (ids.includes(EXTRA_UNICODE_PATH)) {
    report.add(
      "OWM-PKG-011",
      `${entry} has an Info-ZIP Unicode Path extra field, which is not permitted.`,
      {
        entry,
      },
    );
  }
}

/** Finds the end of central directory record, which must end the file apart from its comment. */
function findEocd(tail: Uint8Array, tailStart: number, size: number): number | undefined {
  for (let offset = tail.length - 22; offset >= 0; offset--) {
    if (
      u32(tail, offset) === EOCD_SIGNATURE &&
      tailStart + offset + 22 + u16(tail, offset + 20) === size
    ) {
      return offset;
    }
  }
  return undefined;
}

/** Reads and checks the archive structure. Returns undefined when it cannot be read at all. */
export async function readZipDirectory(
  source: ByteSource,
  report: ReportBuilder,
): Promise<ZipDirectory | undefined> {
  const size = source.size;
  if (size > LIMITS.archiveBytes) {
    report.add("OWM-LIM-001", `The archive is ${size} bytes; the limit is ${LIMITS.archiveBytes}.`);
    return undefined;
  }
  const tailLength = Math.min(size, 22 + 0xffff);
  const tailStart = size - tailLength;
  const tail = await readFully(source, tailStart, tailLength);
  const eocdInTail = findEocd(tail, tailStart, size);
  if (eocdInTail === undefined) {
    report.add(
      "OWM-PKG-002",
      "No end of central directory record ends the file. The archive is damaged, or has data appended.",
    );
    return undefined;
  }
  const eocdOffset = tailStart + eocdInTail;
  if (eocdInTail >= 20 && u32(tail, eocdInTail - 20) === ZIP64_LOCATOR_SIGNATURE) {
    report.add("OWM-PKG-003", "The archive uses ZIP64 records, which are not permitted.");
    return undefined;
  }
  const disk = u16(tail, eocdInTail + 4);
  const cdDisk = u16(tail, eocdInTail + 6);
  const entriesOnDisk = u16(tail, eocdInTail + 8);
  const totalEntries = u16(tail, eocdInTail + 10);
  const cdSize = u32(tail, eocdInTail + 12);
  const cdOffset = u32(tail, eocdInTail + 16);
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    report.add("OWM-PKG-003", "The archive uses ZIP64 values, which are not permitted.");
    return undefined;
  }
  if (disk !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
    report.add("OWM-PKG-002", "The archive spans more than one disk, which is not permitted.");
    return undefined;
  }
  if (totalEntries > LIMITS.entries) {
    report.add(
      "OWM-LIM-001",
      `The archive has ${totalEntries} entries; the limit is ${LIMITS.entries}.`,
    );
    return undefined;
  }
  if (cdOffset + cdSize !== eocdOffset) {
    report.add(
      "OWM-PKG-006",
      "The central directory does not end where the end record begins: the archive contains unaccounted bytes.",
    );
    return undefined;
  }

  const cd = await readFully(source, cdOffset, cdSize);
  const entries: ZipEntry[] = [];
  let offset = 0;
  for (let index = 0; index < totalEntries; index++) {
    if (offset + 46 > cd.length || u32(cd, offset) !== CENTRAL_SIGNATURE) {
      report.add("OWM-PKG-006", "The central directory is truncated or malformed.");
      return undefined;
    }
    const nameLength = u16(cd, offset + 28);
    const extraLength = u16(cd, offset + 30);
    const commentLength = u16(cd, offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > cd.length) {
      report.add("OWM-PKG-006", "The central directory is truncated.");
      return undefined;
    }
    const nameBytes = cd.slice(offset + 46, offset + 46 + nameLength);
    const name = ascii(nameBytes, 0, nameBytes.length);
    const entry: ZipEntry = {
      name,
      nameBytes,
      isDirectory: name.endsWith("/"),
      versionMadeBy: u16(cd, offset + 4),
      flags: u16(cd, offset + 8),
      method: u16(cd, offset + 10),
      crc: u32(cd, offset + 16),
      compressedSize: u32(cd, offset + 20),
      uncompressedSize: u32(cd, offset + 24),
      localOffset: u32(cd, offset + 42),
      externalAttributes: u32(cd, offset + 38),
      dataOffset: -1,
    };
    const diskStart = u16(cd, offset + 34);
    checkCentralEntry(
      entry,
      diskStart,
      cd.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength),
      report,
    );
    entries.push(entry);
    offset = end;
  }
  if (offset !== cd.length) {
    report.add("OWM-PKG-006", "The central directory has trailing bytes.");
    return undefined;
  }

  const readable = await checkLocalHeaders(source, entries, cdOffset, report);
  return { entries, readable };
}

function checkCentralEntry(
  entry: ZipEntry,
  diskStart: number,
  extra: Uint8Array,
  report: ReportBuilder,
): void {
  const at = { entry: entry.name };
  if (entry.flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION) || entry.method === 99) {
    report.add("OWM-PKG-004", `${entry.name} is encrypted, which is not permitted.`, at);
  } else if (entry.method !== 0 && entry.method !== 8) {
    report.add(
      "OWM-PKG-005",
      `${entry.name} uses compression method ${entry.method}; only 0 (stored) and 8 (deflate) are permitted.`,
      at,
    );
  }
  if (diskStart !== 0) report.add("OWM-PKG-002", `${entry.name} starts on another disk.`, at);
  if (
    entry.compressedSize === 0xffffffff ||
    entry.uncompressedSize === 0xffffffff ||
    entry.localOffset === 0xffffffff
  ) {
    report.add("OWM-PKG-003", `${entry.name} uses ZIP64 values, which are not permitted.`, at);
  }
  checkExtra(extra, entry.name, report);
  if (entry.versionMadeBy >> 8 === UNIX_HOST) {
    const type = (entry.externalAttributes >>> 16) & S_IFMT;
    if (type !== 0 && type !== S_IFREG && type !== S_IFDIR) {
      report.add(
        "OWM-PKG-009",
        `${entry.name} is a symbolic link or special file, which is not permitted.`,
        at,
      );
    }
    if (type === S_IFDIR && !entry.isDirectory) {
      report.add(
        "OWM-PKG-009",
        `${entry.name} is marked as a directory but its name does not end in "/".`,
        at,
      );
    }
  }
  if (entry.isDirectory && entry.uncompressedSize !== 0) {
    report.add("OWM-PKG-010", `Directory entry ${entry.name} has nonzero size.`, at);
  }
  if (entry.method === 0 && entry.compressedSize !== entry.uncompressedSize) {
    report.add(
      "OWM-PKG-007",
      `${entry.name} is stored but its compressed and uncompressed sizes differ.`,
      at,
    );
  }
}

async function checkLocalHeaders(
  source: ByteSource,
  entries: ZipEntry[],
  cdOffset: number,
  report: ReportBuilder,
): Promise<boolean> {
  let readable = true;
  const spans: { start: number; end: number; name: string }[] = [];
  for (const entry of entries) {
    const at = { entry: entry.name };
    if (entry.localOffset + 30 > cdOffset) {
      report.add(
        "OWM-PKG-006",
        `The local header of ${entry.name} lies outside the entry data area.`,
        at,
      );
      readable = false;
      continue;
    }
    const header = await readFully(source, entry.localOffset, 30);
    if (u32(header, 0) !== LOCAL_SIGNATURE) {
      report.add(
        "OWM-PKG-006",
        `No local header is found where the central directory places ${entry.name}.`,
        at,
      );
      readable = false;
      continue;
    }
    const nameLength = u16(header, 26);
    const extraLength = u16(header, 28);
    const rest = await readFully(source, entry.localOffset + 30, nameLength + extraLength);
    const localName = rest.subarray(0, nameLength);
    const sameName =
      localName.length === entry.nameBytes.length &&
      localName.every((byte, i) => byte === entry.nameBytes[i]);
    const flags = u16(header, 6);
    const method = u16(header, 8);
    if (!sameName || flags !== entry.flags || method !== entry.method) {
      report.add(
        "OWM-PKG-007",
        `The local header of ${entry.name} disagrees with the central directory (name, flags, or method).`,
        at,
      );
      readable = false;
    }
    checkExtra(rest.subarray(nameLength), entry.name, report);
    entry.dataOffset = entry.localOffset + 30 + nameLength + extraLength;
    let end = entry.dataOffset + entry.compressedSize;
    if (flags & FLAG_DESCRIPTOR) {
      const descriptor = await readFully(source, end, 16);
      const start = u32(descriptor, 0) === DESCRIPTOR_SIGNATURE ? 4 : 0;
      if (
        u32(descriptor, start) !== entry.crc ||
        u32(descriptor, start + 4) !== entry.compressedSize ||
        u32(descriptor, start + 8) !== entry.uncompressedSize
      ) {
        report.add(
          "OWM-PKG-007",
          `The data descriptor of ${entry.name} disagrees with the central directory.`,
          at,
        );
      }
      end += start + 12;
    } else if (
      u32(header, 14) !== entry.crc ||
      u32(header, 18) !== entry.compressedSize ||
      u32(header, 22) !== entry.uncompressedSize
    ) {
      report.add(
        "OWM-PKG-007",
        `The local header of ${entry.name} disagrees with the central directory (CRC or sizes).`,
        at,
      );
    }
    spans.push({ start: entry.localOffset, end, name: entry.name });
  }

  spans.sort((a, b) => a.start - b.start);
  let expected = 0;
  for (const span of spans) {
    if (span.start < expected) {
      report.add("OWM-PKG-006", `${span.name} overlaps the previous entry.`, { entry: span.name });
      readable = false;
    } else if (span.start > expected) {
      const where = expected === 0 ? "before the first entry" : `before ${span.name}`;
      report.add(
        "OWM-PKG-006",
        `The archive has ${span.start - expected} unaccounted bytes ${where}.`,
        { entry: span.name },
      );
    }
    expected = Math.max(expected, span.end);
  }
  if (spans.length > 0 && expected !== cdOffset) {
    report.add("OWM-PKG-006", "The archive has unaccounted bytes before the central directory.");
  }
  if (spans.length === 0 && cdOffset !== 0) {
    report.add("OWM-PKG-006", "The archive has unaccounted bytes before the central directory.");
  }
  return readable;
}

export type EntryReadResult = { ok: true; bytes: Uint8Array } | { ok: false };

/**
 * Decompresses one entry, stopping as soon as its output would exceed the
 * recorded size or `maxBytes`, and verifies its CRC-32 (OWM-PKG-008).
 */
export async function readZipEntry(
  source: ByteSource,
  entry: ZipEntry,
  maxBytes: number,
  report: ReportBuilder,
): Promise<EntryReadResult> {
  const at = { entry: entry.name };
  if (entry.dataOffset < 0 || entry.dataOffset + entry.compressedSize > source.size) {
    report.add("OWM-PKG-006", `The data of ${entry.name} lies outside the archive.`, at);
    return { ok: false };
  }
  const limit = Math.min(entry.uncompressedSize, maxBytes);
  const chunks: Uint8Array[] = [];
  let produced = 0;
  // An object, so the flag set inside the callback is visible to flow analysis.
  const state = { overflow: false };
  const accept = (chunk: Uint8Array) => {
    produced += chunk.length;
    if (produced > limit) state.overflow = true;
    else chunks.push(chunk);
  };
  const inflater = entry.method === 8 ? new Inflate() : undefined;
  if (inflater) {
    inflater.ondata = (chunk) => {
      accept(chunk);
    };
  }
  try {
    for (let offset = 0; offset < entry.compressedSize && !state.overflow; offset += READ_CHUNK) {
      const length = Math.min(READ_CHUNK, entry.compressedSize - offset);
      const piece = await readFully(source, entry.dataOffset + offset, length);
      const final = offset + length >= entry.compressedSize;
      if (inflater) inflater.push(piece, final);
      else accept(piece.slice());
    }
    if (inflater && entry.compressedSize === 0) inflater.push(new Uint8Array(0), true);
  } catch {
    report.add(
      "OWM-PKG-008",
      `${entry.name} could not be decompressed: its deflate data is invalid.`,
      at,
    );
    return { ok: false };
  }
  if (state.overflow) {
    if (produced > entry.uncompressedSize) {
      report.add(
        "OWM-PKG-007",
        `${entry.name} decompresses to more than its recorded size of ${entry.uncompressedSize} bytes.`,
        at,
      );
    } else {
      report.add("OWM-LIM-001", `${entry.name} exceeds the size limit of ${maxBytes} bytes.`, at);
    }
    return { ok: false };
  }
  if (produced !== entry.uncompressedSize) {
    report.add(
      "OWM-PKG-007",
      `${entry.name} decompresses to ${produced} bytes, not its recorded ${entry.uncompressedSize}.`,
      at,
    );
    return { ok: false };
  }
  let crc = 0;
  for (const chunk of chunks) crc = crc32(chunk, crc);
  if (crc !== entry.crc) {
    report.add("OWM-PKG-008", `The CRC-32 of ${entry.name} does not match its data.`, at);
    return { ok: false };
  }
  const bytes = new Uint8Array(produced);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return { ok: true, bytes };
}
