# 2. Make your first bundle

You will write a small study bundle, check it with the validator, break it on
purpose to see how errors are reported, and then make a bundle with an image.

You need the project set up from [tutorial 1](01-set-up-your-computer.md), and
a plain-text editor. [Visual Studio Code](https://code.visualstudio.com/) is
free and works on every system. TextEdit or Notepad also work. Word processors
such as Word or Pages do not: they add hidden formatting.

## Step 1: make a folder

Every bundle starts as a folder. Make a folder called `my-first-bundle`
**next to** the `openwaymark` folder, not inside it, to hold your work, and a
folder inside it for your first bundle. From the terminal, inside
`openwaymark`:

```bash
mkdir -p ../my-first-bundle/capitals
```

`..` means "the folder above this one", so this creates the new folders beside
`openwaymark`. `-p` makes both at once. On Windows PowerShell, `mkdir` makes
the parent folders by itself, so leave out `-p`.

## Step 2: get an identifier for your collection

Every collection has a unique ID, a **UUID**: a random 128-bit number written
in a standard form. Ask Node.js for one:

```bash
node -e "console.log(crypto.randomUUID())"
```

You will see something like `43b27c0d-ade0-40f2-9c59-f8fbb9484e8d`. Copy it.
It is yours now: keep using it for every version of this collection.

## Step 3: write the bundle

In your editor, create `my-first-bundle/capitals/study.yaml` with this text.
The file is always called `study.yaml`: it is the bundle's **manifest**, the
file that describes everything in it. Use your own UUID in place of the example
`id`.

```yaml
format_version: "0.1"
id: 0b4c7a8e-2f61-4d0a-9c3e-5a7b1d2e4f60
title: European Capitals
version: 1.0.0
language: en

flashcards:
  - id: capital-france
    front:
      text: What is the capital of France?
    back:
      text: Paris

  - id: capital-spain
    front:
      text: What is the capital of Spain?
    back:
      text: Madrid

questions:
  - id: capital-italy
    type: multiple_choice
    selection: single
    prompt:
      text: What is the capital of Italy?
    choices:
      - id: rome
        text: Rome
      - id: milan
        text: Milan
      - id: naples
        text: Naples
    correct_answers: [rome]
```

**Reading it:** this is YAML, a way of writing structured data as plain
text.

- `key: value` sets a value.
- Indentation shows what belongs inside what. Use spaces, never tabs.
- A line starting with `- ` is one item in a list.
- `[rome]` is a list written on one line.

The top five lines are required in every bundle. `format_version` is in quotes
because, without them, YAML would read `0.1` as a number.

## Step 4: check it

From the `openwaymark` folder:

```bash
pnpm openwaymark validate ../my-first-bundle/capitals
```

You give the validator the folder. It packs the folder in memory, the same way
step 8 packs one into a file, and checks the result. pnpm first prints the
command it runs, on a line starting with `$`. Then:

```text
../my-first-bundle/capitals: passed the configured checks for OpenWaymark 0.1 (0 errors, 0 warnings).
  This means the bundle is well-formed. It does not mean it is safe, or that its answers are right.
```

Give it the `study.yaml` file on its own instead, and it refuses: a manifest by
itself is not a bundle (rule `OWM-PKG-001`). A bundle is always the packed
folder, so that its images can never be left behind.

Notice the second line of the output above. The validator checks **structure**: that the file
follows the rules. It cannot know whether Rome is really the capital of Italy.
Checking facts is the author's job.

## Step 5: break it on purpose

Errors are how a validator teaches. Make one on purpose.

**Mistake 1.** Remove the quotes from the first line, so it says
`format_version: 0.1`, save, and validate again:

```text
../my-first-bundle/capitals: not a conforming OpenWaymark bundle (1 error, 0 warnings).
  4 later checks were skipped because of the errors below.
  error   OWM-YAML-009  Floating-point numbers such as 0.1 are not permitted. Quote it if it is text. (study.yaml, line 1, column 17, /format_version)
```

Then pnpm adds `ELIFECYCLE Command failed with exit code 1`. That is pnpm
reporting that the validator said "no", which is expected here.

Read the error from left to right:

| Part                            | Meaning                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `error`                         | A real problem. A `warning` would only be advice                                                                 |
| `OWM-YAML-009`                  | The rule broken. Search for it in the [specification](../../spec/openwaymark.md) to read the rule and its reason |
| The message                     | What is wrong, and how to fix it                                                                                 |
| `study.yaml, line 1, column 17` | Which file, and where in it                                                                                      |
| `/format_version`               | Where it is in the data, as a path through the structure (a **JSON Pointer**)                                    |

Put the quotes back.

**Mistake 2.** Change `correct_answers` to `correct_answer`, and validate:

```text
  error   OWM-VER-004  Unknown member "correct_answer" in question "capital-italy". Did you mean "correct_answers"? (study.yaml, line 33, column 5, /questions/0/correct_answer)
  error   OWM-Q-004  Question "capital-italy" is missing the required member "correct_answers". (study.yaml, line 21, column 5, /questions/0)
```

One typo, two errors: an unknown field, and a missing one. The validator also
suggests what you probably meant. `/questions/0` means "the first question":
counting starts at zero. Fix the spelling.

## Step 6: get advice with lint

`validate` answers "does it follow the rules?". `lint` also asks "does anything
look like a mistake?":

```bash
pnpm openwaymark lint ../my-first-bundle/capitals
```

```text
  warning OWM-LINT-001  Question "capital-italy" has no explanation. (study.yaml, line 21, column 5, /questions/0)
  warning OWM-LINT-010  The bundle has no license, so nobody may assume they can share it. (study.yaml, line 1, column 1)
```

Act on both. Add an explanation to the question, indented to line up with
`correct_answers`:

```yaml
explanation:
  text: Rome has been Italy's capital since 1871.
```

Then add a license after the `language` line. If you want others to share
your bundle freely, with credit, Creative Commons Attribution is a common
choice:

```yaml
license:
  spdx: CC-BY-4.0
```

Run `lint` again: no warnings.

## Step 7: add an image

Images go in an `assets` folder next to `study.yaml`. Make a second bundle with
this structure inside `my-first-bundle`:

```text
my-first-bundle/
└── heart/
    ├── study.yaml
    └── assets/
        └── heart-chambers.png
```

To follow along exactly, copy the example diagram from this project. From the
`openwaymark` folder:

```bash
mkdir -p ../my-first-bundle/heart/assets
cp examples/anatomy-basics/assets/heart-chambers.png ../my-first-bundle/heart/assets/
```

On Windows PowerShell, leave out `-p` again, and use `copy` if `cp` is not
available.

Then write `heart/study.yaml`, with a new UUID from step 2:

```yaml
format_version: "0.1"
id: 9d1f6c2a-4b8e-4f0d-a3c5-7e2b9a6d1c48
title: The Heart
version: 1.0.0
language: en
license:
  spdx: Apache-2.0
  statement: The diagram comes from the OpenWaymark examples.

flashcards:
  - id: heart-chamber-1
    front:
      text: Name chamber 1.
      image:
        src: assets/heart-chambers.png
        alt: >-
          Front view of the heart as four numbered chambers: 1 upper left,
          2 upper right, 3 lower left, 4 lower right.
    back:
      text: The right atrium.
```

**Why `Apache-2.0` here?** The diagram belongs to the OpenWaymark examples,
which are licensed under the Apache License 2.0. You can only give others the
rights you were given. With your own images, you choose the license.

**About `alt`:** it is the text a screen reader speaks for people who cannot
see the image. Describe what matters for learning, not just "a diagram". `>-`
lets one long line of text wrap onto several lines in the file.

## Step 8: pack it

```bash
pnpm openwaymark pack ../my-first-bundle/heart
```

```text
Wrote ../my-first-bundle/heart.waymark (14515 bytes, with integrity.json).
heart.waymark: passed the configured checks for OpenWaymark 0.1 (0 errors, 0 warnings).
```

`pack` zipped the folder's **contents**, so that `study.yaml` sits at the top
of the archive. It also added `integrity.json`, a list of fingerprints (SHA-256
digests) of every file, and then validated the result. If the bundle had not
passed, it would have written nothing.

Now look inside:

```bash
pnpm openwaymark inspect ../my-first-bundle/heart.waymark
```

```text
  title:          The Heart
  ...
  flashcards:     1
  images:         1
  integrity.json: present, every file matches
  fingerprint:    925d54d036d02e88000eeb85771f5cd2275ca9cf0f9f657ad0b5a41569b0b282
    assets/heart-chambers.png  PNG 800 × 860, 15953 bytes
```

The **fingerprint** is a digest of the bundle's content. Yours will differ
from the one above, because your bundle has its own `id`. Repack the same
content with any ZIP tool, and it stays the same. Change one character, and it
changes completely.

## What you learned

- A bundle is a folder of plain text (YAML) and images, packed into one ZIP
  file to share.
- Validators check structure. People check facts.
- Every error names a rule, a line, and a fix.
- Licenses travel with content: you can pass on only the rights you have.

**Next:** see [how the validator works](03-how-the-validator-works.md), or read
the full [authoring guide](../../spec/authoring-guide.md) to write real study
material.
