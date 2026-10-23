---
name: openwaymark-study-bundles
description: >-
  Turns source material the person provides as files (textbook chapters as
  EPUB or PDF, saved web pages, lecture notes, manuals) into OpenWaymark study
  bundles: practice questions and
  flashcards in a validated .waymark file, written from what the source says
  matters most. Covers checking the source's license, building a source pack,
  planning coverage, writing good questions, distractors and cards, checking
  every answer against the source, validating, and packing. Use it whenever
  someone wants study material, practice questions, quizzes, flashcards, a
  question bank, or a Waymark or OpenWaymark bundle made from a document,
  book, chapter, or course material, including open textbooks, and when
  updating a bundle made this way, even if they do not
  say "OpenWaymark".
---

# Study bundles from source material

You turn a source into a bundle a learner can study from: questions that
check understanding, flashcards for the facts worth instant recall, and an
explanation and a reference for every item. The bundle is in the OpenWaymark
format, a ZIP file (`.waymark`) with a YAML manifest called `study.yaml`.

Three things matter more than volume:

- **Right answers.** A learner trusts the key. A wrong key teaches an error,
  so every item is checked against the source, and the questions are solved
  blind before the bundle is done.
- **The right things.** Items follow what the source says is important: its
  learning objectives, key terms, and summaries, not whatever sentence was
  easiest to turn into a question.
- **Permission.** A bundle written from a book is an adaptation of it. The
  source's license decides whether you may make it and what license it
  carries.

## Reference files

Read these when you reach the step that needs them:

- `references/licensing.md`: what each source license allows, and the
  attribution to write (step 1).
- `references/sources.md`: building the source pack from open textbooks, PDFs, and the person's own documents (step 2).
- `references/study-design.md`: deciding what to test, the blueprint, and how
  to write questions, distractors, and flashcards (steps 3 to 6). Read all of
  it before writing items.
- `references/authoring-rules.md`: the OpenWaymark format rules for items,
  with a skeleton of every field (step 5). Its "Output" section is written for
  chat use; here, write the YAML to `study.yaml` instead.

## Settle the request

Work out these from the request; ask only about the ones that are missing and
change the result:

- **Source and scope:** which files, and which chapter or sections of them.
  The skill works only from files the person provides.
- **Learners:** level and purpose (an introductory course, exam review, a
  certification). Default: the level the source is written for.
- **Mix and size:** questions, flashcards, or both, and roughly how many.
  Default: both, sized by the blueprint rules in the study-design reference.
- **Output folder:** where the bundle goes. Never inside a repository whose
  license would claim it (see the licensing reference). If none is given,
  propose a folder and say which one you used.

Use this layout in the output folder. `pack` zips the whole bundle folder, so
working files stay outside it:

```text
<output>/
├── <bundle-name>/study.yaml     the bundle source (and assets/, if images)
├── <bundle-name>.waymark        the packed bundle
├── <bundle-name>-review.md      the review report
└── work/                        source pack, blueprint, check outputs
```

## The workflow

### 1. Check the license

Find the source's license in the source itself, then look it up in
`references/licensing.md`. Also look for the publisher's own terms about AI
use: some publishers of openly licensed books forbid putting their text into
AI systems without permission, and the license file alone will not tell you.
`source_pack.py list` (step 2) prints the license statements and any such
terms from the front and back matter without reading the chapter text.

Stop and tell the person, before reading the source into your context, if:

- the license forbids derivatives;
- the publisher restricts AI use and the person has not said they have
  permission;
- NonCommercial terms clash with what they said they will do with the bundle.

Note the license and attribution details for step 4.

### 2. Build the source pack

The skill works from files the person provides; if they name a source
without providing it, ask for the file. Follow `references/sources.md`, which
covers EPUB, HTML, PDF, and the person's own documents:

```bash
python3 <skill>/scripts/source_pack.py list <file>
python3 <skill>/scripts/source_pack.py build <file> [--items 3-7 | --pages 12-40] -o <output>/work/source
```

Read the whole pack before planning. If the pack's license line differs from
what you expected, go back to step 1.

### 3. Write the blueprint

List every learning objective (stated, or inferred and marked as inferred),
and plan the items for each, as described in the study-design reference. Save
it to `work/blueprint.md`. Check it against the book's own review questions,
if the pack has them: every topic they test should be covered somewhere. If
the source has none (or only interactive activities the pack leaves out), say
so in the blueprint and the report.

### 4. Write the header

```yaml
format_version: "0.1"
id: <new lowercase UUID: python3 -c "import uuid; print(uuid.uuid4())">
title: <topic, not a publisher's brand, e.g. "Cell Structure and Function: Practice Set">
version: 1.0.0
language: en
description: |
  <What it covers, at what level, and how to use it. Name the source and its
  license. Say that the items were drafted with AI assistance and have not yet
  been reviewed by a subject expert, until one has.>
subject: <broad subject, e.g. Biology>
tags: [<topic-tags>]
license: <from the licensing reference; every URL in a bundle must be https>
created: "<today, YYYY-MM-DD>"
sources:
  - title: <source title>
    reference: <chapter or sections used>
    url: <only a URL you have confirmed>
```

Leave out `authors` unless the person says who should be credited for the
bundle. The source's authors are credited in `license` and `sources`, not as
authors of the questions. When a book names only an organization (a
department, a program) as its author, credit the organization.

### 5. Write the items

Write `study.yaml` following the authoring rules and the study-design
reference. Work through the blueprint section by section. For each item, have
the supporting passage in front of you, and give it a `references` entry with
the source title and the most specific location.

For a long chapter, it helps to write one section's items, then the next, and
merge, rather than holding the whole chapter at once.

The most common format slip is unquoted text containing `: `, which YAML reads
as a mapping. Use `text: |` blocks for anything longer than a phrase, and quote
short text that contains a colon.

### 6. Check, and fix until clean

Find the CLI once: `openwaymark` if it is installed; otherwise
`npx --yes @automatethecloud/openwaymark`; inside the OpenWaymark repository,
`pnpm openwaymark` from the repository root (after `pnpm build`). Below,
`openwaymark` stands for whichever works.

Run both checks, fix what they report, and run them again until both are
clean:

```bash
openwaymark lint <output>/<bundle-name>
python3 <skill>/scripts/check_items.py <output>/<bundle-name>/study.yaml
```

- `lint` validates the format and reports likely mistakes. Aim for 0 errors
  and 0 warnings.
- `check_items.py` reports item-writing problems the validator cannot see:
  answer-position bias, giveaway choice lengths, missing explanations or
  references, and duplicates. Fix its warnings; its notes are judgment calls.

Then verify the content (the last section of the study-design reference).
Prepare a blind set, which numbers the questions and letters the choices so
that no ID gives an answer away:

```bash
python3 <skill>/scripts/blind_solve.py make <output>/<bundle-name>/study.yaml -o <output>/work/blind
```

If you can start a helper agent, give it only `blind-questions.md`,
`blind-cards.md`, and the source pack. Ask it to answer each question from the
source, writing the answers as JSON (`{"Q1": ["B"]}`) and the supporting
passage for each in a notes file, and to check each flashcard's back against
its cited passage. Then score:

```bash
python3 <skill>/scripts/blind_solve.py score <output>/work/blind/blind-key.json <answers.json>
```

Without a helper, do the blind pass yourself from `blind-questions.md`,
answering each question before you look at the key. Fix or cut every item
where the answers disagree, where the solver found two defensible choices, or
where a card's back is not supported.

Check every item you change again, the same way: make a blind set of just
those items (`--only <id>,<id>` into `work/blind-2`, and so on) and give it to
a fresh helper, since one that saw the earlier wording is no longer blind.

For a bundle of flashcards only, the card check is the whole content check.
Have the helper record a verdict for each card (supported, partly supported,
unsupported, wrong reference), and put the totals in the report.

### 7. Pack

```bash
openwaymark pack <output>/<bundle-name> -o <output>/<bundle-name>.waymark
```

`pack` checks the result as it writes it.

### 8. Write the review report

Write `<bundle-name>-review.md` for the person, and keep it short:

- **Source and license:** what was used, the license found, and the bundle's
  license.
- **Coverage:** the blueprint as a table, with the actual item counts per
  objective, and anything deliberately left out.
- **Checks:** the lint result, the item-check result, and the blind-solve
  result (how many items were checked, how many disagreed, what was done).
  Say plainly which checks ran and which did not.
- **Needs a human:** items you are least sure of, places where the source
  seemed simplified or wrong, and anything the format could not express (math
  notation, diagram labeling, ordering tasks). That last list is useful to the
  format's maintainers too.

Finish by telling the person where the bundle and report are, and that a
validator checks structure only: someone who knows the subject should review
the answers before learners rely on them.

## Updating a bundle

When asked to revise or extend a bundle made this way:

- Keep the collection `id`, and keep every item and choice `id` for an item
  that still tests the same thing, even when you reword it. Learners' progress
  is attached to these IDs.
- An item that now tests something different gets a new `id`.
- If an item's correct choice now claims something different, increase the
  item's `revision` (add `revision: 2` if it had none).
- Increase `version`: patch for corrections, minor for added items, major for
  restructuring. Set `updated` to today.
- Rebuild the source pack from the same edition of the source unless the
  person wants the newer text.
