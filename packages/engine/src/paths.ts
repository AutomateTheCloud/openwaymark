// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Entry names (spec sections 3.3 and 3.4) and asset paths (section 10.1).

import { LIMITS } from "./limits.js";

export const MANIFEST_NAME = "study.yaml";
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
const IMAGE_EXTENSION = /\.(png|jpg|jpeg|webp)$/;
const IGNORABLE_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export type ImageFormat = "png" | "jpeg" | "webp";

/** Problems with an entry name under OWM-PATH-001, or undefined if it is acceptable. */
export function entryNameProblem(name: string): string | undefined {
  for (let index = 0; index < name.length; index++) {
    const code = name.charCodeAt(index);
    if (code < 0x21 || code > 0x7e) {
      return `contains ${code === 0x20 ? "a space" : `the byte 0x${code.toString(16).padStart(2, "0")}`}; names must be printable ASCII without spaces`;
    }
  }
  if (name.includes("\\")) return "contains a backslash";
  if (name.startsWith("/")) return "is an absolute path";
  const segments = (name.endsWith("/") ? name.slice(0, -1) : name).split("/");
  if (segments.some((segment) => segment === "")) return "contains an empty path segment";
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return 'contains a "." or ".." segment';
  }
  return undefined;
}

/** Whether an entry is operating-system metadata that readers ignore (OWM-PATH-004). */
export function isIgnorable(name: string): boolean {
  if (name === "__MACOSX/" || name.startsWith("__MACOSX/")) return true;
  const last =
    name
      .split("/")
      .filter((part) => part !== "")
      .pop() ?? "";
  return !name.endsWith("/") && IGNORABLE_FILES.has(last);
}

/** Problems with an asset path under OWM-IMG-004 and OWM-IMG-006, or undefined. */
export function assetPathProblem(path: string): string | undefined {
  if (!path.startsWith("assets/")) return 'does not begin with "assets/"';
  if (path.length > LIMITS.assetPathBytes) return `is longer than ${LIMITS.assetPathBytes} bytes`;
  const segments = path.slice("assets/".length).split("/");
  if (segments.length > LIMITS.assetSegments)
    return `has more than ${LIMITS.assetSegments} segments after "assets/"`;
  if (segments.some((segment) => !SEGMENT.test(segment))) {
    return "has a segment that is empty, starts with a dot, is longer than 100 characters, or uses characters other than letters, digits, '.', '_', and '-'";
  }
  if (!IMAGE_EXTENSION.test(path)) {
    return /\.(png|jpe?g|webp)$/i.test(path)
      ? "has an uppercase file extension; extensions must be lowercase"
      : "does not end in .png, .jpg, .jpeg, or .webp";
  }
  return undefined;
}

/** Problems with a directory entry under OWM-PATH-006, or undefined. */
export function directoryProblem(name: string): string | undefined {
  if (isIgnorable(name) || name === "assets/") return undefined;
  if (!name.startsWith("assets/"))
    return 'directories other than "assets/" and its subdirectories are not permitted';
  const segments = name.slice("assets/".length, -1).split("/");
  return segments.every((segment) => SEGMENT.test(segment))
    ? undefined
    : "has a segment that does not satisfy the asset path rules";
}

export function formatFromExtension(path: string): ImageFormat | undefined {
  const match = IMAGE_EXTENSION.exec(path);
  if (!match) return undefined;
  return match[1] === "png" ? "png" : match[1] === "webp" ? "webp" : "jpeg";
}
