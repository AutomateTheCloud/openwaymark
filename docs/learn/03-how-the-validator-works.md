# 3. How the validator works

This tutorial follows one bundle through the engine in `packages/engine/src/`,
from the first byte to the final report. You will not change anything yet.
The goal is to know where things are, and why they are built the way they
are. Open each file in your editor as you read about it.

## The big picture

```text
 your file
    │
    ▼
 validate.ts  ── decides: archive (ZIP) or text (YAML)?
    │
    ├─▶ zip.ts         read the archive's table of contents; check every header
    ├─▶ paths.ts       check every name: no "..", no surprises, assets only
    ├─▶ limits.ts      sizes, counts, ratios: checked before and during reading
    ├─▶ yaml.ts        turn study.yaml into data, with positions for messages
    ├─▶ manifest.ts    check every field against the specification's rules
    ├─▶ markdown.ts    parse every text; allow only safe constructs
    ├─▶ images.ts      what is each image really? how big? damaged?
    ├─▶ integrity.ts   do the files match integrity.json?
    ├─▶ lint.ts        (optional) does anything look like a mistake?
    │
    ▼
 report.ts  ── every finding, every check performed or skipped, the verdict
```

Everything the engine finds goes into one **report**. Nothing is printed
directly. The command-line tool and the browser page each decide how to show
the report.

## Step 1: what kind of file is this? (`validate.ts`)

`validateBundle` reads the first four bytes. A ZIP file always starts with
`50 4B 03 04`, which is "PK" followed by two control bytes; PK are the
initials of Phil Katz, who invented the format. If those bytes are there, the
file is an archive. Otherwise the engine treats it as a text bundle.

> **Why look at bytes, not the file name?** A name is a claim anyone can make.
> The bytes are what the file really is. The same idea appears again for
> images.

## Step 2: reading the archive (`bytes.ts`, `zip.ts`)

The engine never loads a whole archive into memory. It reads through a
`ByteSource`, which can fetch any range of bytes. In Node that means reading
from an open file; in a browser, `Blob.slice`. That matters on a phone, where
memory is limited.

A ZIP file keeps its **table of contents**, the _central directory_, at the
end. `readZipDirectory`:

1. finds the end record by searching backward from the end of the file;
2. reads the central directory, which lists each entry's name, size,
   compression method, and position;
3. visits each entry's own **local header**, and checks that it agrees with
   the table of contents. Attackers make them disagree;
4. checks that the entries fill the file exactly, with no hidden gaps.

`readZipEntry` then decompresses one entry in 4 KB pieces, counting the
output. The moment the output is larger than the entry claimed, or larger than
a limit, it stops. That is how a **decompression bomb**, kilobytes that expand
to gigabytes, is defused before it goes off.

`bytes.ts` also contains CRC-32, SHA-256, and a UTF-8 decoder. Platforms
already provide these, so why write them here? So that the engine gives
**identical** results everywhere. Tests compare each one with Node's built-in
versions on thousands of random inputs.

## Step 3: names and limits (`paths.ts`, `limits.ts`)

Every entry name is checked by `entryNameProblem`: printable ASCII only, no
backslashes, no leading `/`, no `.` or `..` segments. Then each entry must be
`study.yaml`, an image under `assets/`, `integrity.json`, something reserved
for future signatures, or harmless operating-system clutter such as
`.DS_Store`, which is ignored. Anything else is an error.

This is an **allowlist**: a list of what is permitted, with everything else
refused. The opposite, a blocklist of known-bad names, always misses
something.

## Step 4: from text to data (`yaml.ts`)

`parseManifestText` uses the `yaml` library with strict settings, then walks
the result itself, rejecting:

- anchors and aliases, which enable the "billion laughs" expansion attack;
- tags, which make some YAML libraries create program objects, or run code;
- nulls and decimal numbers.

As it walks, it records where every value sits in the file, by **JSON
Pointer**. `/questions/0/choices/2` means "the third choice of the first
question", because counting starts at 0. That is how error messages can say
`line 33, column 5`.

> **A detail worth noticing:** the data is stored in objects created with
> `Object.create(null)`. In JavaScript, a key named `__proto__` normally
> changes an object's behavior: an attack called _prototype pollution_.
> Objects without a prototype have no such special key, so `__proto__` is just
> data.

## Step 5: the rules (`manifest.ts`)

`validateManifest` checks the data against the specification, section by
section. Each problem is reported against the most specific rule, with a
message written for a person. When a field name is unknown, it measures the
**edit distance** to every known name: the number of single-letter changes
needed to turn one word into another. If a known name is close, it suggests
it: "Did you mean `correct_answers`?"

## Step 6: text that cannot become code (`markdown.ts`)

Every text field is parsed into a **syntax tree**, a structured view of the
text: paragraphs, emphasis, code, links. `checkMarkdown` walks the tree and
rejects anything outside the allowed set, such as raw HTML, links that are not
`https`, or images from the web.

**Try it.** From the `openwaymark` folder, after `pnpm build`:

```bash
node --input-type=module -e "import { checkMarkdown } from './packages/engine/dist/index.js'; console.log(checkMarkdown('Hello <b>world</b>', { isDescription: false, isTextBundle: false }).findings);"
```

You will see two `OWM-MD-003` findings, one for `<b>` and one for `</b>`.
Put the text in backticks, `` `<b>world</b>` ``, and the findings disappear:
inside code, HTML is just text.

## Step 7: images (`images.ts`)

`inspectImage` reads an image's header, without decoding the pixels, to learn:

- its real format, from the signature;
- its declared width and height;
- whether it is animated;
- its Exif metadata, such as a photo's orientation or GPS location.

The size check happens **before** any decoding. An image that claims to be
100,000 × 100,000 pixels would need about 40 GB of memory to decode, so it is
refused while it is still a few bytes.

`verifyImageStructure` then checks PNG checksums and the exact amount of pixel
data, and that a JPEG is not cut off. Finally, a full decode is done by an
`ImageDecoder` that the caller supplies: `sharp` in the CLI, and the browser's
own decoder on the web page. Passing in a piece of a program this way is
called **dependency injection**. It keeps the engine free of anything
platform-specific.

## Step 8: the report (`report.ts`)

The report holds:

- every **diagnostic**: a rule, a severity, a message, and a location;
- every **check**, marked performed, not applicable, skipped, or not reached;
- the **verdict**: `conforming`, `not-conforming`, or `incomplete`.

"Incomplete" exists for honesty. If a required check could not run, for
example because no image decoder was available, the engine never claims the
bundle conforms.

## Grading lives here too (`grading.ts`)

The engine also contains the one piece of study logic every app must agree on:
whether an answer is right.

```bash
node --input-type=module -e "import { gradeResponse } from './packages/engine/dist/index.js'; console.log(gradeResponse(['a', 'b'], ['b', 'a']), gradeResponse(['a', 'b'], ['a']), gradeResponse(['a'], []));"
```

```text
correct incorrect unanswered
```

Order does not matter, partial answers earn nothing, and selecting nothing is
"unanswered". `packages/engine/test/grading.test.ts` checks these as
**properties**: statements that must hold for _every_ input, which the
fast-check library tests on thousands of random examples.

## How it is all tested

| Kind of test            | Where                                                 | What it proves                                                    |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Unit and property tests | `packages/engine/test/`                               | Each piece behaves correctly, including on random inputs          |
| Conformance fixtures    | `fixtures/`, run by `test/fixtures.test.ts`           | Every attack and mistake is caught, and every valid case accepted |
| Examples and docs       | `test/examples.test.ts`, `test/documentation.test.ts` | Every bundle shown in the documentation really is valid           |
| Browser parity          | `packages/web-validator/e2e/`                         | Chromium, Firefox, and WebKit reach the same verdicts as Node     |

**Next:** [make your first code change](04-your-first-code-change.md).
