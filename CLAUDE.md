# OpenWaymark — working rules

Rules for anyone changing this repository, people and AI coding assistants
alike. This repo holds the OpenWaymark format specification, its schema,
examples, and conformance fixtures, plus the reference engine, the CLI, and the
browser validator. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose a
change.

## Independence

- The specification must be implementable without Waymark Study, any Waymark
  service, an account, or this repo's code. Waymark's UX and storage choices
  are never normative spec text.
- The format's name is its only link to Waymark Study. The one exception is
  the README logo: the Waymark ribbon mark in `.github/brand/`. Those
  files are unlicensed, unmodified copies from the brand kit. No other Waymark
  branding, and no app code, belongs here. Never use brand assets in the spec,
  schema, examples, or fixtures.
- Nothing in `spec/`, `schema/`, `examples/`, or `fixtures/` may depend on
  `packages/`. The engine implements the spec, never the reverse.
- Never write hosting-specific URLs (GitHub or GitLab) into normative text or
  schema `$id`s. Repo hosting can change; the spec must not.

## Specification discipline

- Normative statements use RFC 2119/8174 keywords and carry an `OWM-` rule ID.
- Every format change gets an entry in `spec/CHANGELOG.md`.
- New assumptions are labeled where they appear. Questions the draft leaves
  open are listed in Appendix C of the specification.
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

- American English in this project's own code, spec, and docs (`pnpm spelling`).
  Never in bundle content: `study.yaml` files are skipped, and the validator
  has no spelling rule.
- TypeScript strict mode, ESM, Node 24, pnpm.
- New dependencies must be maintained and justified. Installs honor a 7-day
  release age (`pnpm-workspace.yaml`). Never allowlist an install script
  without saying why.
- Report honestly: what ran, what passed, what was skipped.

## Licensing

- **This whole repo is Apache 2.0:** spec text, schema, fixtures, examples, and
  code.
- Every `.ts`, `.js`, and `.mjs` file starts with the two-line copyright and
  SPDX header, after any shebang. `pnpm headers` checks it. Keep each file's
  existing year.
- **Example bundles become Apache 2.0 permanently.** Keep them small and
  illustrative, and use only images made for them.
- The Waymark name and the logo files in `.github/brand/` are not licensed, as
  the README states.
- Write the legal entity as "Automate the Cloud Inc." and the brand as
  "Automate the Cloud".
- Maintainers at Automate the Cloud follow the organization's licensing
  playbook before any licensing change.
