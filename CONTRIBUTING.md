# Contributing to OpenWaymark

Thank you for helping. Corrections, questions, new fixtures, clearer wording,
and code are all welcome. You do not need to be an experienced developer:
[`docs/learn/`](docs/learn/) walks you through setting up and making a first
change.

## Ways to help

- **Ask a question or report a problem** by opening an issue. If something in
  the specification is unclear, that is a bug in the specification.
- **Report a security problem privately**, as described in
  [SECURITY.md](SECURITY.md), not in a public issue.
- **Propose a change** with a pull request.

## Before you open a pull request

1. **Run the checks:** `pnpm check`. It runs types, lint, formatting, tests,
   spelling, license headers, and the specification's rule numbers. Run
   `pnpm format` first to fix layout.
2. **Specification first.** A change to what bundles may contain changes
   `spec/openwaymark.md` first, with a `spec/CHANGELOG.md` entry. Normative
   statements use MUST, SHOULD, and MAY, and carry a new `OWM-` rule number.
   Never reuse a retired number.
3. **Test what you change.** New rules get fixtures (`tools/generate-fixtures.mjs`)
   and tests. Bug fixes get a test that fails without the fix.
4. **Write for learners.** Comments explain why, not just what. Messages say
   what is wrong and how to fix it. Plain language; jargon defined on first use.
5. **American English** for this project's own code, specification, and
   documentation (`pnpm spelling`). Bundle content is never checked: a
   bundle's text belongs to its author, in any language or spelling.
6. **New source files** start with the two-line header:

   ```ts
   // Copyright 2026 Automate the Cloud Inc.
   // SPDX-License-Identifier: Apache-2.0
   ```

## How contributions are licensed

This repository is licensed under the [Apache License 2.0](LICENSE). Under
section 5 of that license, anything you intentionally submit for inclusion is
licensed under the same terms, unless you clearly say otherwise. Please submit
only work you wrote, or have the right to contribute under Apache 2.0.

The Waymark names and logos are not covered by the license (see the README).
Please do not add Waymark branding anywhere except where it already is.

## Conduct

Be kind, assume good intent, and remember that many people here are learning.
Criticize ideas, not people.
