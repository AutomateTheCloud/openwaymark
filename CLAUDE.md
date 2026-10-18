# OpenWaymark — working rules

This repo holds the OpenWaymark format specification, its schema, examples, and
conformance fixtures, plus the reference engine and the CLI. Project decisions,
the plan, requirement traceability, and open issues live in the sibling
coordination repo, `../waymark-develop/docs/`. Read the relevant entries before
changing the format.

## Independence

- The specification must be implementable without Waymark Study, any Waymark
  service, an account, or this repo's code. Waymark's UX and storage choices
  are never normative spec text.
- The format's name is its only link to Waymark (D-012). The one exception is
  the README logo (D-019): the Waymark ribbon mark in `.github/brand/`. Those
  files are unlicensed, unmodified copies from the brand kit. No other Waymark
  branding, and no app code, belongs here. Never use brand assets in the spec,
  schema, examples, or fixtures.
- Nothing in `spec/`, `schema/`, `examples/`, or `fixtures/` may depend on
  `packages/`. The engine implements the spec, never the reverse.
- Never write hosting-specific URLs (GitHub or GitLab) into normative text or
  schema `$id`s. Repo hosting can change; the spec must not (D-015, OI-036).

## Specification discipline

- Normative statements use RFC 2119/8174 keywords and carry an `OWM-` rule ID.
- Every format change gets an entry in `spec/CHANGELOG.md`.
- New assumptions are labeled where they appear. Unresolved questions go to
  `../waymark-develop/docs/open-issues.md`, and decisions to `decisions.md`.
- Examples must actually validate. Each fixture's expected outcome is stated in
  its `expect.json`.
- Structural validation never claims factual correctness, and a scan never
  claims a bundle is malware-free.

## Engine and CLI

- `packages/engine` runs in Node and in browser Web Workers. It may use only
  standard ECMAScript APIs; ESLint rejects Node built-ins, and its tsconfig has
  no Node types. Platform-specific work (file access, image decoding, scanners)
  goes behind interfaces that the CLI or the app implements.
- Treat all bundle input as untrusted. Enforce limits while streaming, not
  after expanding.
- `pnpm check` must pass before a commit: typecheck, lint, format, tests, and
  spelling.

## Conventions

- American English everywhere (`pnpm spelling`).
- TypeScript strict mode, ESM, Node 24, pnpm.
- New dependencies must be maintained and justified. Installs honor a 7-day
  release age (`pnpm-workspace.yaml`). Never allowlist an install script
  without saying why.
- Report honestly: what ran, what passed, what was skipped.

## Licensing

Automate the Cloud's licensing playbook governs this project (D-017):

- **This whole repo is Apache 2.0** (owner decision D-018, an exception to
  the playbook's documentation default). That includes spec text, schema,
  fixtures, examples, and code.
- Every `.ts`, `.js`, and `.mjs` file starts with the two-line copyright and
  SPDX header, after any shebang. `pnpm headers` checks it. Keep each file's
  existing year.
- **Example bundles become Apache 2.0 permanently.** Keep them small and
  illustrative. Never seed real catalog content from them, because real
  bundles are CC BY-NC 4.0 with the internal-training permission and live
  elsewhere. Use only images we created.
- Waymark brand assets are not licensed. The logo files in `.github/brand/`
  are excluded from the Apache license, as the README states.

**Before any licensing change,** fetch a fresh copy of the playbook and read
all of it. If the fetch fails, stop and ask. Delete the clone afterward.

```bash
tmp=$(mktemp -d) \
  && GIT_SSH_COMMAND="ssh -i ~/.ssh/gitlab.david_singer.atc.key -o IdentitiesOnly=yes" \
     git clone --quiet --depth 1 --branch master \
       git@gitlab.com:automatethecloud/nonprofit/atc-brand_kit.git "$tmp" \
  && cat "$tmp/LICENSING-PLAYBOOK.md"
```

Write the legal entity as "Automate the Cloud Inc." and the brand as
"Automate the Cloud". Never call educational material "open source".
