// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// Grading (spec section 8). Readers use these functions so that every
// implementation scores the same response the same way.

export type Grade = "correct" | "incorrect" | "unanswered";

/**
 * Grades a response: the set of selected choice identifiers. Correct if and
 * only if it equals the set of correct answers (OWM-GRADE-002). Order and
 * repetition do not matter (OWM-GRADE-003).
 */
export function gradeResponse(
  correctAnswers: readonly string[],
  selected: Iterable<string>,
): Grade {
  const response = new Set(selected);
  if (response.size === 0) return "unanswered";
  const correct = new Set(correctAnswers);
  if (response.size !== correct.size) return "incorrect";
  for (const id of response) if (!correct.has(id)) return "incorrect";
  return "correct";
}

/**
 * Whether `correct` out of `total` questions meets a passing percentage, by
 * exact integer arithmetic: correct × 100 ≥ percentage × total
 * (OWM-GRADE-005). Unanswered questions count in `total`.
 */
export function meetsPassingPercentage(
  correct: number,
  total: number,
  passingPercentage: number,
): boolean {
  if (
    !Number.isInteger(correct) ||
    !Number.isInteger(total) ||
    !Number.isInteger(passingPercentage)
  ) {
    throw new RangeError("correct, total, and passingPercentage must be integers");
  }
  if (total <= 0 || correct < 0 || correct > total)
    throw new RangeError("0 ≤ correct ≤ total, and total > 0");
  return correct * 100 >= passingPercentage * total;
}
