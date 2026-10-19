<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/brand/waymark-mark-reverse.svg">
    <img src=".github/brand/waymark-mark-color.svg" alt="Waymark ribbon mark" width="112">
  </picture>
</p>

<h1 align="center">OpenWaymark</h1>

<p align="center">
  <strong>An open format for portable study bundles.</strong><br>
  Practice questions and flashcards written in plain YAML, with local images,<br>
  packed into an ordinary ZIP file that any app can read.
</p>

<p align="center">
  <a href="https://github.com/AutomateTheCloud/openwaymark/actions/workflows/check.yml"><img src="https://github.com/AutomateTheCloud/openwaymark/actions/workflows/check.yml/badge.svg" alt="Check status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-146B63" alt="License: Apache 2.0"></a>
  <img src="https://img.shields.io/badge/format-draft%200.1-163D3A" alt="Format status: draft 0.1">
  <a href="https://www.npmjs.com/package/@automatethecloud/openwaymark"><img src="https://img.shields.io/npm/v/@automatethecloud/openwaymark?label=npm&color=146B63" alt="npm version"></a>
</p>

---

Your study material should belong to you. An OpenWaymark bundle is a set of
practice questions and flashcards you can read, write, and keep without any
particular app, account, or service. The format is documented openly, so anyone
can build software that reads it.

- **Human-authorable.** One `study.yaml` file, plus images in `assets/`.
- **Safe by design.** Restricted Markdown, local images only, and nothing in a
  bundle can run as code.
- **Stable identity.** Questions and cards keep their IDs across revisions, so
  notes and progress survive updates.
- **Independent.** Implementing the format requires nothing from Waymark,
  including any service or account.

## Install the tools

You do not need to clone this repository to check or pack bundles. The
command-line tool and the engine are published on npm, and need
[Node.js](https://nodejs.org/) 24 or later.

**The command-line tool**,
[`@automatethecloud/openwaymark`](https://www.npmjs.com/package/@automatethecloud/openwaymark):

```bash
npm install --global @automatethecloud/openwaymark
openwaymark validate my-bundle/       # Does it follow the format?
openwaymark pack my-bundle/           # Make my-bundle.waymark
```

Or try it once without installing anything:

```bash
npx @automatethecloud/openwaymark validate my-bundle/
```

The [CLI guide](packages/cli/README.md) covers every command, the exit
statuses, and malware scanning.

**The engine**, for your own programs,
[`@automatethecloud/openwaymark-engine`](https://www.npmjs.com/package/@automatethecloud/openwaymark-engine):

```bash
npm install @automatethecloud/openwaymark-engine
```

It runs in Node and in browsers. The [engine guide](packages/engine/README.md)
shows how to validate a bundle in a few lines.

**Check where a release came from.** Every release is built and published by
this repository's GitHub Actions workflow, and npm records a signed
[provenance statement](https://docs.npmjs.com/generating-provenance-statements)
that links it to the exact commit. `npm audit signatures`, run in a project that
installs the packages, verifies them.

The engine and the CLI share one version number. The format is a working
draft, so expect breaking changes in 0.x releases. If your project only
installs packages after they have been public for some days (pnpm's
`minimumReleaseAge`, for example), a new release becomes available to it once
that time has passed.

Want to change the code, or run the tests? Clone the repository and see
[Development](#development).

## Learn by doing

New to all of this? [`docs/learn/`](docs/learn/) starts from zero: set up your
computer, make a bundle, see how the validator works, and make your first code
change, with tests. Not a developer yet? These tutorials are written for you.

Every attack the validator stops is explained in
[`fixtures/README.md`](fixtures/README.md), as a short lesson in how files
attack the programs that open them.

## A bundle at a glance

```yaml
format_version: "0.1"
id: 6d5a39e7-9461-4c21-a736-f7b014b05783
title: Networking Fundamentals
version: 1.0.0
language: en

questions:
  - id: dns-record-001
    type: multiple_choice
    selection: single
    prompt:
      text: Which DNS record maps a hostname to an IPv4 address?
    choices:
      - id: record-a
        text: A
      - id: record-aaaa
        text: AAAA
      - id: record-cname
        text: CNAME
    correct_answers: [record-a]
    explanation:
      text: An **A** record holds an IPv4 address; **AAAA** holds IPv6.

flashcards:
  - id: dns-card-001
    front:
      text: What does an AAAA record contain?
    back:
      text: An IPv6 address for a hostname.
```

_The format is a working draft. Field names may change until version 1.0._

## What's here

| Path                                 | Contents                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [`spec/`](spec/)                     | The OpenWaymark specification, authoring guide, and change log                                 |
| [`schema/`](schema/)                 | JSON Schema for the manifest, draft 0.1                                                        |
| [`examples/`](examples/)             | Valid example bundles, as folders: IT, high-school, rendering, and language learning           |
| [`fixtures/`](fixtures/)             | Conformance fixtures for implementers, each a lesson in one attack or mistake                  |
| [`packages/engine`](packages/engine) | Reference engine: validation, linting, and package inspection. It runs in Node and in browsers |
| [`packages/cli`](packages/cli)       | `openwaymark` command-line tool: `validate`, `lint`, `inspect`, `scan`, `pack`                 |

The engine and the CLI are on npm; see [Install the tools](#install-the-tools).

The [browser validator](packages/web-validator) checks and packs bundles on your
own device, without installing anything and without uploading your files.

Waymark Study, an offline study app by Automate the Cloud, is the first
application that reads OpenWaymark bundles. It is in development and not yet
public.

## Development

To work on the code itself, clone the repository. Requires Node 24 and pnpm
(the version is pinned in `package.json`).

```bash
pnpm install
pnpm check      # typecheck, lint, format, tests, spelling, license headers
```

| Script          | What it does                                               |
| --------------- | ---------------------------------------------------------- |
| `pnpm build`    | Compile every package (`tsc --build`)                      |
| `pnpm test`     | Build, then run the Vitest suites                          |
| `pnpm lint`     | ESLint with type-aware rules                               |
| `pnpm format`   | Format with Prettier                                       |
| `pnpm spelling` | Fail on British spellings in text files                    |
| `pnpm headers`  | Fail on source files without the copyright and SPDX header |

Dependencies are installed only after they have been public for 7 days
(`minimumReleaseAge` in `pnpm-workspace.yaml`). Dependency install scripts do
not run unless they are allowlisted there.

## License

The specification, schema, fixtures, examples, engine, CLI, and browser
validator are licensed under the [Apache License 2.0](LICENSE). Copyright 2026
Automate the Cloud Inc.; see [NOTICE](NOTICE).

**Not licensed:** the Waymark and Waymark Study names, and the logo files in
[`.github/brand/`](.github/brand/), are property of Automate the Cloud Inc. The
Apache License grants no trademark rights (§6), and those files are excluded
from it.

Study bundles are licensed by their authors and are not covered by this
repository's license. A bundle states its own terms in its `license` field.
