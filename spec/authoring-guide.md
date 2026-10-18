# Writing OpenWaymark bundles

This guide shows you how to write a study bundle by hand: practice questions,
flashcards, or both. You need a text editor. If your bundle has images, you also
need a way to make a ZIP file, which every computer already has.

The guide follows format **draft 0.1**. The [specification](openwaymark.md) is
the authority; this guide links to it where the details matter. Working
examples are in [`examples/`](../examples/).

## 1. The smallest bundle

A bundle without images can be a single YAML file. Save this as
`capitals.yaml`:

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
```

The five lines at the top are required in every bundle:

| Field            | What to write                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `format_version` | `"0.1"`, in quotes                                                                                                             |
| `id`             | A new UUID for your collection. Generate one once, for example with an online UUID generator or `uuidgen`, and keep it forever |
| `title`          | The name learners see                                                                                                          |
| `version`        | Your content's version, such as `1.0.0`. Increase it every time you change anything                                            |
| `language`       | The language of your content, such as `en`, `es`, or `pt-BR`                                                                   |

Then add `questions`, `flashcards`, or both.

## 2. Writing questions

Every question is multiple choice. It has a prompt, two or more choices, and
the identifiers of the correct choices.

```yaml
questions:
  - id: dns-port-001
    type: multiple_choice
    selection: single
    prompt:
      text: Which port does DNS use by default?
    choices:
      - id: port-53
        text: "53"
      - id: port-80
        text: "80"
      - id: port-443
        text: "443"
    correct_answers: [port-53]
    hint:
      text: It is the same number for UDP and TCP.
    explanation:
      text: DNS uses port 53, over both UDP and TCP.
```

- `selection: single` means exactly one choice is correct.
- `correct_answers` lists choice **identifiers**, never letters such as "A". An
  app may shuffle the choices, so letters change; identifiers do not.
- `hint` is shown only when the learner asks. `explanation` is shown after
  answering.

### More than one correct answer

```yaml
- id: dns-record-002
  type: multiple_choice
  selection: multiple
  selection_count: 2
  prompt:
    text: Which two record types map hostnames to IP addresses?
  choices:
    - id: record-a
      text: A
    - id: record-aaaa
      text: AAAA
    - id: record-mx
      text: MX
  correct_answers: [record-a, record-aaaa]
```

- With `selection_count`, the app says "Select 2". Without it, the app says
  "Select all that apply" and does not reveal how many are correct.
- `selection_count` must equal the number of correct answers.
- An answer counts as correct only if the learner selects exactly the correct
  choices: all of them, and nothing else. There is no partial credit.

### Explaining each choice

Any choice can carry its own explanation:

```yaml
- id: record-aaaa
  text: AAAA
  explanation:
    text: AAAA records hold IPv6 addresses, not IPv4.
```

### Keeping choices in order

Apps may shuffle choices. If order matters, for example a choice reads "None of
the above", or the choices are numbers that read better in order, turn
shuffling off:

```yaml
shuffle_choices: false
```

## 3. Writing flashcards

```yaml
flashcards:
  - id: term-osmosis
    front:
      text: Osmosis
    back:
      text: The movement of water across a selectively permeable membrane.
    hint:
      text: It is always about water.
```

Each side can have text, an image, or both.

### Text in another language

If part of your bundle is in a different language from the rest, as on a
vocabulary card, say which language it is. Screen readers then pronounce it
correctly, and right-to-left languages such as Arabic display properly:

```yaml
- id: word-gracias
  front:
    text: Gracias
    language: es
  back:
    text: Thank you
```

`language` works on any prompt, flashcard side, hint, explanation, or choice.
A translated version of a whole collection is a separate bundle, one per
language.

## 4. Formatting text

Text fields use a limited form of Markdown:

| You write                     | You get                         |
| ----------------------------- | ------------------------------- |
| `**bold**`                    | **bold**                        |
| `_italic_`                    | _italic_                        |
| `` `code` ``                  | `code`                          |
| `- item` on separate lines    | A bulleted list                 |
| `1. item` on separate lines   | A numbered list                 |
| `> quoted text`               | A block quote                   |
| ` ``` ` fenced lines          | A code block                    |
| `[text](https://example.org)` | A link, opened only when tapped |
| A table with `\|` separators  | A table                         |

For more than one line of text, use YAML's `|` block:

```yaml
explanation:
  text: |
    The first paragraph.

    The second paragraph, with a list:

    - one
    - two
```

**Not allowed:**

- HTML tags such as `<b>` or `<br>`. Use Markdown instead.
- Links that do not start with `https://`.
- Images from the web. Every image must be inside the bundle.
- Headings (`#`), except in the collection's `description`.

**Showing code or HTML as text.** Put it in backticks or a code block. This is
how you teach about HTML, shell commands, or security attacks safely:

````yaml
text: |
  Which value is a cross-site scripting payload?

  ```html
  <script>alert(1)</script>
  ```
````

The app shows exactly what you wrote. Nothing in a bundle ever runs.

**Watch out for `---`.** A line of dashes directly under a line of text turns
that text into a heading, which is not allowed in questions or cards. Leave a
blank line above it, or do not use it.

## 5. Adding images

A bundle with images is a ZIP file. Make a folder like this:

```text
my-bundle/
├── study.yaml
└── assets/
    ├── heart-chambers.png
    └── shapes/
        └── triangle.jpg
```

Refer to an image with an `image` field:

```yaml
prompt:
  text: In the diagram, which number marks the left ventricle?
  image:
    src: assets/heart-chambers.png
    alt: >-
      Front view of the heart as four numbered chambers: 1 upper left,
      2 upper right, 3 lower left, 4 lower right.
    credit: Diagram by Jane Example, CC BY 4.0
    credit_url: https://example.org/heart-diagram
```

You can also place images inside longer text, such as a description or an
explanation, with Markdown: `![description of the image](assets/flow.webp)`.

**Rules for images:**

- PNG, JPEG, or WebP. No SVG, GIF, or animation.
- File extensions in lowercase: `.png`, `.jpg`, `.jpeg`, `.webp`.
- File and folder names use letters, digits, `-`, `_`, and `.` only. No spaces.
- At most 8,192 pixels on a side, and at most 10 MiB per file.

**Write useful `alt` text.** It is what a screen reader says, and what a learner
gets when the image cannot be shown. Describe what the image shows that matters
for learning. Do not just say "diagram". If an image is purely decorative, write
`alt: ""`.

**Credit images that need it.** If you use someone else's image under a
license such as Creative Commons Attribution, put the attribution in `credit`.
Remove location data from photos before adding them.

### Making the ZIP file

The `study.yaml` file must be at the **top** of the ZIP file, not inside a
folder. Open your bundle folder, select **its contents** (`study.yaml` and
`assets`), and compress those:

- **Windows:** select both, right-click, choose **Compress to ZIP file** (or
  **Send to → Compressed (zipped) folder**).
- **macOS:** select both, right-click, choose **Compress 2 Items**.
- **Linux:** in a terminal inside the folder, run `zip -r ../my-bundle.waymark study.yaml assets`.

Rename the result to end in `.waymark`. Apps also accept `.zip`.

**About `integrity.json`.** Bundles made with `openwaymark pack` also contain
`integrity.json`, a list of fingerprints (SHA-256 digests) of every file. If
anything changes after packing, apps notice and refuse the bundle, instead of
quietly showing changed content. A ZIP file you make yourself has no
`integrity.json`, and that is fine. But if you unzip a packed bundle, edit it,
and zip it again, either repack it with `openwaymark pack` or delete
`integrity.json`. The old digests no longer match.

> An `openwaymark pack` command and a browser-based packer are planned. They will
> build the archive correctly and check it at the same time.

## 6. Describing your collection

All of these fields are optional:

```yaml
description: |
  Practice for the **unit 3 test**: the heart and the skeleton.
subject: Human anatomy
tags: [anatomy, high-school]
authors:
  - name: Jane Example
    url: https://example.org/jane
license:
  spdx: CC-BY-NC-4.0
  statement: Free for noncommercial study.
created: "2026-10-18"
updated: "2026-10-18"
sources:
  - title: Anatomy and Physiology 2e (OpenStax)
    url: https://openstax.org/details/books/anatomy-and-physiology-2e
practice_defaults:
  passing_percentage: 75
```

- **`license`**: say how others may use your material. Without one, nobody can
  assume they may share it. Use an [SPDX identifier](https://spdx.org/licenses/)
  in `spdx`, a sentence in `statement`, a link in `url`, or a combination.
- **`tags`**: lowercase words joined by hyphens, such as `record-types`. Items
  can have their own tags, which learners use to study one topic at a time.
- **`references`** on an item point to where to read more, such as a book
  chapter or a web page, and use the same fields as `sources`.
- **`passing_percentage`** suggests a target score for practice exams. It is
  practice only, never a prediction of an official result.

## 7. Identifiers and updates

Every item has an `id`, and so does every choice. Apps attach a learner's notes
and progress to these identifiers, so they matter more than they look.

- Use lowercase letters, digits, `-`, and `_`, up to 64 characters:
  `heart-chamber-001`, `term-osmosis`.
- Questions and flashcards share one set of identifiers, so they cannot reuse
  each other's identifiers.
- **Never change an item's `id`** when you fix or improve it. Learners keep
  their notes.
- **Give a new `id`** to an item that tests something different, even if it
  replaces an old one.

When you publish a new version:

1. Increase `version`, for example from `1.0.0` to `1.1.0`.
2. If you changed what an item means without changing its choices or answers,
   for example a correct choice now makes a different claim, add or increase
   `revision` on that item. Apps then know to draw the learner's attention to
   it.
3. Keep the collection `id` the same. A copy you will maintain separately needs
   a new one.

## 8. YAML pitfalls

YAML is friendly but has a few traps:

| Problem                                                                                | Fix                                     |
| -------------------------------------------------------------------------------------- | --------------------------------------- |
| `format_version: 0.1` is read as a number                                              | Quote it: `"0.1"`                       |
| A choice `text: 53` is read as a number                                                | Quote it: `text: "53"`                  |
| Text containing `: ` or starting with `[`, `{`, `*`, `&`, `!`, `%`, `@`, or a backtick | Put it in quotes, or use a `\|` block   |
| `no`, `yes`, `on`, `off` look like booleans to some tools                              | Quote them when they are text           |
| Dates such as `2026-10-18`                                                             | Quote them: `"2026-10-18"`              |
| Indenting with tabs                                                                    | YAML needs spaces; use two per level    |
| `&name` and `*name` (YAML anchors and aliases)                                         | Not allowed; repeat the content instead |

Lines starting with `#` are comments and are ignored.

## 9. Before you share

- [ ] Every question has the right `correct_answers`, and you have checked the
      facts against a reliable source.
- [ ] Every informative image has meaningful `alt` text.
- [ ] You have the right to share every image and every passage you used, and
      the `license` says what others may do.
- [ ] `version` is higher than the last version you shared.
- [ ] The bundle passes a validator. The `openwaymark validate` command and the
      browser validator are coming soon.

A validator checks structure and safety. It cannot tell whether your answers
are right. That review is yours.
