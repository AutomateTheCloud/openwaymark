// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  isValidDate,
  isValidSpdxExpression,
  isWellFormedLanguageTag,
  urlProblem,
} from "../src/syntax.js";

describe("urlProblem (OWM-LINK-001)", () => {
  it.each([
    "https://example.org",
    "https://example.org/a?b=c#d",
    "https://[2001:db8::1]:8443/x",
    "https://example.org/a%20b",
  ])("accepts %s", (url) => {
    expect(urlProblem(url)).toBeUndefined();
  });

  it.each([
    ["http://example.org", "scheme"],
    ["javascript:alert(1)", "scheme"],
    ["data:text/html,hi", "scheme"],
    ["/relative/path", "absolute"],
    ["https:example.org", "host"],
    ["https://", "host"],
    ["https://user@example.org", "user information"],
    ["https://good.example@evil.example/", "user information"],
    ["https://example.org/a b", "characters"],
    ["https://example.org/%zz", "characters"],
  ])("rejects %s", (url, reason) => {
    expect(urlProblem(url)).toContain(reason);
  });
});

describe("isWellFormedLanguageTag (OWM-COL-008)", () => {
  // Well-formed is about syntax only. "english" is well-formed (RFC 5646 allows
  // 5 to 8 letter language subtags) even though no such subtag is registered;
  // checking the registry is a separate, optional lint (OWM-LINT-018).
  it.each([
    "en",
    "en-US",
    "pt-BR",
    "zh-Hant-TW",
    "sr-Latn-RS",
    "de-CH-1996",
    "es-419",
    "x-private",
    "i-klingon",
    "en-a-bbb-x-ccc",
  ])("accepts %s", (tag) => {
    expect(isWellFormedLanguageTag(tag)).toBe(true);
  });

  it.each(["", "e", "englishes", "en_US", "en-", "en--US", "123", "en-a-bbb-a-ccc"])(
    "rejects %s",
    (tag) => {
      expect(isWellFormedLanguageTag(tag)).toBe(false);
    },
  );
});

describe("isValidSpdxExpression (OWM-COL-011)", () => {
  it.each([
    "MIT",
    "Apache-2.0",
    "CC-BY-NC-4.0",
    "GPL-2.0+",
    "MIT OR Apache-2.0",
    "(MIT AND BSD-3-Clause) OR Apache-2.0",
    "GPL-2.0-only WITH Classpath-exception-2.0",
    "LicenseRef-ATC-Training",
    "DocumentRef-x:LicenseRef-y",
  ])("accepts %s", (expression) => {
    expect(isValidSpdxExpression(expression)).toBe(true);
  });

  it.each(["", "MIT OR", "AND MIT", "(MIT", "MIT)", "MIT WITH", "Free for everyone!"])(
    "rejects %s",
    (expression) => {
      expect(isValidSpdxExpression(expression)).toBe(false);
    },
  );
});

describe("isValidDate (OWM-COL-013)", () => {
  it("knows leap years", () => {
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2000-02-29")).toBe(true);
    expect(isValidDate("1900-02-29")).toBe(false);
  });

  it("rejects other forms", () => {
    for (const value of [
      "2026-13-01",
      "2026-00-10",
      "2026-1-01",
      "18 October 2026",
      "2026-10-18T00:00:00Z",
    ]) {
      expect(isValidDate(value), value).toBe(false);
    }
  });
});
