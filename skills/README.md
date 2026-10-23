# Skills for AI assistants

Agent skills that help AI coding assistants work with OpenWaymark. A skill is
a folder with a `SKILL.md` file of instructions, plus reference documents and
scripts the assistant loads when it needs them. They follow the Agent Skills
layout used by Claude Code and other assistants.

| Skill                                                      | What it does                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`openwaymark-study-bundles/`](openwaymark-study-bundles/) | Turns a textbook chapter, PDF, or other document into a validated bundle of questions and flashcards, with a license check and a review report |

## Installing

Copy or link the skill folder into your assistant's skills folder. For Claude
Code, that is `~/.claude/skills/` for every project, or `.claude/skills/` in
one project:

```bash
ln -s "$PWD/skills/openwaymark-study-bundles" ~/.claude/skills/openwaymark-study-bundles
```

The skill needs:

- Python 3.10 or later, with PyYAML for `check_items.py`;
- Node.js 24 or later, to run the `openwaymark` CLI (installed, or through
  `npx @automatethecloud/openwaymark`);
- `pdftotext` (poppler-utils), for PDF sources.

It works only from files you provide, and fetches nothing from the network.

## What the skill produces

The bundles a skill writes are new works derived from their sources, with the
sources' licenses. They are not part of this repository and are not covered by
its Apache 2.0 license; keep them out of `examples/` and `fixtures/`.

`references/authoring-rules.md` is a copy of
[`spec/ai-authoring.md`](../spec/ai-authoring.md), so the skill works when
installed on its own. A test keeps the copy identical; change the original and
copy it.
