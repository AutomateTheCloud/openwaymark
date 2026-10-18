# openwaymark (command-line tool)

Checks, describes, and packs [OpenWaymark](../../README.md) study bundles from
a terminal. Everything runs on your own computer. Nothing is uploaded.

> **New to the command line?** [`docs/learn/`](../../docs/learn/) walks you
> through installing the tools and running your first check, step by step.

## Commands

```bash
openwaymark validate my-bundle.waymark   # Does it follow the format?
openwaymark lint my-bundle.waymark       # ...and does anything look like a mistake?
openwaymark inspect my-bundle.waymark    # What is inside it?
openwaymark scan my-bundle.waymark       # Validate, and scan with ClamAV
openwaymark pack my-bundle/              # Make my-bundle.waymark from a folder
```

Add `--json` to any command for a machine-readable report: the engine's
diagnostics, each with a rule identifier such as `OWM-PATH-001` that you can
look up in the [specification](../../spec/openwaymark.md).

| Option                  | Command | Effect                                                               |
| ----------------------- | ------- | -------------------------------------------------------------------- |
| `--json`                | all     | Print a JSON report instead of text                                  |
| `--warnings-as-errors`  | `lint`  | Exit with status 1 if there are any warnings                         |
| `-o`, `--output <file>` | `pack`  | Where to write the bundle (default: the folder name plus `.waymark`) |
| `--no-integrity`        | `pack`  | Leave out `integrity.json`                                           |
| `--max-diagnostics <n>` | all     | List at most `n` problems (default 500)                              |

## Exit status

Scripts and CI pipelines can rely on these numbers:

| Status | Meaning                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| 0      | Success: the bundle conforms, and the command found nothing else wrong                    |
| 1      | The bundle does not conform (with `--warnings-as-errors`, it also has warnings)           |
| 2      | The command line could not be understood                                                  |
| 3      | A file could not be read or written                                                       |
| 4      | No errors, but a required check could not run, such as image decoding or a requested scan |
| 5      | The malware scanner detected a threat                                                     |

## What a passing result means, and what it does not

A conforming bundle **follows the format**. Its archive is well formed, its
images decode, its text contains nothing that could run, and so on. That does
**not** mean:

- **that its answers are right.** Only a person who knows the subject can
  check that.
- **that it is safe.** No check can prove a file harmless. `scan` reports what
  ClamAV's signatures recognize, which is only known threats.

That is why the tool says "passed the configured checks", never "safe" or
"malware-free".

## Malware scanning

`scan` uses [ClamAV](https://www.clamav.net/), a free, open-source antivirus
engine, if it is installed. It runs `clamscan` on your computer, and no file
leaves it.

- **Debian or Ubuntu:** `sudo apt install clamav`, then `sudo freshclam` to
  download the latest signatures.
- **macOS with Homebrew:** `brew install clamav`, then follow its instructions
  to set up `freshclam`.
- **Windows:** use the installer from clamav.net.

If ClamAV is not installed, `scan` still validates the bundle. It then reports
the scan as not performed and exits with status 4, never with a clean result.

## Building from source

From the repository root:

```bash
pnpm install
pnpm build
node packages/cli/dist/main.js --help
```
