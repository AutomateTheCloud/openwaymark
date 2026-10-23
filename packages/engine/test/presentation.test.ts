// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// presentQuestion: every choice shown once, in one wording (OWM-Q-016), in the
// manifest's order when shuffling is off (OWM-Q-010).

import { describe, expect, it } from "vitest";
import { gradeResponse } from "../src/grading.js";
import { presentQuestion } from "../src/presentation.js";
import type { Mapping } from "../src/yaml.js";

/** A small seeded generator (mulberry32), so results are reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const question: Mapping = {
  id: "osmosis-direction",
  choices: [
    {
      id: "toward-more-solute",
      text: "Toward the side with more solute",
      variants: [
        { text: "From lower to higher solute concentration" },
        { text: "Hacia el lado con más soluto", language: "es" },
      ],
    },
    { id: "toward-less-solute", text: "Toward the side with less solute", language: "en-GB" },
    {
      id: "no-movement",
      text: "It does not move without energy",
      language: "en-GB",
      variants: [{ text: "Only when energy is supplied" }],
    },
  ],
  correct_answers: ["toward-more-solute"],
};

describe("presentQuestion", () => {
  it("shows every choice exactly once", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const ids = presentQuestion(question, seeded(seed)).map((choice) => choice.id);
      expect([...ids].sort()).toEqual(["no-movement", "toward-less-solute", "toward-more-solute"]);
    }
  });

  it("keeps the manifest's order when shuffle_choices is false", () => {
    const fixed = { ...question, shuffle_choices: false };
    for (let seed = 1; seed <= 20; seed++) {
      expect(presentQuestion(fixed, seeded(seed)).map((choice) => choice.id)).toEqual([
        "toward-more-solute",
        "toward-less-solute",
        "no-movement",
      ]);
    }
  });

  it("is reproducible with the same random source", () => {
    expect(presentQuestion(question, seeded(7))).toEqual(presentQuestion(question, seeded(7)));
  });

  it("uses the choice's own wording or one of its variants", () => {
    const fixed = { ...question, shuffle_choices: false };
    expect(presentQuestion(fixed, () => 0)[0]).toEqual({
      id: "toward-more-solute",
      variant: null,
      text: "Toward the side with more solute",
    });
    expect(presentQuestion(fixed, () => 0.9999)[0]).toEqual({
      id: "toward-more-solute",
      variant: 1,
      text: "Hacia el lado con más soluto",
      language: "es",
    });
  });

  it("gives a variant without a language the choice's language (OWM-Q-014)", () => {
    const fixed = { ...question, shuffle_choices: false };
    expect(presentQuestion(fixed, () => 0.9999)[2]).toEqual({
      id: "no-movement",
      variant: 0,
      text: "Only when energy is supplied",
      language: "en-GB",
    });
  });

  it("makes every wording about equally likely", () => {
    const random = seeded(42);
    const counts = new Map<string, number>();
    const draws = 3000;
    for (let i = 0; i < draws; i++) {
      const shown = presentQuestion(question, random).find((c) => c.id === "toward-more-solute");
      const key = String(shown?.variant);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const key of ["null", "0", "1"]) {
      expect(counts.get(key) ?? 0).toBeGreaterThan(draws / 3 - 150);
      expect(counts.get(key) ?? 0).toBeLessThan(draws / 3 + 150);
    }
  });

  it("does not change grading, which uses identifiers (OWM-GRADE-002)", () => {
    const correct = question.correct_answers as string[];
    for (let seed = 1; seed <= 10; seed++) {
      const shown = presentQuestion(question, seeded(seed));
      const picked = shown.find((choice) => choice.id === "toward-more-solute");
      expect(gradeResponse(correct, picked ? [picked.id] : [])).toBe("correct");
    }
  });
});
