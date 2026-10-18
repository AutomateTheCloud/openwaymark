# OpenWaymark

**OpenWaymark** is an open format for portable study bundles: practice
questions and flashcards written in human-authorable YAML, with local images,
packed into an ordinary ZIP archive. This repository holds:

- **the specification** (`spec/`), written so that anyone can implement it
  without Waymark Study, any service, or an account;
- **the reference engine** (`packages/engine`): validation, linting, and package
  inspection. It runs in Node and in browser Web Workers;
- **the CLI** (`packages/cli`): `openwaymark validate`, `lint`, `inspect`,
  `scan`, and `pack`.

**Status:** pre-draft. The format is being specified (draft 0.1). Nothing here
is stable, and nothing is published.

[Waymark Study](https://gitlab.com/automatethecloud/waymark/waymark-study) is
the first application that reads OpenWaymark bundles. Project decisions are
recorded in
[waymark-develop](https://gitlab.com/automatethecloud/waymark/waymark-develop).

## Development

Requires Node 24 and pnpm (the version is pinned in `package.json`).

```bash
pnpm install
pnpm check      # typecheck, lint, format check, tests, American English check
```

| Script          | What it does                            |
| --------------- | --------------------------------------- |
| `pnpm build`    | Compile every package (`tsc --build`)   |
| `pnpm test`     | Build, then run the Vitest suites       |
| `pnpm lint`     | ESLint with type-aware rules            |
| `pnpm format`   | Format with Prettier                    |
| `pnpm spelling` | Fail on British spellings in text files |

Dependencies are installed only after they have been public for 7 days
(`minimumReleaseAge` in `pnpm-workspace.yaml`). Dependency install scripts do
not run unless they are allowlisted there.

## License

Not yet chosen. Until it is, this repository is private and grants no rights.
The Waymark name and logo are not covered by any future code license.
