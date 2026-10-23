# Instructions for AI-assisted authoring of OpenWaymark bundles

_Draft for format version 0.1._ Give this whole document to an AI assistant,
followed by your request. For example: "Using these instructions, write 20
practice questions on DNS for a networking certification, with explanations."
The output is a bundle manifest you then check with a validator and review
yourself.

---

## Your role

You write study content in the **OpenWaymark** format, draft 0.1: practice
questions and flashcards in YAML. Your output must be valid without any
manual repair, and accurate enough that a careful human reviewer finds few
errors.

## Output

Produce one YAML document: the content of `study.yaml`. Do not wrap it in
explanation. If the person asked for images, also list the image files they
need to supply, with the exact paths you used.

Start with this header, replacing the values:

```yaml
format_version: "0.1"
id: <a new random UUID, lowercase, e.g. 0b4c7a8e-2f61-4d0a-9c3e-5a7b1d2e4f60>
title: <title>
version: 1.0.0
language: <BCP 47 tag, e.g. en>
```

If the person is updating an existing bundle, keep its `id`, keep every
existing item and choice `id` unchanged, and increase `version`.

## Structure

```yaml
questions:
  - id: <lowercase-id>
    type: multiple_choice
    selection: single # or: multiple
    prompt:
      text: <the question>
    choices:
      - id: <choice-id>
        text: <choice text>
        explanation: # optional, per choice
          text: <why this choice is right or wrong>
      - id: <choice-id>
        text: <choice text>
    correct_answers: [<choice-id>]
    selection_count: 2 # only for selection: multiple, equal to the number of correct answers
    shuffle_choices: false # only when choice order matters
    hint: # optional
      text: <a nudge that does not give the answer away>
    explanation: # recommended
      text: <why the answer is correct>
    tags: [<tag>, <tag>]
    references: # optional
      - title: <source title>
        reference: <chapter, section, or page>

flashcards:
  - id: <lowercase-id>
    front:
      text: <prompt>
    back:
      text: <answer>
    tags: [<tag>]
```

## Hard rules

Breaking any of these makes the bundle invalid.

1. **Identifiers.** Item and choice IDs use only `a-z`, `0-9`, `-`, and `_`, start
   with a letter or digit, and are at most 64 characters long. Every question
   and flashcard ID is unique across the whole file. Choice IDs are unique
   within their question. Never base an ID on a position, such as `q1-choice-a`.
   Base it on the content, such as `dns-port-001` or `port-53`.
2. **Choices.** Each question has 2 to 26 choices, usually 4. `correct_answers`
   lists choice IDs, never letters.
3. **Single answer.** `selection: single` needs exactly one ID in
   `correct_answers`, and no `selection_count`.
4. **Multiple answers.** With `selection: multiple`, `correct_answers` lists
   every correct choice. If you include `selection_count`, it must equal that
   number. Use it when the question says how many to choose ("Which two…").
   Omit it when the learner should decide ("Select all that apply").
5. **Strings.** Quote any text that YAML could misread:
   - numbers used as text (`text: "53"`);
   - `format_version: "0.1"`;
   - dates;
   - `yes`, `no`, `on`, `off`;
   - text containing `: `;
   - text starting with `[`, `{`, `*`, `&`, `!`, `%`, `@`, `` ` ``, `'`, or `"`.

   For multi-line text, use `text: |`.

6. **No YAML features.** No anchors (`&`), aliases (`*`), tags (`!!`), or
   `null`/`~` values. If an optional field has no value, leave it out.
7. **Markdown only, no HTML.** Text may use `**bold**`, `_italic_`, `` `code` ``,
   lists, block quotes, fenced code blocks, and tables. Never write HTML tags.
   Never use headings (`#`) in questions or cards.
8. **Code and attack strings go in backticks.** Commands, code, HTML, and
   security payloads must be in code spans or fenced code blocks. Then they are
   shown as text.
9. **Links.** Only `https://` links. **Do not invent URLs.** Include a URL only
   if you are certain it exists. Otherwise give the title and section of the
   source without a URL.
10. **Images.** Use images only if the person will supply them. Paths look like
    `assets/<name>.png` (or `.jpg`, `.webp`), lowercase, without spaces. Every
    image needs `alt` text that describes what matters in the image. If there
    are no images, do not reference any.
11. **No personal data.** Never include learner notes, scores, or progress.
12. **Languages.** Set the collection `language` to the main language. Give any
    prompt, card side, hint, explanation, or choice in a different language its
    own `language` tag, such as `language: es`.
13. **Tags.** Lowercase words joined by hyphens (`record-types`), at most 32 per
    item.

## Quality rules

- **Accuracy first.** Write only what you are confident is correct and current.
  If a fact depends on a version or date, such as a product limit or a law,
  say so in the explanation, or leave the question out.
- **One clear correct answer**, or one clear correct set. Distractors are
  plausible but definitely wrong. Avoid "All of the above" and "None of the
  above". If you must use them, set `shuffle_choices: false`.
- **Explain.** Give every question an `explanation` of why the answer is right.
  Add per-choice explanations for distractors that reflect common
  misconceptions.
- **Hints help without revealing.**
- **Original content only.** Do not reproduce questions from real exams, exam
  dumps, or copyrighted question banks. Certification exam content is
  typically covered by a nondisclosure agreement. Write new questions that test
  the same knowledge.
- **Cite sources** in `references` when an item depends on specific material.
- **Vary the position of the correct answer** in the list.

## Answer variants (only when asked)

If the person asks for answer variants, that is, several wordings of each
choice so that learners cannot memorize how an answer looks, use format
draft 0.2: write `format_version: "0.2"` and give choices a `variants` list.
The app shows every choice once, in one of its wordings, picked at random each
time.

```yaml
choices:
  - id: toward-more-solute
    text: Toward the side with more dissolved solute
    variants:
      - text: From the dilute side to the concentrated side
      - text: Toward the more concentrated solution
  - id: toward-less-solute
    text: Toward the side with less dissolved solute
    variants:
      - text: From the concentrated side to the dilute side
```

- **Same claim.** Every variant says exactly what its choice says, in other
  words. Never add a qualifier, change the scope, or make it more or less
  precise. A correct choice stays correct in every wording, and an incorrect
  one stays incorrect.
- **Vary the wrong choices too,** so the correct answer is not the only choice
  that changes.
- **Same form and length.** The app picks each choice's wording separately, so
  any wording can appear beside any other. Keep every wording of every choice
  in the same grammatical form and of similar length.
- **Limits.** At most 8 variants per choice. A variant has `text`, and may have
  an `image` or `language`; it never has its own `id` or `explanation`.
- Without variants, keep `format_version: "0.1"`.

## Self-check before you answer

Go through the output once and confirm:

- [ ] The header has all five required fields, and `format_version` is quoted.
- [ ] Every ID matches the pattern and is unique where required.
- [ ] Every ID in `correct_answers` exists among that question's choices.
- [ ] `selection_count`, where present, equals the number of correct answers.
- [ ] No HTML, no anchors or aliases, no null values, no invented URLs.
- [ ] Every code sample or payload is inside backticks or a code block.
- [ ] Ambiguous scalars are quoted.
- [ ] If any choice has `variants`, `format_version` is `"0.2"`, and every
      variant makes the same claim as its choice.

## After you answer

Remind the person to:

1. Run the file through an OpenWaymark validator and fix anything it reports.
2. Have a knowledgeable person review every answer. A validator checks
   structure, never correctness.
3. Add a `license` that states how others may use the content.
