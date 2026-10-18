// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Validation of a whole bundle: form detection, archive structure, entry
// names, limits, encoding, the YAML profile, the manifest, assets, and lint.
// Every check records whether it ran, so the verdict can say "incomplete"
// rather than "conforming" when one could not (OWM-VAL-003).

import { ascii, decodeUtf8, type ByteSource } from "./bytes.js";
import { contentFingerprint } from "./fingerprint.js";
import { inspectImage, verifyImageStructure, type ImageDecoder, type ImageInfo } from "./images.js";
import {
  INTEGRITY_MAX_BYTES,
  INTEGRITY_NAME,
  parseIntegrity,
  verifyIntegrity,
} from "./integrity.js";
import { LIMITS } from "./limits.js";
import { lintBundle } from "./lint.js";
import { SUPPORTED_FORMAT_VERSIONS, validateManifest } from "./manifest.js";
import {
  assetPathProblem,
  directoryProblem,
  entryNameProblem,
  formatFromExtension,
  isIgnorable,
  isReservedSignature,
  MANIFEST_NAME,
} from "./paths.js";
import { ReportBuilder, type BundleSummary, type Report } from "./report.js";
import { checkCharacters, parseManifestText, type Mapping, type ParsedManifest } from "./yaml.js";
import { readZipDirectory, readZipEntry, type ZipEntry } from "./zip.js";

export const ENGINE_VERSION = "0.0.0";

export interface ValidateOptions {
  /** Decodes images fully (OWM-IMG-009). Without one, the result is at best "incomplete". */
  imageDecoder?: ImageDecoder;
  /** Also run the recommended lint checks (Appendix A). */
  lint?: boolean;
  /** Most diagnostics to keep; the counts still include the rest. Default 500. */
  maxDiagnostics?: number;
  /** Checked between steps; when it becomes true, validation stops with ValidationCanceled. */
  signal?: { readonly aborted: boolean };
}

export interface ValidatedBundle {
  form: "archive" | "text";
  manifest: Mapping;
  /** Asset bytes by path. Ignorable entries are never included. */
  assets: Map<string, Uint8Array>;
  assetInfo: Map<string, ImageInfo>;
  fingerprint: string;
}

export interface ValidationResult {
  report: Report;
  /** Present only when the bundle is conforming, so a reader can import it. */
  bundle?: ValidatedBundle;
}

export class ValidationCanceled extends Error {
  constructor() {
    super("Validation was canceled.");
    this.name = "ValidationCanceled";
  }
}

interface ManifestStage {
  parsed: ParsedManifest;
  images: ReturnType<typeof validateManifest>["images"];
  descriptionSetextHeadings: number;
  questions: number;
  flashcards: number;
}

export async function validateBundle(
  source: ByteSource,
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const report = new ReportBuilder(options.maxDiagnostics ?? 500);
  const throwIfCanceled = () => {
    if (options.signal?.aborted) throw new ValidationCanceled();
  };
  const head = await source.read(0, 4);
  const form = ascii(head, 0, 4) === "PK\u0003\u0004" ? "archive" : "text";
  const assets = new Map<string, Uint8Array>();
  const assetInfo = new Map<string, ImageInfo>();
  const ignorable: string[] = [];
  let manifestStage: ManifestStage | undefined;
  let uncompressedBytes = 0;
  let hasIntegrityFile = false;

  const parseAndCheckManifest = (
    bytes: Uint8Array,
    entry: string | undefined,
    assetPaths: ReadonlySet<string>,
  ) => {
    const decoded = decodeUtf8(bytes);
    if (!decoded.ok) {
      report.add(
        "OWM-ENC-001",
        `The manifest is not valid UTF-8 (first invalid byte at offset ${decoded.offset}).`,
        entry !== undefined ? { entry } : undefined,
      );
      report.check("encoding", "performed");
      return;
    }
    checkCharacters(decoded.text, report, entry);
    report.check("encoding", "performed");
    const parsed = parseManifestText(decoded.text, report, entry);
    report.check("yaml-profile", "performed");
    if (!parsed) return;
    const findings = validateManifest(
      parsed,
      { isTextBundle: form === "text", assets: assetPaths },
      report,
      entry,
    );
    if (!findings.checked) return;
    report.check("manifest-structure", "performed");
    report.check("cross-references", "performed");
    report.check("markdown-profile", "performed");
    report.check("spdx-syntax", "performed");
    manifestStage = { parsed, ...findings };
  };

  if (form === "text") {
    report.check("archive-structure", "not-applicable", "text bundle");
    report.check("entry-names", "not-applicable", "text bundle");
    report.check("integrity", "not-applicable", "text bundles have no integrity file");
    for (const id of ["image-signatures", "image-dimensions", "image-decode"] as const)
      report.check(id, "not-applicable", "text bundles have no images");
    if (source.size > LIMITS.manifestBytes) {
      report.add(
        "OWM-LIM-001",
        `The file is ${source.size} bytes; a text bundle may be at most ${LIMITS.manifestBytes}. If it is an archive, it is damaged.`,
      );
      report.check("resource-limits", "performed");
    } else {
      report.check("resource-limits", "performed");
      const bytes = await source.read(0, source.size);
      uncompressedBytes = bytes.length;
      parseAndCheckManifest(bytes, undefined, new Set());
    }
  } else {
    const directory = await readZipDirectory(source, report);
    throwIfCanceled();
    if (directory) {
      report.check("archive-structure", "performed");
      const { manifest, assetEntries, integrity } = checkEntries(
        directory.entries,
        report,
        ignorable,
      );
      hasIntegrityFile = integrity !== undefined;
      report.check("entry-names", "performed");
      checkDeclaredSizes(directory.entries, report);
      report.check("resource-limits", "performed");
      uncompressedBytes = directory.entries.reduce(
        (sum, entry) => sum + (isIgnorable(entry.name) ? 0 : entry.uncompressedSize),
        0,
      );
      if (directory.readable && manifest) {
        const read = await readZipEntry(source, manifest, LIMITS.manifestBytes, report);
        throwIfCanceled();
        if (read.ok)
          parseAndCheckManifest(
            read.bytes,
            MANIFEST_NAME,
            new Set(assetEntries.map((entry) => entry.name)),
          );
        await checkAssets(
          source,
          assetEntries,
          report,
          assets,
          assetInfo,
          options,
          throwIfCanceled,
        );
        if (integrity) {
          // Compare digests of everything that could be read; files that failed
          // earlier checks are already errors and cannot be compared.
          const files = new Map(assets);
          if (read.ok) files.set(MANIFEST_NAME, read.bytes);
          const unreadable = new Set(
            [MANIFEST_NAME, ...assetEntries.map((entry) => entry.name)].filter(
              (name) => !files.has(name),
            ),
          );
          const integrityRead = await readZipEntry(source, integrity, INTEGRITY_MAX_BYTES, report);
          const digests = integrityRead.ok
            ? parseIntegrity(integrityRead.bytes, report)
            : undefined;
          if (digests) {
            verifyIntegrity(digests, files, unreadable, report);
            report.check("integrity", "performed");
          }
        } else {
          report.check("integrity", "not-applicable", "the archive has no integrity.json");
        }
      }
    }
  }

  if (manifestStage && options.lint) {
    lintBundle(
      {
        parsed: manifestStage.parsed,
        images: manifestStage.images,
        assetInfo,
        assets: new Set(assets.keys()),
        ignorableEntries: ignorable,
        missingIntegrityFile: form === "archive" && !hasIntegrityFile,
        descriptionSetextHeadings: manifestStage.descriptionSetextHeadings,
        entry: form === "archive" ? MANIFEST_NAME : undefined,
      },
      report,
    );
    report.check("lint", "performed");
    report.check(
      "spdx-license-list",
      "skipped",
      "the SPDX License List is not bundled with this engine",
    );
    report.check(
      "language-subtag-registry",
      "skipped",
      "the IANA Language Subtag Registry is not bundled with this engine",
    );
  }

  const checks = report.finishChecks("an earlier error prevented this check");
  const conformance = report.conformance(checks);
  const result: Report = {
    engine: { name: "@openwaymark/engine", version: ENGINE_VERSION },
    supportedFormatVersions: SUPPORTED_FORMAT_VERSIONS,
    input: { form, bytes: source.size },
    conformance,
    errors: report.errors,
    warnings: report.warnings,
    diagnostics: report.diagnostics,
    truncated: report.truncated,
    checks,
  };
  if (manifestStage) result.summary = summarize(manifestStage, assets.size, uncompressedBytes);
  if (conformance === "conforming" && manifestStage) {
    const fingerprint = contentFingerprint(manifestStage.parsed.root, assets);
    result.fingerprint = fingerprint;
    return {
      report: result,
      bundle: { form, manifest: manifestStage.parsed.root, assets, assetInfo, fingerprint },
    };
  }
  return { report: result };
}

function summarize(stage: ManifestStage, assets: number, uncompressedBytes: number): BundleSummary {
  const root = stage.parsed.root;
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const summary: BundleSummary = {
    questions: stage.questions,
    flashcards: stage.flashcards,
    assets,
    uncompressedBytes,
  };
  const fields = {
    formatVersion: root.format_version,
    id: root.id,
    title: root.title,
    version: root.version,
    language: root.language,
  };
  for (const [key, value] of Object.entries(fields)) {
    const string = text(value);
    if (string !== undefined) summary[key as "id"] = string;
  }
  return summary;
}

function checkEntries(entries: readonly ZipEntry[], report: ReportBuilder, ignorable: string[]) {
  let manifest: ZipEntry | undefined;
  let integrity: ZipEntry | undefined;
  let signatureEntries = 0;
  const assetEntries: ZipEntry[] = [];
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const at = { entry: entry.name };
    const problem = entryNameProblem(entry.name);
    if (problem) {
      report.add("OWM-PATH-001", `The entry name ${JSON.stringify(entry.name)} ${problem}.`, at);
      continue;
    }
    const folded = (entry.isDirectory ? entry.name.slice(0, -1) : entry.name).toLowerCase();
    const first = seen.get(folded);
    if (first !== undefined) {
      report.add(
        "OWM-PATH-002",
        `${entry.name} duplicates ${first} (names may not differ only by case).`,
        at,
      );
      continue;
    }
    seen.set(folded, entry.name);
    if (isIgnorable(entry.name)) {
      if (!entry.isDirectory) {
        ignorable.push(entry.name);
        report.add(
          "OWM-PATH-005",
          `${entry.name} is operating-system metadata. It is ignored and never read.`,
          at,
        );
      }
      continue;
    }
    if (isReservedSignature(entry.name)) {
      // Reserved for future signatures (OWM-SIG-002): never read as content.
      if (!entry.isDirectory) signatureEntries++;
      continue;
    }
    if (entry.isDirectory) {
      const dirProblem = directoryProblem(entry.name);
      if (dirProblem) report.add("OWM-PATH-006", `The directory ${entry.name} ${dirProblem}.`, at);
      continue;
    }
    if (entry.name === MANIFEST_NAME) {
      manifest = entry;
      continue;
    }
    if (entry.name === INTEGRITY_NAME) {
      integrity = entry;
      continue;
    }
    if (entry.name.startsWith("assets/")) {
      const assetProblem = assetPathProblem(entry.name);
      if (assetProblem)
        report.add(
          assetProblem.includes("extension") || assetProblem.includes("does not end")
            ? "OWM-IMG-006"
            : "OWM-IMG-004",
          `The asset ${entry.name} ${assetProblem}.`,
          at,
        );
      else assetEntries.push(entry);
      continue;
    }
    const hint =
      entry.name.toLowerCase() === MANIFEST_NAME
        ? ` The manifest must be named exactly "${MANIFEST_NAME}", in lowercase.`
        : "";
    report.add(
      "OWM-PATH-004",
      `${entry.name} is not permitted in a bundle: only study.yaml and images under assets/ are.${hint}`,
      at,
    );
  }
  if (!manifest) {
    const nested = entries.find((entry) => entry.name.endsWith(`/${MANIFEST_NAME}`));
    report.add(
      "OWM-PATH-003",
      nested
        ? `study.yaml must be at the top of the archive, but it is inside ${nested.name.slice(0, -MANIFEST_NAME.length)}. Compress the folder's contents, not the folder itself.`
        : "The archive has no study.yaml at its top level.",
    );
  }
  if (signatureEntries > 0) {
    report.add(
      "OWM-SIG-002",
      `The bundle carries signature data (${signatureEntries} ${signatureEntries === 1 ? "entry" : "entries"} under signatures/) that this version of the format cannot verify. It is ignored, and the bundle is not treated as signed.`,
    );
  }
  return { manifest, assetEntries, integrity };
}

function checkDeclaredSizes(entries: readonly ZipEntry[], report: ReportBuilder): void {
  let total = 0;
  for (const entry of entries) {
    if (isIgnorable(entry.name)) continue;
    total += entry.uncompressedSize;
    const at = { entry: entry.name };
    const limit = entry.name === MANIFEST_NAME ? LIMITS.manifestBytes : LIMITS.assetBytes;
    if (entry.uncompressedSize > limit)
      report.add(
        "OWM-LIM-001",
        `${entry.name} is ${entry.uncompressedSize} bytes uncompressed; the limit is ${limit}.`,
        at,
      );
    if (
      entry.uncompressedSize > LIMITS.ratioThresholdBytes &&
      entry.uncompressedSize > LIMITS.compressionRatio * Math.max(1, entry.compressedSize)
    ) {
      report.add(
        "OWM-LIM-001",
        `${entry.name} expands more than ${LIMITS.compressionRatio} times its compressed size.`,
        at,
      );
    }
  }
  if (total > LIMITS.totalUncompressedBytes) {
    report.add(
      "OWM-LIM-001",
      `The bundle is ${total} bytes uncompressed; the limit is ${LIMITS.totalUncompressedBytes}.`,
    );
  }
}

async function checkAssets(
  source: ByteSource,
  entries: readonly ZipEntry[],
  report: ReportBuilder,
  assets: Map<string, Uint8Array>,
  assetInfo: Map<string, ImageInfo>,
  options: ValidateOptions,
  throwIfCanceled: () => void,
): Promise<void> {
  if (entries.length === 0) {
    for (const id of ["image-signatures", "image-dimensions", "image-decode"] as const)
      report.check(id, "not-applicable", "the bundle has no images");
    return;
  }
  const decoder = options.imageDecoder;
  let decodable = 0;
  for (const entry of entries) {
    throwIfCanceled();
    const at = { entry: entry.name };
    if (entry.uncompressedSize > LIMITS.assetBytes) continue; // already reported
    const read = await readZipEntry(source, entry, LIMITS.assetBytes, report);
    if (!read.ok) continue;
    assets.set(entry.name, read.bytes);
    const inspected = inspectImage(read.bytes);
    if (!inspected.ok) {
      report.add(
        read.bytes.length > 0 && inspected.reason.startsWith("is not")
          ? "OWM-IMG-006"
          : "OWM-IMG-009",
        `${entry.name} ${inspected.reason}.`,
        at,
      );
      continue;
    }
    const info = inspected.info;
    assetInfo.set(entry.name, info);
    if (formatFromExtension(entry.name) !== info.format) {
      report.add(
        "OWM-IMG-007",
        `${entry.name} contains a ${info.format.toUpperCase()} image, which does not match its file extension.`,
        at,
      );
    }
    if (info.animated)
      report.add("OWM-IMG-008", `${entry.name} is animated; only still images are permitted.`, at);
    const tooLarge =
      info.width > LIMITS.imageSide ||
      info.height > LIMITS.imageSide ||
      info.width * info.height > LIMITS.imagePixels;
    // Structural checks run only on images within the limits, so the pixel data
    // they measure is bounded; they do not depend on the platform's decoder.
    const structural =
      !tooLarge && info.width > 0 && info.height > 0 && !info.animated
        ? verifyImageStructure(read.bytes, info)
        : undefined;
    if (info.width === 0 || info.height === 0)
      report.add("OWM-IMG-009", `${entry.name} declares zero width or height.`, at);
    else if (tooLarge) {
      report.add(
        "OWM-IMG-010",
        `${entry.name} is ${info.width} × ${info.height} pixels; the limits are ${LIMITS.imageSide} per side and ${LIMITS.imagePixels} in total.`,
        at,
      );
    } else if (structural) {
      report.add("OWM-IMG-009", `${entry.name} ${structural}.`, at);
    } else if (decoder && !info.animated) {
      decodable++;
      try {
        const decoded = await decoder.decode(read.bytes, info.format);
        if (decoded.width !== info.width || decoded.height !== info.height) {
          report.add(
            "OWM-IMG-009",
            `${entry.name} decodes to ${decoded.width} × ${decoded.height}, not the ${info.width} × ${info.height} its header declares.`,
            at,
          );
        }
      } catch (error) {
        report.add(
          "OWM-IMG-009",
          `${entry.name} could not be decoded: ${error instanceof Error ? error.message : String(error)}.`,
          at,
        );
      }
    }
  }
  report.check("image-signatures", "performed");
  report.check("image-dimensions", "performed");
  if (!decoder)
    report.check("image-decode", "skipped", "no image decoder is available on this platform");
  else
    report.check(
      "image-decode",
      "performed",
      decodable < entries.length
        ? `${decoder.name}; images that failed earlier checks were not decoded`
        : decoder.name,
    );
}
