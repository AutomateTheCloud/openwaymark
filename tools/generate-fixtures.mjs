#!/usr/bin/env node
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Generates the conformance fixtures in fixtures/. Each fixture is a directory
// holding one input (input.waymark, or input.bin for a file that is not a
// bundle at all) and expect.json. Output is
// deterministic, so `pnpm test` can check that the committed fixtures match.
//
// Malicious archives are built byte by byte, which is the only way to make
// the malformations the spec prohibits. Every fixture is small: the largest
// "bomb" is a few kilobytes on disk.
//
//     node tools/generate-fixtures.mjs

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync, zlibSync } from "fflate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const utf8 = (text) => new TextEncoder().encode(text);
/** Marks input that must stay exactly as given, not wrapped in an archive. */
const raw = (bytes) => ({ raw: bytes });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const le16 = (value) => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const le32 = (value) =>
  Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
const be32 = (value) =>
  Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);

/**
 * Writes a ZIP archive with full control over every field. An entry is
 * { name, data, method = 8, flags = 0, madeBy = 20, external = 0,
 *   localExtra, centralExtra, localName, crc, size, descriptor, after }.
 * `after` is bytes hidden after the entry's data, outside any entry.
 */
function zip(
  entries,
  { prefix = new Uint8Array(0), suffix = new Uint8Array(0), comment = "" } = {},
) {
  const local = [prefix];
  const central = [];
  let offset = prefix.length;
  for (const entry of entries) {
    const name = utf8(entry.name);
    const localName = utf8(entry.localName ?? entry.name);
    const data = entry.data ?? new Uint8Array(0);
    const method = entry.method ?? (entry.name.endsWith("/") ? 0 : 8);
    const compressed = method === 8 ? deflateSync(data, { level: 9 }) : data;
    const crc = entry.crc ?? crc32(data);
    const size = entry.size ?? data.length;
    const flags = (entry.flags ?? 0) | (entry.descriptor ? 0x0008 : 0);
    const localExtra = entry.localExtra ?? new Uint8Array(0);
    const centralExtra = entry.centralExtra ?? new Uint8Array(0);
    const header = concat([
      le32(0x04034b50),
      le16(20),
      le16(flags),
      le16(method),
      le16(0),
      le16(0x0021),
      le32(entry.descriptor ? 0 : crc),
      le32(entry.descriptor ? 0 : compressed.length),
      le32(entry.descriptor ? 0 : size),
      le16(localName.length),
      le16(localExtra.length),
      localName,
      localExtra,
    ]);
    const descriptor = entry.descriptor
      ? concat([le32(0x08074b50), le32(crc), le32(compressed.length), le32(size)])
      : new Uint8Array(0);
    central.push(
      concat([
        le32(0x02014b50),
        le16(entry.madeBy ?? 20),
        le16(20),
        le16(flags),
        le16(method),
        le16(0),
        le16(0x0021),
        le32(crc),
        le32(compressed.length),
        le32(size),
        le16(name.length),
        le16(centralExtra.length),
        le16(0),
        le16(0),
        le16(0),
        le32(entry.external ?? 0),
        le32(offset),
        name,
        centralExtra,
      ]),
    );
    const after = entry.after ?? new Uint8Array(0);
    local.push(header, compressed, descriptor, after);
    offset += header.length + compressed.length + descriptor.length + after.length;
  }
  const cd = concat(central);
  const commentBytes = utf8(comment);
  const eocd = concat([
    le32(0x06054b50),
    le16(0),
    le16(0),
    le16(entries.length),
    le16(entries.length),
    le32(cd.length),
    le32(offset),
    le16(commentBytes.length),
    commentBytes,
  ]);
  return concat([...local, cd, eocd, suffix]);
}

function pngChunk(type, data) {
  const typed = concat([utf8(type), data]);
  return concat([be32(data.length), typed, be32(crc32(typed))]);
}

/** A PNG of the given size, solid gray, with optional extra chunks before IDAT. */
function png(width, height, { before = [], idat = true } = {}) {
  const ihdr = concat([be32(width), be32(height), Uint8Array.of(8, 2, 0, 0, 0)]);
  const rows = [];
  if (idat)
    for (let y = 0; y < height; y++)
      rows.push(Uint8Array.of(0), new Uint8Array(width * 3).fill(0x80));
  return concat([
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk("IHDR", ihdr),
    ...before,
    ...(idat ? [pngChunk("IDAT", zlibSync(concat(rows)))] : []),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

/** Inserts an Exif APP1 segment, with orientation 6 and a GPS block, after a JPEG's SOI marker. */
function jpegWithExif(jpeg) {
  const ifd = concat([
    le16(2),
    le16(0x0112),
    le16(3),
    le32(1),
    le16(6),
    le16(0), // orientation: rotate 90°
    le16(0x8825),
    le16(4),
    le32(1),
    le32(38), // GPS IFD pointer
    le32(0),
    le16(0),
    le32(0), // empty GPS IFD at offset 38
  ]);
  const tiff = concat([utf8("II"), le16(42), le32(8), ifd]);
  const payload = concat([utf8("Exif\0\0"), tiff]);
  const app1 = concat([
    Uint8Array.of(0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff),
    payload,
  ]);
  return concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

function riff(chunks) {
  const body = concat([
    utf8("WEBP"),
    ...chunks.map(([type, data]) =>
      concat([
        utf8(type),
        le32(data.length),
        data,
        data.length % 2 ? Uint8Array.of(0) : new Uint8Array(0),
      ]),
    ),
  ]);
  return concat([utf8("RIFF"), le32(body.length), body]);
}

const BASE = `format_version: "0.1"
id: 4c5e2a10-8b7d-4f3e-9a21-6d0c3b5e7f81
title: Fixture
version: 1.0.0
language: en
license:
  spdx: Apache-2.0
`;
const QUESTION = `questions:
  - id: q-1
    type: multiple_choice
    selection: single
    prompt:
      text: Pick the first choice.
    choices:
      - id: a
        text: First
      - id: b
        text: Second
    correct_answers: [a]
    explanation:
      text: The first choice is correct.
`;
const VALID = BASE + QUESTION;
const withPromptImage = (src, alt = "A small gray square.") =>
  BASE +
  QUESTION.replace(
    "      text: Pick the first choice.\n",
    `      text: Pick the first choice.\n      image:\n        src: ${src}\n        alt: ${alt}\n`,
  );
const card = (front, back, extra = "") =>
  `${BASE}flashcards:\n  - id: c-1\n    front:\n      text: ${front}\n    back:\n      text: ${back}\n${extra}`;

const tinyPng = png(2, 2);
const triangleJpeg = readFileSync(
  join(ROOT, "examples/rendering-showcase/assets/shapes/triangle.jpg"),
);
const flowWebp = readFileSync(join(ROOT, "examples/anatomy-basics/assets/blood-flow.webp"));
const manifestEntry = (text = VALID) => ({ name: "study.yaml", data: utf8(text) });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** An integrity.json entry for the given entries, optionally with its JSON text altered. */
const integrityEntry = (entries, edit = (text) => text) => {
  const files = Object.fromEntries(
    entries
      .filter((e) => !e.name.endsWith("/"))
      .map((e) => [e.name, sha256(e.data)])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return {
    name: "integrity.json",
    data: utf8(edit(`${JSON.stringify({ algorithm: "sha-256", files }, null, 2)}\n`)),
  };
};
const imageBundle = () => [
  manifestEntry(withPromptImage("assets/gray.png")),
  { name: "assets/gray.png", data: tinyPng },
];

/** Each fixture: [id, description, outcome, rules, input, mode]. */
const FIXTURES = [
  // Accepted bundles.
  [
    "not-a-zip",
    "A study.yaml on its own, not packed in an archive, is not a bundle.",
    "reject",
    ["OWM-PKG-001"],
    raw(utf8(VALID)),
  ],
  [
    "valid-archive-minimal",
    "Smallest valid archive bundle: study.yaml only.",
    "accept",
    [],
    zip([manifestEntry()]),
  ],
  [
    "valid-archive-images",
    "PNG, JPEG, and WebP assets, each referenced.",
    "accept",
    [],
    zip([
      manifestEntry(
        withPromptImage("assets/gray.png") +
          "flashcards:\n  - id: c-1\n    front:\n      image:\n        src: assets/shapes/triangle.jpg\n        alt: A blue triangle.\n    back:\n      text: Triangle\n      image:\n        src: assets/flow.webp\n        alt: A flow chart of blood through the heart.\n",
      ),
      { name: "assets/", data: new Uint8Array(0) },
      { name: "assets/gray.png", data: tinyPng, method: 0 },
      { name: "assets/shapes/triangle.jpg", data: triangleJpeg },
      { name: "assets/flow.webp", data: flowWebp, method: 0 },
    ]),
  ],
  [
    "valid-os-metadata",
    "Finder and Windows metadata entries are ignored with warnings.",
    "accept",
    ["OWM-PATH-005"],
    zip([
      manifestEntry(),
      { name: "__MACOSX/", data: new Uint8Array(0) },
      { name: "__MACOSX/._study.yaml", data: utf8("metadata") },
      { name: ".DS_Store", data: utf8("metadata") },
      { name: "assets/Thumbs.db", data: utf8("metadata") },
    ]),
  ],
  [
    "valid-data-descriptor",
    "Entries written with data descriptors, as streaming tools do.",
    "accept",
    [],
    zip([{ ...manifestEntry(), descriptor: true }]),
  ],
  [
    "valid-bom",
    "A UTF-8 byte order mark before the manifest is accepted.",
    "accept",
    [],
    concat([Uint8Array.of(0xef, 0xbb, 0xbf), utf8(VALID)]),
  ],
  [
    "valid-literal-security-text",
    "Shell commands, HTML, SQL, and XSS strings inside code are text and are accepted.",
    "accept",
    [],
    card(
      "|\n        What does this do?\n\n        ```bash\n        rm -rf /tmp/build && curl https://example.org/x.sh | sh\n        ```",
      "|\n        It deletes a folder and runs a downloaded script. The payload `<script>alert(document.cookie)</script>` and the SQL `'; DROP TABLE users; --` are shown as text, as is &lt;b&gt;.",
    ),
  ],
  [
    "lint-yaml11-ambiguous",
    "Unquoted values that YAML 1.1 tools read differently pass, with lint warnings.",
    "accept",
    ["OWM-LINT-012"],
    `${VALID}subject: no\ncreated: 2026-10-18\n`,
    "lint",
  ],
  [
    "lint-exif-gps-orientation",
    "A JPEG with GPS data and a rotation tag passes, with lint warnings.",
    "accept",
    ["OWM-LINT-013", "OWM-LINT-014"],
    zip([
      manifestEntry(withPromptImage("assets/photo.jpg", "A blue triangle.")),
      { name: "assets/photo.jpg", data: jpegWithExif(triangleJpeg) },
    ]),
    "lint",
  ],

  // Archive structure (section 3.2).
  [
    "zip-traversal",
    "An entry name escapes the archive with '..'.",
    "reject",
    ["OWM-PATH-001"],
    zip([manifestEntry(), { name: "assets/../../evil.png", data: tinyPng }]),
  ],
  [
    "zip-absolute-path",
    "An entry name is an absolute path.",
    "reject",
    ["OWM-PATH-001"],
    zip([manifestEntry(), { name: "/etc/cron.d/evil", data: utf8("x") }]),
  ],
  [
    "zip-backslash",
    "An entry name uses a backslash separator.",
    "reject",
    ["OWM-PATH-001"],
    zip([manifestEntry(), { name: "assets\\gray.png", data: tinyPng }]),
  ],
  [
    "zip-space-in-name",
    "An entry name contains a space.",
    "reject",
    ["OWM-PATH-001"],
    zip([manifestEntry(), { name: "assets/my image.png", data: tinyPng }]),
  ],
  [
    "zip-symlink",
    "An entry is a Unix symbolic link.",
    "reject",
    ["OWM-PKG-009"],
    zip([
      manifestEntry(),
      {
        name: "assets/link.png",
        data: utf8("/etc/passwd"),
        method: 0,
        madeBy: 0x0314,
        external: (0o120777 << 16) >>> 0,
      },
    ]),
  ],
  [
    "zip-encrypted",
    "An entry has the encryption flag set.",
    "reject",
    ["OWM-PKG-004"],
    zip([{ ...manifestEntry(), flags: 0x0001 }]),
  ],
  [
    "zip-unsupported-method",
    "An entry uses compression method 12 (bzip2).",
    "reject",
    ["OWM-PKG-005"],
    zip([manifestEntry(), { name: "assets/gray.png", data: tinyPng, method: 12 }]),
  ],
  [
    "zip64-extra-field",
    "An entry carries a ZIP64 extra field.",
    "reject",
    ["OWM-PKG-003"],
    zip([
      {
        ...manifestEntry(),
        localExtra: concat([le16(1), le16(16), new Uint8Array(16)]),
        centralExtra: concat([le16(1), le16(16), new Uint8Array(16)]),
      },
    ]),
  ],
  [
    "zip-unicode-path-extra",
    "An entry carries an Info-ZIP Unicode Path extra field that renames it.",
    "reject",
    ["OWM-PKG-011"],
    zip([
      {
        ...manifestEntry(),
        centralExtra: concat([le16(0x7075), le16(9), Uint8Array.of(1), le32(0), utf8("a.sh")]),
      },
    ]),
  ],
  [
    "zip-duplicate-name",
    "Two entries have the same name.",
    "reject",
    ["OWM-PATH-002"],
    zip([
      manifestEntry(),
      manifestEntry(
        `${BASE}flashcards:\n  - id: other\n    front:\n      text: Other\n    back:\n      text: Other\n`,
      ),
    ]),
  ],
  [
    "zip-case-collision",
    "Two entries differ only by case.",
    "reject",
    ["OWM-PATH-002"],
    zip([
      manifestEntry(withPromptImage("assets/gray.png")),
      { name: "assets/gray.png", data: tinyPng },
      { name: "assets/Gray.png", data: tinyPng },
    ]),
  ],
  [
    "zip-local-central-mismatch",
    "The local header names a different file than the central directory.",
    "reject",
    ["OWM-PKG-007"],
    zip([manifestEntry(), { name: "assets/gray.png", localName: "assets/evil.sh", data: tinyPng }]),
  ],
  [
    "zip-prepended-data",
    "A shell script with an archive appended, as in a polyglot file. It does not start with a ZIP header, so it is not a bundle.",
    "reject",
    ["OWM-PKG-001"],
    raw(zip([manifestEntry()], { prefix: utf8("#!/bin/sh\necho polyglot\n") })),
  ],
  [
    "zip-hidden-gap",
    "Bytes hidden between two entries, outside any entry.",
    "reject",
    ["OWM-PKG-006"],
    zip([
      { ...manifestEntry(), after: utf8("hidden payload") },
      { name: "assets/gray.png", data: tinyPng },
    ]),
  ],
  [
    "zip-trailing-data",
    "Bytes after the end of central directory record.",
    "reject",
    ["OWM-PKG-002"],
    zip([manifestEntry()], { suffix: utf8("trailing") }),
  ],
  [
    "zip-truncated",
    "The archive is cut off before its central directory.",
    "reject",
    ["OWM-PKG-002"],
    zip([manifestEntry()]).subarray(0, 60),
  ],
  [
    "zip-bad-crc",
    "An entry's CRC-32 does not match its data.",
    "reject",
    ["OWM-PKG-008"],
    zip([{ ...manifestEntry(), crc: 0x12345678 }]),
  ],
  [
    "zip-size-understated",
    "An entry decompresses to more than its recorded size.",
    "reject",
    ["OWM-PKG-007"],
    zip([manifestEntry(), { name: "assets/gray.png", data: new Uint8Array(4096), size: 16 }]),
  ],
  [
    "zip-compression-bomb",
    "A 2 MiB entry compressed about 1,000 to 1: over the ratio limit.",
    "reject",
    ["OWM-LIM-001"],
    zip([manifestEntry(), { name: "assets/bomb.png", data: new Uint8Array(2 * 1024 * 1024) }]),
  ],
  [
    "zip-too-many-entries",
    "2,002 entries: over the limit of 2,000.",
    "reject",
    ["OWM-LIM-001"],
    zip([
      manifestEntry(),
      { name: "assets/", data: new Uint8Array(0) },
      ...Array.from({ length: 2000 }, (_, i) => ({
        name: `assets/d${String(i).padStart(4, "0")}/`,
        data: new Uint8Array(0),
      })),
    ]),
  ],
  [
    "zip-nested-archive",
    "An archive inside the bundle.",
    "reject",
    ["OWM-IMG-006"],
    zip([manifestEntry(), { name: "assets/inner.zip", data: zip([manifestEntry()]) }]),
  ],
  [
    "zip-unexpected-file",
    "A file other than the manifest and images.",
    "reject",
    ["OWM-PATH-004"],
    zip([manifestEntry(), { name: "README.txt", data: utf8("hello") }]),
  ],
  [
    "zip-script-file",
    "A script among the assets.",
    "reject",
    ["OWM-IMG-006"],
    zip([manifestEntry(), { name: "assets/run.js", data: utf8("alert(1)") }]),
  ],
  [
    "zip-wrapper-folder",
    "study.yaml is inside a folder: the folder was compressed instead of its contents.",
    "reject",
    ["OWM-PATH-003"],
    zip([{ name: "my-bundle/study.yaml", data: utf8(VALID) }]),
  ],
  [
    "zip-manifest-wrong-case",
    "The manifest is named Study.yaml.",
    "reject",
    ["OWM-PATH-003", "OWM-PATH-004"],
    zip([{ name: "Study.yaml", data: utf8(VALID) }]),
  ],

  // Images (section 10).
  [
    "image-spoofed-type",
    "A JPEG named .png.",
    "reject",
    ["OWM-IMG-007"],
    zip([
      manifestEntry(withPromptImage("assets/photo.png")),
      { name: "assets/photo.png", data: triangleJpeg },
    ]),
  ],
  [
    "image-not-an-image",
    "Text named .png.",
    "reject",
    ["OWM-IMG-006"],
    zip([
      manifestEntry(withPromptImage("assets/fake.png")),
      { name: "assets/fake.png", data: utf8("<svg onload=alert(1)>") },
    ]),
  ],
  [
    "image-truncated",
    "A PNG cut off mid-chunk.",
    "reject",
    ["OWM-IMG-009"],
    zip([
      manifestEntry(withPromptImage("assets/gray.png")),
      { name: "assets/gray.png", data: png(32, 32).subarray(0, 60) },
    ]),
  ],
  [
    "image-corrupt-data",
    "A PNG whose structure is intact but whose pixel data is not.",
    "reject",
    ["OWM-IMG-009"],
    zip([
      manifestEntry(withPromptImage("assets/gray.png")),
      {
        name: "assets/gray.png",
        data: concat([
          png(2, 2, { idat: false }).subarray(0, 33),
          pngChunk("IDAT", utf8("not zlib data")),
          pngChunk("IEND", new Uint8Array(0)),
        ]),
      },
    ]),
  ],
  [
    "image-jpeg-truncated",
    "A JPEG cut off before its end-of-image marker. Some browsers would draw it partially.",
    "reject",
    ["OWM-IMG-009"],
    zip([
      manifestEntry(withPromptImage("assets/cut.jpg")),
      { name: "assets/cut.jpg", data: triangleJpeg.subarray(0, triangleJpeg.length - 400) },
    ]),
  ],
  [
    "image-png-bad-crc",
    "A PNG chunk whose CRC does not match its data.",
    "reject",
    ["OWM-IMG-009"],
    zip([
      manifestEntry(withPromptImage("assets/gray.png")),
      {
        name: "assets/gray.png",
        data: (() => {
          const copy = tinyPng.slice();
          copy[29] ^= 0xff;
          return copy;
        })(),
      },
    ]),
  ],
  [
    "image-animated-png",
    "A PNG with an animation control chunk.",
    "reject",
    ["OWM-IMG-008"],
    zip([
      manifestEntry(withPromptImage("assets/anim.png")),
      {
        name: "assets/anim.png",
        data: png(2, 2, { before: [pngChunk("acTL", concat([be32(1), be32(0)]))] }),
      },
    ]),
  ],
  [
    "image-animated-webp",
    "A WebP with the animation flag and an ANIM chunk.",
    "reject",
    ["OWM-IMG-008"],
    zip([
      manifestEntry(withPromptImage("assets/anim.webp")),
      {
        name: "assets/anim.webp",
        data: riff([
          ["VP8X", Uint8Array.of(0x02, 0, 0, 0, 1, 0, 0, 1, 0, 0)],
          ["ANIM", new Uint8Array(6)],
        ]),
      },
    ]),
  ],
  [
    "image-huge-dimensions",
    "A tiny PNG declaring 100,000 × 100,000 pixels: rejected before decoding.",
    "reject",
    ["OWM-IMG-010"],
    zip([
      manifestEntry(withPromptImage("assets/huge.png")),
      { name: "assets/huge.png", data: png(100000, 100000, { idat: false }) },
    ]),
  ],
  [
    "image-missing-asset",
    "A prompt refers to an image that is not in the bundle.",
    "reject",
    ["OWM-IMG-001"],
    zip([manifestEntry(withPromptImage("assets/missing.png"))]),
  ],
  [
    "image-svg",
    "An SVG asset.",
    "reject",
    ["OWM-IMG-006"],
    zip([
      manifestEntry(withPromptImage("assets/logo.svg")),
      {
        name: "assets/logo.svg",
        data: utf8("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
      },
    ]),
  ],
  [
    "image-uppercase-extension",
    "An asset with an uppercase extension.",
    "reject",
    ["OWM-IMG-006"],
    zip([
      manifestEntry(withPromptImage("assets/gray.PNG")),
      { name: "assets/gray.PNG", data: tinyPng },
    ]),
  ],

  // Encoding and the YAML profile (section 4).
  [
    "encoding-invalid-utf8",
    "The manifest contains an invalid UTF-8 sequence.",
    "reject",
    ["OWM-ENC-001"],
    concat([
      utf8(VALID),
      Uint8Array.of(0x73, 0x75, 0x62, 0x6a, 0x65, 0x63, 0x74, 0x3a, 0x20, 0xc3, 0x28, 0x0a),
    ]),
  ],
  [
    "encoding-control-character",
    "The manifest contains a BEL control character.",
    "reject",
    ["OWM-ENC-002"],
    `${VALID}subject: "ring\u0007"\n`,
  ],
  [
    "yaml-malformed",
    "Inconsistent indentation.",
    "reject",
    ["OWM-YAML-011"],
    `${BASE}questions:\n  - id: q-1\n   type: multiple_choice\n`,
  ],
  [
    "yaml-multiple-documents",
    "Two YAML documents in one manifest.",
    "reject",
    ["OWM-YAML-001"],
    `${VALID}---\n${VALID}`,
  ],
  ["yaml-directive", "A %YAML directive.", "reject", ["OWM-YAML-001"], `%YAML 1.2\n---\n${VALID}`],
  [
    "yaml-alias-bomb",
    "Nested aliases that would expand exponentially if resolved.",
    "reject",
    ["OWM-YAML-002"],
    `${VALID}extensions:\n  org.example.lol:\n    a: &a [x, x, x, x, x, x, x, x, x]\n    b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]\n    c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]\n    d: [*c, *c, *c, *c, *c, *c, *c, *c, *c]\n`,
  ],
  [
    "yaml-custom-tag",
    "A tag that some YAML libraries use to construct objects.",
    "reject",
    ["OWM-YAML-002"],
    `${VALID}subject: !!python/object/apply:os.system ["echo owned"]\n`,
  ],
  [
    "yaml-duplicate-key",
    "A mapping with the same key twice.",
    "reject",
    ["OWM-YAML-004"],
    `${VALID}title: Again\n`,
  ],
  [
    "yaml-null-value",
    "A member with an empty value.",
    "reject",
    ["OWM-YAML-008"],
    `${VALID}subject:\n`,
  ],
  [
    "yaml-float",
    "A floating-point number.",
    "reject",
    ["OWM-YAML-009"],
    `${VALID}practice_defaults:\n  passing_percentage: 7.5e1\n`,
  ],
  [
    "yaml-deep-nesting",
    "Nesting deeper than 32 levels.",
    "reject",
    ["OWM-LIM-001"],
    `${VALID}extensions:\n  org.example.deep: ${"{a: ".repeat(40)}1${"}".repeat(40)}\n`,
  ],
  [
    "yaml-proto-key",
    "A __proto__ key is ordinary data and cannot affect the engine; here it is an unknown member.",
    "reject",
    ["OWM-VER-004"],
    `${VALID}__proto__:\n  polluted: true\n`,
  ],

  // Versions and members (section 5).
  [
    "version-unsupported",
    "format_version 0.9 is not supported.",
    "reject",
    ["OWM-VER-002"],
    VALID.replace('"0.1"', '"0.9"'),
  ],
  [
    "version-not-a-string",
    "format_version written as a number.",
    "reject",
    ["OWM-YAML-006"],
    VALID.replace('"0.1"', "1"),
  ],
  [
    "version-missing",
    "No format_version.",
    "reject",
    ["OWM-CONF-004"],
    VALID.replace('format_version: "0.1"\n', ""),
  ],
  [
    "requires-unknown-feature",
    "A required feature this reader does not implement.",
    "reject",
    ["OWM-VER-006"],
    `${VALID}requires: [math]\n`,
  ],
  [
    "unknown-member",
    "A misspelled member.",
    "reject",
    ["OWM-VER-004"],
    VALID.replace("    explanation:\n", "    explaination:\n"),
  ],
  [
    "extension-bad-namespace",
    "An extension key that is not a reverse domain name.",
    "reject",
    ["OWM-EXT-001"],
    `${VALID}extensions:\n  difficulty: 3\n`,
  ],

  // Collection and items (sections 6 and 7).
  ["collection-no-items", "No questions and no flashcards.", "reject", ["OWM-COL-002"], BASE],
  [
    "collection-uuid-uppercase",
    "An uppercase collection id.",
    "reject",
    ["OWM-COL-004"],
    VALID.replace("4c5e2a10-8b7d-4f3e-9a21-6d0c3b5e7f81", "4C5E2A10-8B7D-4F3E-9A21-6D0C3B5E7F81"),
  ],
  [
    "collection-too-many-items",
    "10,001 flashcards: over the limit of 10,000.",
    "reject",
    ["OWM-LIM-001"],
    zip([
      manifestEntry(
        `${BASE}flashcards:\n${Array.from({ length: 10001 }, (_, i) => `  - id: c-${i}\n    front:\n      text: F\n    back:\n      text: B\n`).join("")}`,
      ),
    ]),
  ],
  [
    "id-collision",
    "A question and a flashcard share an id.",
    "reject",
    ["OWM-ID-002"],
    `${VALID}flashcards:\n  - id: q-1\n    front:\n      text: Front\n    back:\n      text: Back\n`,
  ],
  [
    "choice-id-duplicate",
    "Two choices in one question share an id.",
    "reject",
    ["OWM-ID-003"],
    VALID.replace("      - id: b\n", "      - id: a\n"),
  ],
  [
    "answer-unknown-choice",
    "A correct answer names no choice.",
    "reject",
    ["OWM-Q-004"],
    VALID.replace("correct_answers: [a]", "correct_answers: [c]"),
  ],
  [
    "single-two-correct",
    "A single-answer question with two correct answers.",
    "reject",
    ["OWM-Q-005"],
    VALID.replace("correct_answers: [a]", "correct_answers: [a, b]"),
  ],
  [
    "selection-count-mismatch",
    "selection_count differs from the number of correct answers.",
    "reject",
    ["OWM-Q-006"],
    VALID.replace("selection: single", "selection: multiple\n    selection_count: 2"),
  ],

  // Markdown and links (section 9).
  [
    "markdown-raw-html",
    "Raw HTML outside code.",
    "reject",
    ["OWM-MD-003"],
    card("<script>alert(1)</script>", "Back"),
  ],
  [
    "markdown-event-handler",
    "An HTML element with an event handler.",
    "reject",
    ["OWM-MD-003"],
    card('"<img src=x onerror=alert(1)>"', "Back"),
  ],
  [
    "markdown-javascript-link",
    "A javascript: link.",
    "reject",
    ["OWM-LINK-001"],
    card('"[Click](javascript:alert(1))"', "Back"),
  ],
  [
    "markdown-mailto-autolink",
    "An email autolink, which uses the mailto scheme.",
    "reject",
    ["OWM-LINK-001"],
    card("Write to <me@example.org>", "Back"),
  ],
  [
    "markdown-http-link",
    "An http link.",
    "reject",
    ["OWM-LINK-001"],
    card('"[Docs](http://example.org/)"', "Back"),
  ],
  [
    "markdown-remote-image",
    "An image loaded from the web, which would track the learner.",
    "reject",
    ["OWM-MD-009"],
    zip([manifestEntry(card('"![pixel](https://tracker.example.org/p.png)"', "Back"))]),
  ],
  [
    "markdown-data-uri-image",
    "An image embedded as a data: URI.",
    "reject",
    ["OWM-MD-009"],
    zip([manifestEntry(card('"![x](data:image/png;base64,iVBORw0KGgo=)"', "Back"))]),
  ],
  [
    "markdown-heading-in-item",
    "A heading in a flashcard.",
    "reject",
    ["OWM-MD-007"],
    card('"# Big text"', "Back"),
  ],
  [
    "url-userinfo",
    "A reference URL with user information before the host.",
    "reject",
    ["OWM-LINK-001"],
    `${VALID}sources:\n  - title: Docs\n    url: https://trusted.example.org@evil.example.net/\n`,
  ],
  [
    "valid-reserved-signatures",
    "Signature data under signatures/ is ignored with a warning, and the bundle opens.",
    "accept",
    ["OWM-SIG-002"],
    zip([
      ...imageBundle(),
      { name: "signatures/", data: new Uint8Array(0) },
      { name: "signatures/publisher.sig", data: utf8("future signature data") },
    ]),
  ],
  [
    "valid-integrity",
    "An integrity file whose digests all match.",
    "accept",
    [],
    zip([...imageBundle(), integrityEntry(imageBundle())]),
  ],
  [
    "integrity-file-changed",
    "study.yaml was edited after packing, so its digest no longer matches.",
    "reject",
    ["OWM-INT-004"],
    zip([
      manifestEntry(
        withPromptImage("assets/gray.png").replace("Pick the first", "Pick the second"),
      ),
      imageBundle()[1],
      integrityEntry(imageBundle()),
    ]),
  ],
  [
    "integrity-file-unlisted",
    "An asset is missing from the integrity file.",
    "reject",
    ["OWM-INT-003"],
    zip([...imageBundle(), integrityEntry([manifestEntry(withPromptImage("assets/gray.png"))])]),
  ],
  [
    "integrity-file-unknown",
    "The integrity file lists a file that is not in the archive.",
    "reject",
    ["OWM-INT-003"],
    zip([
      ...imageBundle(),
      integrityEntry([...imageBundle(), { name: "assets/ghost.png", data: tinyPng }]),
    ]),
  ],
  [
    "integrity-duplicate-key",
    "The integrity file lists study.yaml twice, which JSON.parse alone would not notice.",
    "reject",
    ["OWM-INT-002"],
    zip([
      ...imageBundle(),
      integrityEntry(imageBundle(), (text) =>
        text.replace('"files": {', `"files": {\n    "study.yaml": "${"0".repeat(64)}",`),
      ),
    ]),
  ],
  [
    "integrity-wrong-algorithm",
    "The integrity file uses MD5.",
    "reject",
    ["OWM-INT-002"],
    zip([
      ...imageBundle(),
      integrityEntry(imageBundle(), (text) => text.replace("sha-256", "md5")),
    ]),
  ],
  [
    "language-part-malformed",
    "A choice declares a language that is not a BCP 47 tag.",
    "reject",
    ["OWM-CONT-003"],
    VALID.replace("        text: Second\n", "        text: Second\n        language: spanish_mx\n"),
  ],
];

/**
 * Every bundle is an archive (OWM-PKG-001), so manifest text and manifest
 * bytes are packed as study.yaml in a minimal archive. Input wrapped in raw()
 * is used exactly as given.
 */
function asInput(input) {
  if (input && input.raw) return input.raw;
  const bytes = typeof input === "string" ? utf8(input) : input;
  return bytes[0] === 0x50 && bytes[1] === 0x4b
    ? bytes
    : zip([{ name: "study.yaml", data: bytes }]);
}

/** Builds every fixture as a map from relative path to bytes. */
export function generateFixtures() {
  const files = new Map();
  const ids = new Set();
  for (const [id, description, outcome, rules, input, mode = "validate"] of FIXTURES) {
    if (ids.has(id)) throw new Error(`duplicate fixture id ${id}`);
    ids.add(id);
    const bytes = asInput(input);
    const isArchive = bytes[0] === 0x50 && bytes[1] === 0x4b;
    files.set(`${id}/${isArchive ? "input.waymark" : "input.bin"}`, bytes);
    const expect = { description, format_version: "0.1", mode, outcome, rules };
    files.set(`${id}/expect.json`, utf8(`${JSON.stringify(expect, null, 2)}\n`));
  }
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outDir = join(ROOT, "fixtures");
  for (const entry of FIXTURES) rmSync(join(outDir, entry[0]), { recursive: true, force: true });
  let total = 0;
  for (const [path, bytes] of generateFixtures()) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), bytes);
    total += bytes.length;
  }
  console.log(`Wrote ${FIXTURES.length} fixtures (${total} bytes) to fixtures/.`);
}
