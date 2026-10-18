# 4. Your first code change

You will add a new lint check to the validator. It warns when a flashcard's
front and back say the same thing, which is almost always a copy-and-paste
mistake. Along the way you will use the habit professional developers rely
on: **write the test first, watch it fail, then make it pass.**

You need the setup from [tutorial 1](01-set-up-your-computer.md), and it helps
to have read [tutorial 3](03-how-the-validator-works.md).

## Step 1: make a branch

A **branch** is a separate line of work in Git. Your changes stay apart from
the main code until you decide to combine them:

```bash
git switch -c lint-same-front-back
```

## Step 2: write the rule down first

In this project, the specification comes first: code implements what it says.
Lint checks are listed in Appendix A of `spec/openwaymark.md`. Find the row for
`OWM-LINT-019`, and add a new row after it:

```markdown
| OWM-LINT-020 | A flashcard's front and back have the same text |
```

Run the specification check:

```bash
pnpm spec
```

It should pass and count one more identifier.

## Step 3: write a test that fails

Create `packages/engine/test/lint-front-back.test.ts`:

```ts
// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { bytesSource, validateBundle } from "../src/index.js";

function card(front: string, back: string): string {
  return `format_version: "0.1"
id: 4c5e2a10-8b7d-4f3e-9a21-6d0c3b5e7f81
title: Lint practice
version: 1.0.0
language: en
license:
  spdx: Apache-2.0
flashcards:
  - id: c-1
    front:
      text: ${front}
    back:
      text: ${back}
`;
}

async function lintRules(manifest: string): Promise<string[]> {
  const bytes = new TextEncoder().encode(manifest);
  const { report } = await validateBundle(bytesSource(bytes), { lint: true });
  return report.diagnostics.map((diagnostic) => diagnostic.rule);
}

describe("OWM-LINT-020", () => {
  it("warns when a flashcard's front and back match", async () => {
    expect(await lintRules(card("Osmosis", "osmosis"))).toContain("OWM-LINT-020");
  });

  it("stays quiet when they differ", async () => {
    expect(await lintRules(card("Osmosis", "The movement of water"))).not.toContain("OWM-LINT-020");
  });
});
```

What this does:

- `card(...)` builds a tiny bundle as text. The `${front}` parts are filled in
  with whatever you pass.
- `lintRules(...)` runs the validator with lint turned on, and returns the
  rule identifiers it reported.
- Each `it(...)` is one test. `expect(...).toContain(...)` says what must be
  true.

The first two lines are the copyright and license header every source file in
this project carries. `pnpm check` insists on it.

Run the tests:

```bash
pnpm test
```

The first test **fails**. Look for a line like:

```text
 FAIL  packages/engine/test/lint-front-back.test.ts > OWM-LINT-020 > warns when a flashcard's front and back match
```

That is good news. It proves the test can detect the problem, and that the
check does not exist yet. A test that has never failed might be testing
nothing.

## Step 4: make it pass

Open `packages/engine/src/lint.ts`. Near the top, after the line that starts
`const idOf`, add a small helper that gets the text from a content object:

```ts
const textOf = (value: Value | undefined): string | undefined =>
  typeof value === "object" && !Array.isArray(value) && typeof value.text === "string"
    ? value.text
    : undefined;
```

Then find the line `for (const image of input.images) {` inside `lintBundle`,
and add this just **before** it:

```ts
list(root.flashcards).forEach((card, index) => {
  const front = textOf(card.front)?.trim().toLowerCase();
  const back = textOf(card.back)?.trim().toLowerCase();
  if (front !== undefined && front === back) {
    warn(
      "OWM-LINT-020",
      pointerJoin("/flashcards", index),
      `The front and back of flashcard "${idOf(card)}" have the same text.`,
    );
  }
});
```

Reading it:

- `list(root.flashcards)` gives the flashcards, or an empty list if there are
  none.
- `?.` means "only if the value exists". A card side with only an image has no
  text, so `front` becomes `undefined` and the check is skipped.
- `.trim().toLowerCase()` ignores surrounding spaces and capital letters, so
  `Osmosis` and `osmosis` count as the same.
- `warn(...)` adds a warning to the report, with a pointer to the card.

Run the tests again:

```bash
pnpm test
```

Both new tests pass, along with every test that passed before.

## Step 5: run every check

```bash
pnpm format
pnpm check
```

`pnpm format` lays out your code the way the project expects. `pnpm check` then
runs everything from tutorial 1: types, lint, formatting, tests, spelling,
license headers, and the specification's rule numbers. Fix anything it
reports, and run it again until it passes.

## Step 6: save your work

```bash
git add spec/openwaymark.md packages/engine/src/lint.ts packages/engine/test/lint-front-back.test.ts
git commit -m "Add OWM-LINT-020: flashcard front and back are identical"
```

`git add` chooses which changes go into the next snapshot. `git commit` saves
that snapshot, with a message saying what it does and why.

To share it, you would push the branch and open a **pull request**, which asks
the maintainers to review your change and merge it. To go back to the main
code instead:

```bash
git switch master
```

## What you learned

- **Specification first.** The rule was written down before the code.
- **Test first.** You saw the test fail before you wrote the code that makes it
  pass.
- **Small, checked steps.** `pnpm check` runs every kind of check, so you know
  the change is complete.

That is the whole cycle professional developers repeat every day, for changes
of every size.
