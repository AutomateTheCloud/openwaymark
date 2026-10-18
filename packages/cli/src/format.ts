// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Human-readable output. The words matter: a conforming bundle "passed the
// configured checks", which says nothing about whether it is safe or whether
// its answers are right (spec OWM-SEC-006).

import type { Diagnostic, Report } from "@openwaymark/engine";
import type { ScanResult } from "./scan.js";

function where(diagnostic: Diagnostic): string {
  const location = diagnostic.location;
  if (!location) return "";
  const parts: string[] = [];
  if (location.entry) parts.push(location.entry);
  if (location.line !== undefined)
    parts.push(
      `line ${location.line}${location.column !== undefined ? `, column ${location.column}` : ""}`,
    );
  if (location.pointer !== undefined && location.pointer !== "") parts.push(location.pointer);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function formatDiagnostics(report: Report): string {
  return report.diagnostics
    .map(
      (d) =>
        `  ${d.severity === "error" ? "error  " : "warning"} ${d.rule}  ${d.message}${where(d)}\n`,
    )
    .join("");
}

export function formatVerdict(file: string, report: Report): string {
  const lines: string[] = [];
  const counts = `${report.errors} ${report.errors === 1 ? "error" : "errors"}, ${report.warnings} ${report.warnings === 1 ? "warning" : "warnings"}`;
  if (report.conformance === "conforming") {
    lines.push(
      `${file}: passed the configured checks for OpenWaymark ${report.summary?.formatVersion ?? ""} (${counts}).`,
    );
    lines.push(
      "  This means the bundle is well-formed. It does not mean it is safe, or that its answers are right.",
    );
  } else if (report.conformance === "incomplete") {
    lines.push(`${file}: no errors found, but not every required check could run (${counts}).`);
  } else {
    lines.push(`${file}: not a conforming OpenWaymark bundle (${counts}).`);
  }
  const notRun = report.checks.filter(
    (check) => check.required && check.status !== "performed" && check.status !== "not-applicable",
  );
  if (report.conformance === "incomplete") {
    for (const check of notRun) {
      lines.push(`  check not performed: ${check.id}${check.reason ? ` (${check.reason})` : ""}`);
    }
  } else if (report.conformance === "not-conforming" && notRun.length > 0) {
    lines.push(
      `  ${notRun.length} later ${notRun.length === 1 ? "check was" : "checks were"} skipped because of the errors below.`,
    );
  }
  if (report.truncated)
    lines.push(`  Only the first ${report.diagnostics.length} problems are listed.`);
  return `${lines.join("\n")}\n`;
}

export function formatScan(result: ScanResult): string {
  switch (result.status) {
    case "clean":
      return `  malware scan: no threats detected by ${result.engine}. Scanners find only known threats.\n`;
    case "threats":
      return `  malware scan: ${result.engine} detected ${result.threats.join(", ") || "a threat"}.\n`;
    case "unavailable":
      return `  malware scan: not performed. ${result.reason}\n`;
    case "error":
      return `  malware scan: could not complete (${result.reason}).\n`;
  }
}

export function formatSummary(
  report: Report,
  assets: { path: string; format: string; width: number; height: number; bytes: number }[],
): string {
  const summary = report.summary;
  if (!summary) return "  No summary: the manifest could not be read.\n";
  const lines = [
    `  title:          ${summary.title ?? "(none)"}`,
    `  id:             ${summary.id ?? "(none)"}`,
    `  version:        ${summary.version ?? "(none)"}`,
    `  language:       ${summary.language ?? "(none)"}`,
    `  format:         ${report.input.form === "archive" ? "archive bundle" : "text bundle"}, OpenWaymark ${summary.formatVersion ?? "?"}`,
    `  questions:      ${summary.questions}`,
    `  flashcards:     ${summary.flashcards}`,
    `  images:         ${summary.assets}`,
    `  size:           ${report.input.bytes} bytes (${summary.uncompressedBytes} uncompressed)`,
  ];
  const integrity = report.checks.find((check) => check.id === "integrity");
  if (report.input.form === "archive") {
    lines.push(
      `  integrity.json: ${integrity?.status === "performed" ? (report.diagnostics.some((d) => d.rule.startsWith("OWM-INT-")) ? "present, does not match" : "present, every file matches") : "absent"}`,
    );
  }
  if (report.fingerprint) lines.push(`  fingerprint:    ${report.fingerprint}`);
  for (const asset of assets)
    lines.push(
      `    ${asset.path}  ${asset.format.toUpperCase()} ${asset.width} × ${asset.height}, ${asset.bytes} bytes`,
    );
  return `${lines.join("\n")}\n`;
}
