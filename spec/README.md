# OpenWaymark specification

This directory will hold the normative OpenWaymark format specification. The
first draft, 0.1, is milestone M1.

Its contents and the related directories are planned as follows. None of them
exists yet.

| Path                      | Contents                                                                                                                                                                       | Milestone |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `spec/openwaymark.md`     | The specification: conformance classes, package profile, YAML and Markdown profiles, data model, grading, identity and versioning, limits, security and privacy considerations | M1        |
| `spec/authoring-guide.md` | How to write bundles by hand, with a field reference                                                                                                                           | M1        |
| `spec/ai-authoring.md`    | Standalone instructions for AI-assisted authoring                                                                                                                              | M1        |
| `schema/`                 | JSON Schema (2020-12) for the manifest                                                                                                                                         | M1        |
| `examples/`               | Valid example bundles: high-school, IT, image-heavy                                                                                                                            | M1        |
| `fixtures/`               | Conformance fixtures, each with an `expect.json`                                                                                                                               | M2        |

The specification must be implementable without Waymark Study, a Waymark
service, or any account. The reference engine in `packages/engine` implements
it, but the specification never depends on the engine.
