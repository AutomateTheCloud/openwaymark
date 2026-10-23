# OpenWaymark specification

| Document                                   | Contents                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`openwaymark.md`](openwaymark.md)         | **The specification**, draft 0.2: conformance, package and YAML profiles, data model, grading, Markdown and image profiles, identity, limits, security and privacy, validators |
| [`authoring-guide.md`](authoring-guide.md) | How to write bundles by hand                                                                                                                                                   |
| [`ai-authoring.md`](ai-authoring.md)       | Standalone instructions to give an AI assistant that writes bundles                                                                                                            |
| [`CHANGELOG.md`](CHANGELOG.md)             | Every change to the format                                                                                                                                                     |

Related material elsewhere in the repository:

| Path                                                                             | Contents                                                                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`../schema/openwaymark-0.2.schema.json`](../schema/openwaymark-0.2.schema.json) | JSON Schema (2020-12) for the manifest, draft 0.2. It checks structure only; the specification lists the rules a schema cannot express |
| [`../schema/openwaymark-0.1.schema.json`](../schema/openwaymark-0.1.schema.json) | The same, for draft 0.1                                                                                                                |
| [`../examples/`](../examples/)                                                   | Valid example bundles                                                                                                                  |
| `../fixtures/`                                                                   | Conformance fixtures, with expected outcomes _(milestone M2)_                                                                          |

Every normative statement in the specification carries an `OWM-` rule
identifier. `pnpm spec` checks the following:

- every sentence using BCP 14 keywords (MUST, SHOULD, MAY, and the rest) is
  inside a numbered rule;
- no identifier is defined twice;
- every identifier mentioned is defined.

The specification must be implementable without Waymark Study, any service, or
this repository's code. The reference engine in `packages/engine` implements
it, and the specification never depends on the engine.
