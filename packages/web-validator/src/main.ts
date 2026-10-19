// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The validator page. Results are built with DOM methods and textContent,
// never innerHTML. Diagnostics quote text from the bundle, and a malicious
// bundle must not be able to inject HTML into the page that reports on it.

import type { Diagnostic, Report } from "@automatethecloud/openwaymark-engine";
import type { AssetSummary, Request, Response } from "./protocol.js";
import "./style.css";

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const result = document.querySelector<HTMLElement>("#result");
const body = document.querySelector<HTMLElement>("#result-body");
const bundleInput = document.querySelector<HTMLInputElement>("#bundle-input");
const folderInput = document.querySelector<HTMLInputElement>("#folder-input");
let downloadUrl: string | undefined;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function show(...nodes: Node[]): void {
  if (!result || !body) return;
  body.replaceChildren(...nodes);
  result.hidden = false;
  result.dataset.state = "done";
}

function busy(message: string): void {
  if (!result || !body) return;
  body.replaceChildren(element("p", message, "busy"));
  result.hidden = false;
  result.dataset.state = "busy";
}

function verdict(name: string, report: Report): HTMLElement {
  const box = element("div", undefined, `verdict ${report.conformance}`);
  const headings: Record<Report["conformance"], string> = {
    conforming: `${name} passed the configured checks`,
    "not-conforming": `${name} is not a conforming bundle`,
    incomplete: `${name}: no errors found, but some checks could not run`,
  };
  box.append(element("h3", headings[report.conformance]));
  box.append(
    element(
      "p",
      `${report.errors} ${report.errors === 1 ? "error" : "errors"}, ${report.warnings} ${report.warnings === 1 ? "warning" : "warnings"}.`,
    ),
  );
  if (report.conformance === "conforming") {
    box.append(
      element(
        "p",
        "It follows the format. That does not mean it is safe, or that its answers are right.",
      ),
    );
  }
  return box;
}

function diagnostics(list: Diagnostic[]): HTMLElement {
  const ol = element("ol", undefined, "diagnostics");
  for (const diagnostic of list) {
    const li = element("li", undefined, diagnostic.severity);
    li.append(element("span", diagnostic.severity === "error" ? "Error" : "Warning", "severity"));
    li.append(element("code", diagnostic.rule, "rule"));
    li.append(element("span", diagnostic.message, "message"));
    const location = diagnostic.location;
    if (location) {
      const parts = [
        location.entry,
        location.line === undefined ? undefined : `line ${location.line}`,
        location.pointer || undefined,
      ];
      const text = parts.filter((part) => part !== undefined).join(" · ");
      if (text) li.append(element("span", text, "where"));
    }
    ol.append(li);
  }
  return ol;
}

function summary(report: Report, assets: AssetSummary[]): HTMLElement {
  const dl = element("dl", undefined, "summary");
  const add = (term: string, value: string | number | undefined) => {
    if (value === undefined) return;
    dl.append(element("dt", term), element("dd", String(value)));
  };
  const s = report.summary;
  add("Title", s?.title);
  add("Version", s?.version);
  add("Language", s?.language);
  add("Questions", s?.questions);
  add("Flashcards", s?.flashcards);
  add(
    "Images",
    assets.length > 0
      ? assets.map((a) => `${a.path} (${a.info.width} × ${a.info.height})`).join(", ")
      : s?.assets,
  );
  add("Fingerprint", report.fingerprint);
  return dl;
}

function details(report: Report): HTMLElement {
  const box = element("details");
  box.append(element("summary", "Technical details (JSON report)"));
  const pre = element("pre", JSON.stringify(report, null, 2));
  pre.dataset.testid = "report-json";
  box.append(pre);
  return box;
}

worker.onmessage = (event: MessageEvent<Response>) => {
  const message = event.data;
  if (message.type === "failed") {
    show(
      element(
        "p",
        `Something went wrong while checking: ${message.message}`,
        "verdict not-conforming",
      ),
    );
    return;
  }
  if (message.type === "validated") {
    show(
      verdict(message.name, message.report),
      summary(message.report, message.assets),
      diagnostics(message.report.diagnostics),
      details(message.report),
    );
    return;
  }
  const nodes: Node[] = [verdict("The packed bundle", message.report)];
  if (message.archive) {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(
      new Blob([message.archive as BlobPart], { type: "application/zip" }),
    );
    const link = element("a", "Download bundle.waymark", "download");
    link.href = downloadUrl;
    link.download = "bundle.waymark";
    nodes.push(element("p", "", "download-row"));
    (nodes[nodes.length - 1] as HTMLElement).append(link);
  } else {
    nodes.push(
      element(
        "p",
        "Nothing to download yet. Fix the problems below, then choose the folder again.",
      ),
    );
  }
  if (message.skipped.length > 0)
    nodes.push(element("p", `Left out: ${message.skipped.join(", ")}.`));
  nodes.push(diagnostics(message.report.diagnostics), details(message.report));
  show(...nodes);
};

bundleInput?.addEventListener("change", () => {
  const file = bundleInput.files?.[0];
  if (!file) return;
  busy(`Checking ${file.name}…`);
  worker.postMessage({ type: "validate", file } satisfies Request);
  bundleInput.value = "";
});

folderInput?.addEventListener("change", () => {
  const files = [...(folderInput.files ?? [])].map((file) => ({
    // webkitRelativePath is "chosen-folder/sub/path"; the bundle path drops the first segment.
    path: file.webkitRelativePath.split("/").slice(1).join("/"),
    file,
  }));
  if (files.length === 0) return;
  busy(`Packing ${files.length} files…`);
  worker.postMessage({ type: "pack", files } satisfies Request);
  folderInput.value = "";
});
