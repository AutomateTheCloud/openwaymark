# Contributing to OpenWaymark

Thank you for helping. Corrections, questions, new fixtures, clearer wording,
and code are all welcome. You do not need to be an experienced developer:
[`docs/learn/`](docs/learn/) walks you through setting up and making a first
change.

## Ways to help

- **Ask a question or report a problem** by opening an issue. If something in
  the specification is unclear, that is a bug in the specification.
- **Suggest a feature** by opening an issue. To change what bundles can
  contain, use the "Format proposal" template. Larger format changes are
  designed in the issue before the specification changes.
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

## Releasing (maintainers)

The engine and the CLI are released together, with one version number, by
`.github/workflows/publish.yml`. The workflow publishes to npm through trusted
publishing: npm trusts this repository's workflow directly, so no npm token
is stored anywhere, and each release gets a signed provenance statement.

1. **Pick the version.** While the format is a draft (0.x), raise the minor
   number (0.2.0) for a breaking change and the patch number (0.1.3) for
   anything else.
2. **Bump it in four places:** `version` in `packages/engine/package.json` and
   `packages/cli/package.json`, `ENGINE_VERSION` in
   `packages/engine/src/validate.ts`, and `CLI_VERSION` in
   `packages/cli/src/version.ts`. `pnpm check` fails if any of them disagree.
3. **Open a pull request** titled "Release 0.1.3" and merge it once the checks
   pass.
4. **Tag the merged commit** on `master` and push the tag:

   ```bash
   git switch master && git pull
   git tag -a v0.1.3 -m "Release 0.1.3"
   git push origin v0.1.3
   ```

5. **Approve the deployment.** The publish run waits for a maintainer to
   approve it in the `npm` environment (Actions, then Review deployments). It
   runs `pnpm check`, confirms that the tag matches both versions, and
   publishes the engine, then the CLI.
6. **Check the result.** npm can take a few minutes to show a new version.
   `npm view @automatethecloud/openwaymark version` prints it once it is
   there.

A version number can be used only once, even if it is later unpublished. If a
release goes wrong after publishing, fix it in a new patch release. If the run
fails before publishing anything, fix the problem, move the tag to the new
commit (`git tag -d`, then `git push origin :refs/tags/v0.1.3`), and tag again.

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
