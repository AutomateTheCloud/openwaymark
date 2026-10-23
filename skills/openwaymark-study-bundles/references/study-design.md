# Designing study material from a source

How to decide what to test, and how to write questions and flashcards that
teach rather than trip people up. Read this before writing the blueprint.

## Contents

1. Decide what matters
2. The blueprint
3. Writing questions
4. Writing distractors
5. Writing flashcards
6. Explanations, hints, and references
7. Identifiers and tags
8. Verifying against the source
9. Answer variants

## 1. Decide what matters

A learner who masters the bundle should be able to do what the source says
they should be able to do. Look for importance signals in roughly this order:

1. **Stated learning objectives.** Textbooks often list them at the start of a
   section ("By the end of this section, you will be able to..."). Every
   objective gets items. The verb in the objective sets the depth: "define"
   and "list" call for recall; "explain", "compare", and "describe how" call
   for understanding; "predict", "apply", and "calculate" call for
   application.
2. **Key terms and the glossary.** Bold terms are the vocabulary the rest of
   the course builds on. Each gets a flashcard, and the important ones also
   appear inside questions, used rather than defined.
3. **Section summaries.** What the author restated at the end is what the
   author thought mattered.
4. **Figures and tables.** A comparison table or a process diagram usually
   holds the relationships the text spreads over pages. Tables are a rich
   source of "which of these..." and compare-and-contrast questions.
5. **The book's own review questions.** They show the depth the authors
   expected. Use them to check coverage, never as text to copy (see the
   licensing reference: even when copying is allowed, original items teach
   better and avoid reproducing an answer key that learners may have seen).

Leave out:

- trivia that no objective needs: dates, discoverers' names, exact numbers
  quoted only for color ("about 250 red blood cells fit on a pin head");
- career boxes, anecdotes, and "try this interactive" asides, unless they
  carry a core idea;
- anything the source itself marks as uncertain or debated, unless the item
  tests that it is debated.

When the source is not a textbook (lecture notes, a manual, a paper), infer
objectives from headings, repeated ideas, definitions, and conclusions, and
list the inferred objectives in the review report so a human can correct them.

## 2. The blueprint

Before writing items, write a blueprint: a table of objectives with the
number and kind of items for each. It is the plan a reviewer can check in two
minutes, and it is what stops a bundle from turning into forty definition
cards.

| Section | Objective (from the source, or inferred) | Level | Questions | Cards |
| ------- | ---------------------------------------- | ----- | --------- | ----- |

Rules of thumb for one textbook chapter of 10,000 to 20,000 words:

- **Questions: about 25 to 45,** at least 1 per objective and 2 to 4 for
  central ones.
- **Flashcards: one per key term,** plus cards for facts worth instant recall
  that are not glossary terms (a structure and its function, a cause and its
  effect). Skip terms too trivial to need a card, and say so in the report. A
  term-heavy chapter can need 50 or more cards; that is fine.
- **Size:** past about 100 items in all, consider splitting the chapter into
  two bundles, and ask if the person has not said what they want.
- **Levels:** flashcards carry recall, so the questions should lean toward
  understanding and application: roughly a quarter recall, half
  understanding, and a quarter application. Shift toward recall for
  introductory material and away from it for advanced material.

Respect the person's requests over these defaults: if they ask for flashcards
only, or 10 questions, do that. When a requested size cannot cover every
objective with the counts above, say in the blueprint how you divided it
(for example, 1 question per objective, choosing the objectives the review
questions emphasize when there are more objectives than questions).

## 3. Writing questions

Every OpenWaymark question is multiple choice, with one correct answer
(`selection: single`) or several (`selection: multiple`). Good items follow
long-standing item-writing guidance:

- **One idea per question.** If you need "and" to say what it tests, split it.
- **The stem is a complete question.** A learner should be able to answer it
  with the choices covered. "Which organelle produces most of a cell's ATP?"
  is better than "Mitochondria:".
- **Test understanding, not wording.** Paraphrase the source. A question that
  can be answered by matching a phrase from the text tests reading memory,
  not knowledge.
- **Application questions describe a situation.** "A red blood cell is placed
  in a solution with a higher solute concentration than its cytoplasm. What
  happens to the cell?" tests whether tonicity is understood; "What is a
  hypertonic solution?" tests a definition, which belongs on a card.
- **Avoid negative stems** ("Which is NOT..."). When one is unavoidable, put
  the negative word in capitals and keep such items rare.
- **Never "all of the above" or "none of the above".** Learners can answer
  them by partial knowledge, and they break when choices are shuffled. Use a
  `selection: multiple` question instead.
- **Use `selection: multiple` when the knowledge is a set:** "Which of these
  are found in both plant and animal cells? Select all that apply." Include
  `selection_count` only when the stem says how many ("Which two...").
- **Four choices** is the default. Three good choices beat four with a filler.
- **Keep the choices parallel:** the same grammatical form, similar length,
  and the same level of detail. The correct choice is the one most often
  longer and more qualified; watch for that.
- **Vary the position of the correct answer.** Readers usually shuffle, but not
  all do, and `shuffle_choices: false` items keep their order.
- **Stay within the source's scope.** If the source simplifies (introductory
  texts often do), test at the source's level; do not test a nuance the
  learner was never taught. If the source's simplification is actually wrong,
  leave the fact out and flag it in the report, rather than teaching the error
  or contradicting the textbook the learner is using.

## 4. Writing distractors

Distractors decide whether a question measures anything. Each wrong choice
should be attractive to a learner with a specific gap, and clearly wrong to a
learner who has mastered the idea.

Good sources of distractors:

- **Real misconceptions,** especially ones the source warns about ("Students
  often think water moves toward lower solute concentration...").
- **Neighboring concepts** from the same chapter: another organelle, the
  opposite process, a related term.
- **Reversals:** the right relationship in the wrong direction.
- **Partly true statements** that fail on the one point being tested.

Avoid distractors that are absurd, joke answers, or wrong only on a
technicality, and distractors that are true but do not answer the question
(two defensible answers make the item unfair). Avoid giving the right answer
away with absolute words ("always", "never") on the distractors only.

When a distractor reflects a common misconception, give it a per-choice
`explanation` that says why it is tempting and why it is wrong. That is where
much of the learning happens.

## 5. Writing flashcards

- **One fact per card.** The back should be answerable in a few seconds. A
  back longer than about 40 words is usually two cards, or a question.
- **The front is unambiguous.** "Function of the Golgi apparatus?" has one
  answer at the source's level; "Golgi?" does not.
- **Term cards go term to definition.** For the most important terms, a
  reverse card (definition to term) also helps, but use it sparingly and give
  it its own `id`.
- **Avoid lists longer than three** on the back. A list of seven organelles is
  hard to recall as a unit; break it up, or ask a `selection: multiple`
  question instead. The exception is a set learners are expected to know as a
  unit, often by a mnemonic, such as the fat-soluble vitamins A, D, E, and K.
- **Use the source's terms.** A learner studying from this textbook should see
  its vocabulary.
- **Do not copy glossary definitions verbatim** as a rule. Tighten them into
  the shortest accurate answer; keep the source's wording only where it is
  already the clearest form.

## 6. Explanations, hints, and references

- Every question gets an `explanation`: why the correct answer is right, in two
  to four sentences, ideally restating the underlying idea so the explanation
  teaches even a learner who guessed correctly.
- Add per-choice explanations for distractors that encode a misconception.
- A `hint` points at the concept without naming the answer ("Think about which
  side has more water molecules, not more solute.").
- Every item gets a `references` entry: `title` is the source's title, and
  `reference` is the most specific location, such as
  `Chapter 3, Section 3.5, Passive Transport: Tonicity`. A reviewer uses it to
  check the item; a learner uses it to go back and read.

## 7. Identifiers and tags

- IDs describe the content and stay stable across versions: `osmosis-direction`,
  `golgi-function-card`. Never number by position (`q1`, `choice-a`). Choice IDs
  name the choice: `hypertonic`, `golgi`, `cell-wall`.
- Tags group items for practice: one tag per section topic (`passive-transport`,
  `organelles`), and optionally the level (`recall`, `understanding`,
  `application`). Lowercase words joined by hyphens.

## 8. Verifying against the source

A validator says the bundle is well-formed; it says nothing about whether the
answers are right. Before finishing:

1. **Ground every item.** For each item, find the passage in the source that
   supports its correct answer. If you cannot find it, the item is either
   outside the source (cut it, unless the person asked for broader coverage)
   or wrong.
2. **Solve the questions blind.** Answer each question from the source alone,
   without looking at the keyed answer. Best is a fresh helper that sees only
   the questions and the source. Any disagreement with the key means the item
   is wrong, ambiguous, or has two defensible answers. Fix or cut it.
3. **Check that distractors are really wrong,** at the source's level and in
   the real world.
4. **Read the bundle as a learner** once, start to finish: repetitive items,
   cards and questions that test the same fact the same way, and gaps against
   the blueprint all show up.

## 9. Answer variants

Write variants only when the person asks for them (they need format draft
0.2). A variant is another wording of a choice; the app shows each choice in
one of its wordings, picked at random, so a learner has to recognize what the
answer means, not what it looks like.

- **Change the words, not the claim.** Paraphrase: other vocabulary, other
  sentence structure, the idea from another angle ("toward the more
  concentrated solution" for "toward the side with more solute"). Do not add
  or drop a qualifier, change the scope, or make the statement more precise.
  If a learner could reasonably judge one wording right and another wrong,
  one of them is a different claim.
- **Vary the distractors as much as the correct answer.** If only the correct
  choice changes from one attempt to the next, it becomes the one that looks
  unfamiliar, which is a new giveaway.
- **Keep every wording interchangeable.** Wordings are drawn separately for
  each choice, so any wording of one choice can appear beside any wording of
  another. Keep them all in the same grammatical form, at the same level of
  detail, and of similar length. "Port 443" beside a bare "80" and "8080"
  gives the answer away.
- **Two or three variants per choice is usually enough.** More than that tends
  to drift in meaning. The format allows up to 8.
- **Leave out variants where wording is the point:** numbers, formulas, names,
  and other answers with one standard form. A question can mix choices with
  and without variants.
- **Explanations cover all wordings.** Write the choice's `explanation` so it
  makes sense whichever wording the learner saw.
- **Check variants like answers.** The blind check (section 8) must also
  confirm that every wording of a choice makes the same claim.
