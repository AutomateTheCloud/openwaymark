# Glossary

Plain-language definitions of the terms used in this project.

| Term                              | Meaning                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allowlist**                     | A list of what is permitted; everything else is refused. Safer than a blocklist, which tries to list everything forbidden and always misses something |
| **Archive**                       | One file that contains other files. A `.waymark` bundle is a ZIP archive                                                                              |
| **Asset**                         | A file in a bundle other than the manifest. In OpenWaymark, always an image under `assets/`                                                           |
| **BCP 47**                        | The standard for language tags: `en`, `es-MX`, `pt-BR`                                                                                                |
| **Branch**                        | In Git, a separate line of work that does not affect the main code until it is merged                                                                 |
| **Bundle**                        | One OpenWaymark collection of questions and flashcards, packed as a `.waymark` archive                                                                |
| **CI (continuous integration)**   | A service that runs a project's checks automatically on every change. This project uses GitHub Actions                                                |
| **Commit**                        | A saved snapshot of changes in Git, with a message describing them                                                                                    |
| **Conforming**                    | Following every rule of the specification                                                                                                             |
| **CRC-32**                        | A short checksum that ZIP stores for each file, to catch accidental damage. It is easy to forge, so it is not a security check                        |
| **CSP (Content Security Policy)** | Instructions a web page gives the browser about what the page may load or contact. The browser validator uses one to forbid all network requests      |
| **Decompression bomb**            | A small compressed file that expands to an enormous size, to exhaust memory or disk                                                                   |
| **Dependency**                    | A library a project uses, downloaded by pnpm                                                                                                          |
| **Diagnostic**                    | One finding in a validation report: a rule, a severity, a message, and a location                                                                     |
| **Digest, hash**                  | A fixed-length fingerprint computed from data. Change one byte, and the digest changes completely. SHA-256 is one algorithm for computing it          |
| **EICAR**                         | A harmless test string that every antivirus scanner detects on purpose, so scanners can be tested without real malware                                |
| **Fingerprint**                   | Here, the content fingerprint: a SHA-256 digest of a bundle's content that survives repacking                                                         |
| **Fixture**                       | A prepared input with a known correct result, used in tests                                                                                           |
| **Integrity file**                | `integrity.json`: a list of digests of every file in a bundle, to detect changes after packing                                                        |
| **JSON**                          | A text format for structured data, which JavaScript reads natively                                                                                    |
| **JSON Pointer**                  | A path to one value in structured data, such as `/questions/0/choices/2`                                                                              |
| **JSON Schema**                   | A machine-readable description of what a JSON or YAML document may contain                                                                            |
| **Lint**                          | Checks for things that are allowed but probably mistakes                                                                                              |
| **Lockfile**                      | `pnpm-lock.yaml`: the exact version of every dependency, so every installation is identical                                                           |
| **Manifest**                      | `study.yaml`: the file that describes the collection and contains its questions and cards                                                             |
| **Markdown**                      | A light way of formatting text, such as `**bold**` and `- lists`                                                                                      |
| **Normative, informative**        | In a specification, normative text states requirements; informative text explains them                                                                |
| **Polyglot file**                 | A file that is valid as two formats at once, such as a script that is also a ZIP                                                                      |
| **Property-based test**           | A test that states something must be true for _every_ input, then tries thousands of random ones                                                      |
| **Prototype pollution**           | A JavaScript attack that uses a key such as `__proto__` to change how every object behaves                                                            |
| **Pull request**                  | A request to review a branch and merge it into the main code                                                                                          |
| **Rule identifier**               | A label such as `OWM-PATH-001` on each requirement in the specification. Diagnostics refer to it                                                      |
| **SemVer**                        | Semantic Versioning: version numbers like `1.4.2`, meaning major, minor, and patch                                                                    |
| **SPDX**                          | A standard set of short names for licenses, such as `CC-BY-4.0` and `Apache-2.0`                                                                      |
| **Terminal**                      | A window where you type commands                                                                                                                      |
| **TypeScript**                    | JavaScript with types: labels that say what kind of value each thing is, checked before the program runs                                              |
| **UTF-8**                         | The standard way of storing text as bytes, for every language                                                                                         |
| **UUID**                          | A 128-bit random identifier, written like `43b27c0d-ade0-40f2-9c59-f8fbb9484e8d`                                                                      |
| **Validator**                     | A program that checks a file against a specification and reports what is wrong                                                                        |
| **Web Worker**                    | A background thread in a web page. The browser validator runs the engine in one, so the page stays responsive                                         |
| **XSS (cross-site scripting)**    | Getting a web page to run someone else's code, often by sneaking HTML into text it displays                                                           |
| **YAML**                          | A human-friendly text format for structured data, used for `study.yaml`                                                                               |
| **Zip slip**                      | An attack that uses file names such as `../../evil` to write outside the intended folder when an archive is extracted                                 |
