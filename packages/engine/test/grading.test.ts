// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Grading is the part of the format where a bug would quietly mark a right
// answer wrong. These properties hold for every response, not just examples.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gradeResponse, meetsPassingPercentage } from "../src/grading.js";

const ids = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/), {
  minLength: 1,
  maxLength: 10,
});

describe("gradeResponse", () => {
  it("is correct for exactly the correct set, in any order (OWM-GRADE-002, OWM-GRADE-003)", () => {
    fc.assert(
      fc.property(ids, (correct) => {
        const shuffled = [...correct].reverse();
        return gradeResponse(correct, shuffled) === "correct";
      }),
    );
  });

  it("does not depend on how choices or answers are ordered", () => {
    fc.assert(
      fc.property(ids, fc.array(fc.nat()), (correct, picks) => {
        const all = [...correct, "distractor-1", "distractor-2"];
        const selected = picks.map((pick) => all[pick % all.length] ?? "");
        const expected = gradeResponse(correct, selected);
        return gradeResponse([...correct].reverse(), [...selected].reverse()) === expected;
      }),
    );
  });

  it("is incorrect when anything is missing or extra (no partial credit)", () => {
    fc.assert(
      fc.property(ids, (correct) => {
        const missing = correct.slice(1);
        const extra = [...correct, "not-correct"];
        return (
          (missing.length === 0 || gradeResponse(correct, missing) === "incorrect") &&
          gradeResponse(correct, extra) === "incorrect"
        );
      }),
    );
  });

  it("is unanswered for an empty response", () => {
    expect(gradeResponse(["a"], [])).toBe("unanswered");
  });
});

describe("meetsPassingPercentage (OWM-GRADE-005)", () => {
  it("agrees with exact rational comparison", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.nat(),
        fc.integer({ min: 1, max: 100 }),
        (total, raw, percentage) => {
          const correct = raw % (total + 1);
          return (
            meetsPassingPercentage(correct, total, percentage) ===
            BigInt(correct) * 100n >= BigInt(percentage) * BigInt(total)
          );
        },
      ),
    );
  });

  it("treats 7 of 9 (77.8%) as meeting 77 and not 78, whatever a display rounds to", () => {
    expect(meetsPassingPercentage(7, 9, 77)).toBe(true);
    expect(meetsPassingPercentage(7, 9, 78)).toBe(false);
  });

  it("rejects impossible inputs", () => {
    expect(() => meetsPassingPercentage(5, 4, 50)).toThrow(RangeError);
    expect(() => meetsPassingPercentage(1, 0, 50)).toThrow(RangeError);
  });
});
