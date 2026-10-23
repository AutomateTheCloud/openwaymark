// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// What a reader shows for a question (spec section 7.3): the order of its
// choices and, in format 0.2, one wording for each choice. Grading never
// depends on either (section 8). This helper lets readers draw the same way
// and stay within OWM-Q-010 and OWM-Q-016.

import type { Mapping, Value } from "./yaml.js";

/** One choice as presented: its identifier and the wording to show. */
export interface PresentedChoice {
  /** The choice's identifier. Grading uses this, whichever wording is shown. */
  id: string;
  /** Index into the choice's `variants`, or null for the choice's own wording. */
  variant: number | null;
  text?: string;
  image?: Mapping;
  /** The wording's language: the variant's, else the choice's (OWM-Q-014). */
  language?: string;
}

const isMapping = (value: Value | undefined): value is Mapping =>
  typeof value === "object" && !Array.isArray(value);

/** An index in [0, length), from a source of numbers in [0, 1). */
function pick(random: () => number, length: number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

function wording(source: Mapping, fallbackLanguage: Value | undefined) {
  const language = source.language ?? fallbackLanguage;
  return {
    ...(typeof source.text === "string" ? { text: source.text } : {}),
    ...(isMapping(source.image) ? { image: source.image } : {}),
    ...(typeof language === "string" ? { language } : {}),
  };
}

/**
 * Chooses how to present a question from a valid bundle: the order of its
 * choices, shuffled unless `shuffle_choices` is false (OWM-Q-010), and one
 * wording for each choice, its own or one of its variants, with every wording
 * equally likely (OWM-Q-016).
 *
 * `random` returns numbers in [0, 1), like Math.random. Pass a seeded source to
 * reproduce a presentation. Keep the result while the learner is on the
 * question, so the wording does not change before feedback (OWM-Q-017).
 */
export function presentQuestion(
  question: Mapping,
  random: () => number = Math.random,
): PresentedChoice[] {
  const choices = (Array.isArray(question.choices) ? question.choices : []).filter(isMapping);
  const presented = choices.map((choice): PresentedChoice => {
    const id = typeof choice.id === "string" ? choice.id : "";
    const variants = (Array.isArray(choice.variants) ? choice.variants : []).filter(isMapping);
    const index = pick(random, variants.length + 1) - 1;
    const variant = variants[index];
    return variant === undefined
      ? { id, variant: null, ...wording(choice, undefined) }
      : { id, variant: index, ...wording(variant, choice.language) };
  });
  if (question.shuffle_choices !== false) {
    // Fisher-Yates: every order equally likely.
    for (let i = presented.length - 1; i > 0; i--) {
      const j = pick(random, i + 1);
      const swap = presented[i];
      const other = presented[j];
      if (swap === undefined || other === undefined) continue;
      presented[i] = other;
      presented[j] = swap;
    }
  }
  return presented;
}
