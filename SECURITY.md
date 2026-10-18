# Security policy

OpenWaymark's validator exists to keep untrusted files from harming the
programs that open them, so security reports are especially welcome.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately instead, through GitHub:
[**Report a vulnerability**](https://github.com/AutomateTheCloud/openwaymark/security/advisories/new),
on the Security tab of this repository.

Helpful details:

- what you found, and why it matters;
- a bundle or steps that reproduce it. A small file is ideal; please avoid
  real malware;
- which part is affected: the specification, the engine, the CLI, or the
  browser validator.

We will acknowledge the report, keep you informed, and credit you when the fix
is published, unless you would rather stay anonymous.

## What counts

Examples of what we want to hear about:

- a bundle that a conforming reader should reject, but the engine accepts;
- a bundle that makes the engine crash, hang, or use unbounded memory or time;
- any way for bundle content to run code, load remote content, or escape the
  bundle, for instance by writing files elsewhere;
- a gap in the specification that would let two correct implementations
  disagree about what a bundle contains.

## What validation does not promise

A conforming bundle follows the format. That does not prove it is harmless,
and a malware scan reports only threats its signatures know. See the
"What validation does not promise" sections of the
[CLI README](packages/cli/README.md) and the
[specification](spec/openwaymark.md) (section 13).
