# Learn by doing

These tutorials assume **no programming experience**. Each one has you type
real commands and change real files, and explains what happened and why. By
the end you will have made a study bundle, checked it, read a validator's
code, and made your first change to it, with tests that prove it works.

| #   | Tutorial                                                 | You will                                                                    | Time              |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------- |
| 1   | [Set up your computer](01-set-up-your-computer.md)       | Install the tools developers use, download this project, and run its checks | 30–45 min         |
| 2   | [Make your first bundle](02-your-first-bundle.md)        | Write a study bundle in YAML, check it, break it on purpose, and fix it     | 30 min            |
| 3   | [How the validator works](03-how-the-validator-works.md) | Follow one bundle through the engine, file by file                          | 30 min of reading |
| 4   | [Your first code change](04-your-first-code-change.md)   | Add a new lint check: write a test, see it fail, make it pass               | 45 min            |
| —   | [Glossary](glossary.md)                                  | Look up any term you meet along the way                                     | —                 |

You can stop after tutorial 2 if you only want to _write_ bundles. Tutorials
3 and 4 are for anyone curious about how software like this is built.

**Stuck?** Every error message from the validator names a rule, such as
`OWM-PATH-001`. Search for it in the [specification](../../spec/openwaymark.md)
to read the rule and the reasoning behind it.
