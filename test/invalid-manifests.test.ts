// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Invalid manifests that must be rejected, each for a stated rule. These
// guard against a schema or profile check that silently accepts too much.
// They are small and safe; the bounded archive and security fixtures for
// implementers arrive with the engine (M2).

import { describe, expect, it } from "vitest";
import { asText, compileSchema, parseManifest, semanticProblems } from "./support/manifest.js";
import type { Manifest } from "./support/manifest.js";

const validate = compileSchema();

const VALID = `
format_version: "0.1"
id: 3f0c1d52-9a7e-4b9b-8f3e-2d6a1c5b7e90
title: Minimal
version: 1.0.0
language: en
questions:
  - id: q-1
    type: multiple_choice
    selection: single
    prompt:
      text: Pick one.
    choices:
      - id: a
        text: First
      - id: b
        text: Second
    correct_answers: [a]
`;

function base(): Manifest {
  return parseManifest(VALID);
}

function question(manifest: Manifest): Manifest {
  const questions = manifest.questions as Manifest[];
  const first = questions[0];
  if (!first) throw new Error("fixture has no question");
  return first;
}

describe("the minimal manifest", () => {
  it("is valid", () => {
    expect(validate(base())).toBe(true);
    expect(semanticProblems(base())).toEqual([]);
  });
});

describe("schema rejects", () => {
  const cases: [string, (manifest: Manifest) => void][] = [
    ["a missing title (OWM-COL-001)", (m) => delete m.title],
    ["an unsupported format_version (OWM-VER-001)", (m) => (m.format_version = "0.2")],
    ["a numeric format_version (OWM-YAML-006)", (m) => (m.format_version = 0.1)],
    ["an uppercase UUID (OWM-COL-004)", (m) => (m.id = asText(m.id).toUpperCase())],
    ["the nil UUID (OWM-COL-004)", (m) => (m.id = "00000000-0000-0000-0000-000000000000")],
    ["a non-SemVer version (OWM-COL-006)", (m) => (m.version = "1.0")],
    ["a misspelled member (OWM-VER-004)", (m) => (question(m).explaination = { text: "x" })],
    ["a collection with no items (OWM-COL-002)", (m) => delete m.questions],
    ["an empty questions list (OWM-COL-002)", (m) => (m.questions = [])],
    ["an empty tags list (OWM-COL-016)", (m) => (m.tags = [])],
    ["an uppercase tag (OWM-ITEM-004)", (m) => (m.tags = ["DNS"])],
    ["an item id with a space (OWM-ID-001)", (m) => (question(m).id = "q 1")],
    [
      "two correct answers on a single question (OWM-Q-005)",
      (m) => (question(m).correct_answers = ["a", "b"]),
    ],
    ["selection_count on a single question (OWM-Q-005)", (m) => (question(m).selection_count = 1)],
    ["one choice (OWM-Q-003)", (m) => (question(m).choices = [{ id: "a", text: "Only" }])],
    ["an unknown question type (OWM-Q-001)", (m) => (question(m).type = "true_false")],
    ["a blank prompt (OWM-CONT-001)", (m) => (question(m).prompt = { text: "   " })],
    ["an empty content object (OWM-CONT-001)", (m) => (question(m).prompt = {})],
    [
      "an image without alt (OWM-IMG-002)",
      (m) => (question(m).prompt = { image: { src: "assets/a.png" } }),
    ],
    [
      "an asset path with traversal (OWM-IMG-004)",
      (m) => (question(m).prompt = { image: { src: "assets/../a.png", alt: "x" } }),
    ],
    [
      "an SVG asset (OWM-IMG-006)",
      (m) => (question(m).prompt = { image: { src: "assets/a.svg", alt: "x" } }),
    ],
    [
      "an uppercase extension (OWM-IMG-006)",
      (m) => (question(m).prompt = { image: { src: "assets/a.PNG", alt: "x" } }),
    ],
    [
      "an http reference URL (OWM-LINK-001)",
      (m) => (question(m).references = [{ title: "T", url: "http://example.org/" }]),
    ],
    [
      "a URL with user information (OWM-LINK-001)",
      (m) => (question(m).references = [{ title: "T", url: "https://user@example.org/" }]),
    ],
    [
      "credit_url without credit (OWM-IMG-003)",
      (m) =>
        (question(m).prompt = {
          image: { src: "assets/a.png", alt: "x", credit_url: "https://example.org/" },
        }),
    ],
    [
      "a passing percentage of 0 (OWM-COL-014)",
      (m) => (m.practice_defaults = { passing_percentage: 0 }),
    ],
    ["an invalid calendar date (OWM-COL-013)", (m) => (m.created = "2026-02-30")],
    [
      "an extension key that is not a namespace (OWM-EXT-001)",
      (m) => (m.extensions = { difficulty: 2 }),
    ],
    ["an empty license (OWM-COL-010)", (m) => (m.license = {})],
  ];

  it.each(cases)("%s", (_name, mutate) => {
    const manifest = base();
    mutate(manifest);
    expect(validate(manifest)).toBe(false);
  });
});

describe("cross-reference checks reject", () => {
  it("a correct answer that names no choice (OWM-Q-004)", () => {
    const manifest = base();
    question(manifest).correct_answers = ["missing"];
    expect(semanticProblems(manifest)).toEqual([expect.stringContaining("OWM-Q-004")]);
  });

  it("a selection_count that differs from correct_answers (OWM-Q-006)", () => {
    const manifest = base();
    Object.assign(question(manifest), { selection: "multiple", selection_count: 2 });
    expect(semanticProblems(manifest)).toEqual([expect.stringContaining("OWM-Q-006")]);
  });

  it("a flashcard that reuses a question id (OWM-ID-002)", () => {
    const manifest = base();
    manifest.flashcards = [{ id: "q-1", front: { text: "F" }, back: { text: "B" } }];
    expect(semanticProblems(manifest)).toEqual([expect.stringContaining("OWM-ID-002")]);
  });

  it("duplicate choice ids (OWM-ID-003)", () => {
    const manifest = base();
    question(manifest).choices = [
      { id: "a", text: "First" },
      { id: "a", text: "Second" },
    ];
    expect(semanticProblems(manifest)).toEqual([expect.stringContaining("OWM-ID-003")]);
  });
});

describe("the YAML profile rejects", () => {
  const cases: [string, string, string][] = [
    ["two documents", `${VALID}---\n${VALID}`, "OWM-YAML-001"],
    ["a directive", `%YAML 1.2\n---${VALID}`, "OWM-YAML-001"],
    ["an anchor and alias", `${VALID}tags: &t [a]\nsubject: *t\n`, "OWM-YAML-002"],
    ["an explicit tag", `${VALID}subject: !!str Biology\n`, "OWM-YAML-002"],
    ["a duplicate key", `${VALID}title: Again\n`, "Map keys must be unique"],
    ["a null value", `${VALID}subject: ~\n`, "OWM-YAML-008"],
    ["a float", `${VALID}practice_defaults:\n  passing_percentage: 75.0\n`, "OWM-YAML-009"],
    ["infinity", `${VALID}practice_defaults:\n  passing_percentage: .inf\n`, "OWM-YAML-009"],
    ["a complex key", `${VALID}? [a, b]\n: c\n`, "OWM-YAML-003"],
  ];

  it.each(cases)("%s", (_name, source, rule) => {
    expect(() => parseManifest(source)).toThrow(rule);
  });

  it("resolves YAML 1.1 booleans as strings under the core schema (OWM-YAML-005)", () => {
    const manifest = parseManifest(`${VALID}subject: no\n`);
    expect(manifest.subject).toBe("no");
  });
});
