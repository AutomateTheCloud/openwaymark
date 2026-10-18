// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The same engine must reach the same verdict in a browser as in Node (spec
// requirement VAL-01 in the project's traceability). Every conformance fixture
// is uploaded to the real page, and its report is compared with Node's: the
// verdict and the set of rules reported. Image decoding differs (the browser's
// decoder versus sharp), so this is also a test that both decoders agree on
// every fixture image.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { bytesSource, validateBundle, type Report } from "@openwaymark/engine";
import { sharpDecoder as nodeDecoder } from "../../cli/src/decoder.js";

const REPO = new URL("../../../", import.meta.url).pathname;
const FIXTURES = join(REPO, "fixtures");

const fixtures = readdirSync(FIXTURES)
  .filter((name) => statSync(join(FIXTURES, name)).isDirectory())
  .sort()
  .map((id) => {
    const dir = join(FIXTURES, id);
    return {
      id,
      input: existsSync(join(dir, "input.waymark"))
        ? join(dir, "input.waymark")
        : join(dir, "input.yaml"),
    };
  });

const rulesOf = (report: Report) => [...new Set(report.diagnostics.map((d) => d.rule))].sort();

for (const fixture of fixtures) {
  test(`fixture ${fixture.id} matches Node`, async ({ page }) => {
    const { report: expected } = await validateBundle(bytesSource(readFileSync(fixture.input)), {
      imageDecoder: nodeDecoder,
      lint: true,
    });
    await page.goto("/");
    await page.getByTestId("bundle-input").setInputFiles(fixture.input);
    const json = page.getByTestId("report-json");
    await expect(json).toBeAttached({ timeout: 20_000 });
    const actual = JSON.parse((await json.textContent()) ?? "{}") as Report;
    expect(actual.conformance).toBe(expected.conformance);
    expect(rulesOf(actual)).toEqual(rulesOf(expected));
    expect(actual.fingerprint).toBe(expected.fingerprint);
  });
}

test("the page sends nothing over the network while validating", async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page
    .getByTestId("bundle-input")
    .setInputFiles(join(FIXTURES, "valid-archive-images/input.waymark"));
  await expect(page.getByTestId("report-json")).toBeAttached();
  // blob: URLs are the worker reading the chosen file locally, which WebKit reports as requests.
  const origin = baseURL ?? "http://localhost:4173";
  for (const url of requests)
    expect(url.startsWith(origin) || url.startsWith(`blob:${origin}`), url).toBe(true);
  // The Content Security Policy blocks requests even if code tried to make one.
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.org/");
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

test("a malicious bundle's text is shown as text, not HTML", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("bundle-input")
    .setInputFiles(join(FIXTURES, "markdown-event-handler/input.yaml"));
  await expect(page.getByTestId("report-json")).toBeAttached();
  await expect(page.locator("#result img")).toHaveCount(0);
  await expect(page.locator("#result")).toContainText("<img src=x onerror=alert(1)>");
});
