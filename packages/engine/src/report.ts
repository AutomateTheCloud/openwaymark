// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The validation report (spec section 15): diagnostics with rule identifiers
// and locations, the checks performed or skipped, and the verdict.

export type Severity = "error" | "warning";

export interface Location {
  /** Archive entry name, such as `study.yaml` or `assets/a.png`. */
  entry?: string;
  /** JSON Pointer (RFC 6901) into the manifest data model. */
  pointer?: string;
  /** 1-based line and column in the manifest, when known. */
  line?: number;
  column?: number;
}

export interface Diagnostic {
  rule: string;
  severity: Severity;
  message: string;
  location?: Location;
}

/** Identifiers of the checks a validation can perform. */
export type CheckId =
  | "archive-structure"
  | "entry-names"
  | "resource-limits"
  | "encoding"
  | "yaml-profile"
  | "manifest-structure"
  | "cross-references"
  | "markdown-profile"
  | "image-signatures"
  | "image-dimensions"
  | "image-decode"
  | "spdx-syntax"
  | "integrity"
  | "lint"
  | "spdx-license-list"
  | "language-subtag-registry"
  | "malware-scan";

/**
 * "not-applicable" means the check has nothing to examine, such as image
 * checks for a bundle without images, and does not make a result incomplete.
 */
export type CheckStatus = "performed" | "not-applicable" | "skipped" | "not-reached";

export interface CheckRecord {
  id: CheckId;
  status: CheckStatus;
  /** Why a check was skipped or not reached. */
  reason?: string;
  /** Whether conformance depends on this check (OWM-VAL-003). */
  required: boolean;
}

/** Checks that conformance depends on. The rest are lint or optional extras. */
export const REQUIRED_CHECKS: readonly CheckId[] = [
  "archive-structure",
  "entry-names",
  "resource-limits",
  "encoding",
  "yaml-profile",
  "manifest-structure",
  "cross-references",
  "markdown-profile",
  "image-signatures",
  "image-dimensions",
  "image-decode",
  "spdx-syntax",
  "integrity",
];

export type Conformance = "conforming" | "not-conforming" | "incomplete";

export interface BundleSummary {
  formatVersion?: string;
  id?: string;
  title?: string;
  version?: string;
  language?: string;
  questions: number;
  flashcards: number;
  assets: number;
  /** Total uncompressed bytes of the manifest and assets. */
  uncompressedBytes: number;
}

export interface Report {
  engine: { name: "@openwaymark/engine"; version: string };
  supportedFormatVersions: readonly string[];
  input: { form: "archive" | "text"; bytes: number };
  /**
   * "conforming" only when no error was found and every required check ran
   * (OWM-VAL-002). "incomplete" when no error was found but a required check
   * could not run. Never a statement that the bundle is safe (OWM-SEC-006).
   */
  conformance: Conformance;
  errors: number;
  warnings: number;
  diagnostics: Diagnostic[];
  /** True when more diagnostics were found than `maxDiagnostics` allows. */
  truncated: boolean;
  checks: CheckRecord[];
  summary?: BundleSummary;
  /** Content fingerprint (OWM-UPD-005), present for conforming bundles. */
  fingerprint?: string;
}

/** Rules whose violations are warnings rather than errors. */
const WARNING_RULES = new Set(["OWM-PATH-005", "OWM-COL-011", "OWM-SIG-002"]);

export function severityOf(rule: string): Severity {
  return rule.startsWith("OWM-LINT-") || WARNING_RULES.has(rule) ? "warning" : "error";
}

/** Accumulates diagnostics and check records while a validation runs. */
export class ReportBuilder {
  readonly diagnostics: Diagnostic[] = [];
  private readonly checks = new Map<CheckId, CheckRecord>();
  private errorCount = 0;
  private warningCount = 0;
  truncated = false;

  constructor(private readonly maxDiagnostics: number) {}

  add(rule: string, message: string, location?: Location): void {
    const severity = severityOf(rule);
    if (severity === "error") this.errorCount++;
    else this.warningCount++;
    if (this.diagnostics.length >= this.maxDiagnostics) {
      this.truncated = true;
      return;
    }
    const diagnostic: Diagnostic = { rule, severity, message };
    if (location && Object.keys(location).length > 0) diagnostic.location = location;
    this.diagnostics.push(diagnostic);
  }

  get errors(): number {
    return this.errorCount;
  }

  get warnings(): number {
    return this.warningCount;
  }

  check(id: CheckId, status: CheckStatus, reason?: string): void {
    const record: CheckRecord = { id, status, required: REQUIRED_CHECKS.includes(id) };
    if (reason !== undefined) record.reason = reason;
    this.checks.set(id, record);
  }

  hasCheck(id: CheckId): boolean {
    return this.checks.has(id);
  }

  /** Marks every required check that has not been recorded as not reached. */
  finishChecks(reason: string): CheckRecord[] {
    for (const id of REQUIRED_CHECKS) {
      if (!this.checks.has(id)) this.check(id, "not-reached", reason);
    }
    return [...this.checks.values()];
  }

  conformance(checks: readonly CheckRecord[]): Conformance {
    if (this.errorCount > 0) return "not-conforming";
    const incomplete = checks.some(
      (check) =>
        check.required && check.status !== "performed" && check.status !== "not-applicable",
    );
    return incomplete ? "incomplete" : "conforming";
  }
}
