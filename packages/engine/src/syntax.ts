// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Syntax checks for URLs (OWM-LINK-001), BCP 47 language tags (OWM-COL-008),
// SPDX license expressions (OWM-COL-011), and dates (OWM-COL-013).

import { LIMITS } from "./limits.js";

const URL_CHARACTERS = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;
const PERCENT_ESCAPE = /%(?![0-9A-Fa-f]{2})/;

/** Why a URL does not satisfy OWM-LINK-001, or undefined if it does. */
export function urlProblem(url: string): string | undefined {
  if (url.length > LIMITS.urlChars) return `is longer than ${LIMITS.urlChars} characters`;
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)?.[1];
  if (scheme === undefined) return "is not an absolute URL; only https:// links are permitted";
  if (scheme.toLowerCase() !== "https")
    return `uses the "${scheme}" scheme; only https is permitted`;
  if (!url.slice(scheme.length + 1).startsWith("//")) return "has no host";
  if (!URL_CHARACTERS.test(url) || PERCENT_ESCAPE.test(url)) {
    return "contains characters that are not permitted in a URL (spaces must be written as %20)";
  }
  const authority = /^[^/?#]*/.exec(url.slice(scheme.length + 3))?.[0] ?? "";
  if (authority.includes("@")) return 'contains user information ("user@") before the host';
  const host = authority.startsWith("[")
    ? authority.slice(0, authority.indexOf("]") + 1)
    : authority.replace(/:\d*$/, "");
  if (host === "" || host === "[]") return "has no host";
  return undefined;
}

// RFC 5646 section 2.1, as a regular expression over the whole tag.
const ALPHANUM = "[A-Za-z0-9]";
const LANGTAG = [
  "(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{4}|[A-Za-z]{5,8})", // language, with extlang
  "(?:-[A-Za-z]{4})?", // script
  "(?:-(?:[A-Za-z]{2}|[0-9]{3}))?", // region
  `(?:-(?:${ALPHANUM}{5,8}|[0-9]${ALPHANUM}{3}))*`, // variants
  `(?:-[0-9A-WY-Za-wy-z](?:-${ALPHANUM}{2,8})+)*`, // extensions
  `(?:-x(?:-${ALPHANUM}{1,8})+)?`, // private use
].join("");
const PRIVATE_USE = `x(?:-${ALPHANUM}{1,8})+`;
const GRANDFATHERED = [
  "en-GB-oed",
  "i-ami",
  "i-bnn",
  "i-default",
  "i-enochian",
  "i-hak",
  "i-klingon",
  "i-lux",
  "i-mingo",
  "i-navajo",
  "i-pwn",
  "i-tao",
  "i-tay",
  "i-tsu",
  "sgn-BE-FR",
  "sgn-BE-NL",
  "sgn-CH-DE",
  "art-lojban",
  "cel-gaulish",
  "no-bok",
  "no-nyn",
  "zh-guoyu",
  "zh-hakka",
  "zh-min",
  "zh-min-nan",
  "zh-xiang",
].map((tag) => tag.toLowerCase());
const LANGUAGE_TAG = new RegExp(`^(?:${LANGTAG}|${PRIVATE_USE})$`, "i");

/** Whether a string is a well-formed BCP 47 language tag (RFC 5646 section 2.1). */
export function isWellFormedLanguageTag(tag: string): boolean {
  if (GRANDFATHERED.includes(tag.toLowerCase())) return true;
  if (!LANGUAGE_TAG.test(tag)) return false;
  // Singletons (extension and private-use introducers) must not repeat.
  const subtags = tag.toLowerCase().split("-");
  const singletons = subtags.slice(1).filter((subtag) => subtag.length === 1);
  const beforePrivate = singletons.slice(
    0,
    singletons.indexOf("x") === -1 ? undefined : singletons.indexOf("x"),
  );
  return new Set(beforePrivate).size === beforePrivate.length;
}

/**
 * Whether a string is a syntactically valid SPDX license expression
 * (SPDX 2.3 Annex D): identifiers with an optional "+", WITH exceptions,
 * AND and OR (AND binds tighter), and parentheses.
 */
export function isValidSpdxExpression(expression: string): boolean {
  const tokens = expression.match(/\(|\)|[A-Za-z0-9.+:-]+/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) return false;
  let index = 0;
  const peek = () => tokens[index];
  const isOperator = (token: string | undefined) =>
    ["AND", "OR", "WITH"].includes(token?.toUpperCase() ?? "");
  const license = (): boolean => {
    const token = peek();
    if (token === "(") {
      index++;
      if (!or()) return false;
      if (peek() !== ")") return false;
      index++;
      return true;
    }
    if (token === undefined || token === ")" || isOperator(token)) return false;
    if (
      !/^(?:(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+|[A-Za-z0-9.-]+\+?)$/.test(
        token,
      )
    )
      return false;
    index++;
    if (peek()?.toUpperCase() === "WITH") {
      index++;
      const exception = peek();
      if (
        exception === undefined ||
        isOperator(exception) ||
        !/^(?:AdditionRef-)?[A-Za-z0-9.-]+$/.test(exception)
      )
        return false;
      index++;
    }
    return true;
  };
  const and = (): boolean => {
    if (!license()) return false;
    while (peek()?.toUpperCase() === "AND") {
      index++;
      if (!license()) return false;
    }
    return true;
  };
  const or = (): boolean => {
    if (!and()) return false;
    while (peek()?.toUpperCase() === "OR") {
      index++;
      if (!and()) return false;
    }
    return true;
  };
  return or() && index === tokens.length;
}

/** Whether a string is an RFC 3339 full-date naming a real calendar date. */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= days;
}
