# OpenWaymark Bundle Format

- **Version:** Draft 0.1 (working draft)
- **Date:** 2026-10-18
- **Editors:** Automate the Cloud Inc.
- **License:** [Apache License 2.0](../LICENSE). Copyright 2026 Automate the
  Cloud Inc.

## Status of this document

This is a working draft. It is not a released standard, and anything in it may
change before version 1.0. Every change between drafts is recorded in
[CHANGELOG.md](CHANGELOG.md). Questions that this draft leaves open are listed
in [Appendix C](#appendix-c-open-issues-in-this-draft).

Implementations identify this draft by its exact version, "0.1". Conformance
to this draft says nothing about conformance to any other version
(OWM-CONF-004, OWM-VER-003).

## Abstract

OpenWaymark is a format for portable study bundles. A bundle holds one pool of
multiple-choice practice questions, a collection of flashcards, or both. It
may include explanations, hints, references, and local images. Bundles are
written in a restricted profile of YAML, with text in a restricted profile of
Markdown. A bundle with images is an ordinary ZIP archive; a bundle without
images can be a single YAML file.

The format defines what a bundle contains and what it means. That includes how
an answer is graded. It does not define how an application presents study
sessions, schedules review, stores personal notes, or tracks progress.
Personal learning data is never part of a bundle.

## Contents

1. [Introduction](#1-introduction)
2. [Conformance](#2-conformance)
3. [Bundle forms and the archive profile](#3-bundle-forms-and-the-archive-profile)
4. [Manifest encoding: the YAML profile](#4-manifest-encoding-the-yaml-profile)
5. [Versions, compatibility, and extensions](#5-versions-compatibility-and-extensions)
6. [The collection](#6-the-collection)
7. [Items: questions and flashcards](#7-items-questions-and-flashcards)
8. [Grading](#8-grading)
9. [Content objects and the Markdown profile](#9-content-objects-and-the-markdown-profile)
10. [Images and other assets](#10-images-and-other-assets)
11. [Resource limits](#11-resource-limits)
12. [Identity across versions](#12-identity-across-versions)
13. [Security considerations](#13-security-considerations)
14. [Privacy considerations](#14-privacy-considerations)
15. [Validators](#15-validators)
16. [References](#16-references)

- [Appendix A: Recommended lint checks](#appendix-a-recommended-lint-checks)
- [Appendix B: Example manifest](#appendix-b-example-manifest)
- [Appendix C: Open issues in this draft](#appendix-c-open-issues-in-this-draft)

---

## 1. Introduction

### 1.1 Purpose and scope

People who study from practice questions and flashcards should be able to
keep their material and move it between applications. OpenWaymark gives that
material a documented, openly licensed home. Anyone can read or write it
without a particular application, service, account, or license key.

In scope:

- The structure of a bundle: its archive layout, manifest, and assets.
- The meaning of each field, including how an answer to a question is graded.
- The text and image profiles that a bundle may use, and how a reader renders
  them safely.
- Identity rules that let readers relate versions of the same collection.
- Conformance requirements for producers, readers, and validators.

Out of scope:

- How an application presents questions, orders a study session, times an
  exam, or reports progress.
- Personal data: notes, review states, bookmarks, answers, and history.
- Spaced-repetition scheduling.
- Official exam administration or proctoring.
- Catalogs, distribution, and signatures. This draft defines no signature
  mechanism.

### 1.2 Design principles

- **Human-authorable.** A person with a text editor can write a valid bundle,
  and so can an AI tool following written instructions.
- **Safe by construction.** A bundle is data. Nothing in it is executable, and
  nothing in it causes a reader to contact the network.
- **Offline.** Everything needed to study is inside the bundle.
- **Stable identity.** Items keep their IDs across revisions, so applications
  can keep personal data attached to them.
- **Strict, then extensible.** Unknown fields are errors, so typos are caught.
  Growth happens through explicit versioning and namespaced extensions.

### 1.3 Notational conventions

<!-- rules:off -->

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174]
when, and only when, they appear in all capitals, as shown here.

<!-- rules:on -->

Each normative statement begins with a rule identifier in bold, such as
**OWM-PKG-001**. Identifiers are stable. A rule that is removed leaves its
identifier retired, never reused. Diagnostics from validators refer to these
identifiers.

Sections, paragraphs, and notes marked _informative_ contain no requirements.

Byte sizes use binary units: 1 KiB is 1,024 bytes and 1 MiB is 1,048,576 bytes.

### 1.4 Terminology

- **Bundle:** a collection in one of the two forms defined in section 3.
- **Archive bundle:** a bundle stored as a ZIP archive (section 3.2).
- **Text bundle:** a bundle stored as a single YAML file, without assets
  (section 3.5).
- **Manifest:** the YAML document that describes the collection. In an archive
  bundle, it is the entry `study.yaml`.
- **Collection:** the content a manifest describes, consisting of metadata and
  items.
- **Item:** a question or a flashcard.
- **Question:** a multiple-choice item that a learner answers and a reader
  grades.
- **Flashcard:** an item with a front and a back, which a learner reveals. It
  is not graded.
- **Choice:** one selectable answer to a question.
- **Content object:** the structure used for prompts, choices, faces, hints,
  and explanations (section 9.1).
- **Asset:** a file in an archive bundle other than the manifest, such as an
  image.
- **Member:** a key and its value in a YAML mapping.
- **Producer:** software or a person that creates or modifies bundles.
- **Reader:** software that imports bundles and presents their content to
  learners.
- **Validator:** software that checks bundles against this specification and
  reports diagnostics.
- **Error:** a violation of a requirement of this specification. A bundle with
  an error is not conforming.
- **Warning:** a diagnostic that does not affect conformance.

---

## 2. Conformance

### 2.1 Conformance classes

This specification defines three conformance classes. One piece of software
can belong to more than one.

- **OWM-CONF-001.** A **conforming bundle** MUST satisfy every requirement in
  this specification that applies to bundles. A **conforming producer** MUST
  emit only conforming bundles.
- **OWM-CONF-002.** A **conforming reader** MUST reject any bundle that is not
  conforming, and MUST report at least one reason a person can understand. A
  reader MUST NOT partially import a bundle it rejects.
- **OWM-CONF-003.** A **conforming validator** MUST detect every error defined
  in this specification, and MUST report the checks it performed and the
  checks it did not perform (section 15).

> **Note (informative).** A reader is a validator in practice: it has to find
> every error before accepting a bundle. Readers and validators differ in what
> they report. A validator reports every problem with locations and rule
> identifiers. A reader may stop at the first error, and it presents the result
> to a learner.

### 2.2 Version claims

- **OWM-CONF-004.** A bundle MUST declare the format version it conforms to in
  `format_version` (section 5.1). Producers, readers, and validators MUST state
  which format versions they support.

### 2.3 Presentation latitude

- **OWM-CONF-005.** Readers MAY choose any visual presentation, ordering,
  feedback timing, and study workflow, provided they preserve the meaning
  defined here. In particular, they must grade according to section 8 and
  render content according to section 9.

---

## 3. Bundle forms and the archive profile

### 3.1 Forms

A bundle takes one of two forms:

1. An **archive bundle**: a ZIP archive containing the manifest `study.yaml`
   and, optionally, assets under `assets/`.
2. A **text bundle**: a single YAML file that is the manifest itself. It has no
   assets.

- **OWM-PKG-001.** A reader MUST support archive bundles and SHOULD support
  text bundles. A reader MUST determine the form from the file's content, not
  from its name. A file that begins with the ZIP local file header signature
  (`50 4B 03 04`) is an archive bundle. Any other file is a text bundle
  candidate.

### 3.2 ZIP archive profile

An archive bundle is a ZIP file as described in [APPNOTE], restricted as
follows.

- **OWM-PKG-002.** The archive MUST consist of exactly one disk (no spanning or
  splitting). It MUST have a single end of central directory record, located
  at the end of the file and followed only by the archive comment.
- **OWM-PKG-003.** The archive MUST NOT use ZIP64. That excludes the ZIP64 end
  of central directory record and locator, and ZIP64 extended information extra
  fields (header ID `0x0001`).
- **OWM-PKG-004.** Entries MUST NOT be encrypted. General purpose bits 0 and 6
  MUST be clear, and no entry may use compression method 99 (AE-x
  encryption). The central directory MUST NOT be encrypted or compressed.
- **OWM-PKG-005.** Every entry MUST use compression method 0 (stored) or 8
  (deflate).
- **OWM-PKG-006.** The first byte of the archive MUST be the start of a local
  file header. Every byte of the archive MUST belong to exactly one of the
  following:
  - a local file header;
  - entry data;
  - a data descriptor;
  - the central directory;
  - the end of central directory record;
  - the archive comment.

  Entries MUST NOT overlap, and there MUST NOT be unaccounted bytes between
  them.

- **OWM-PKG-007.** The following MUST be identical in every entry's local
  header and its central directory record:
  - the file name;
  - the compression method;
  - the general purpose flags;
  - the CRC-32 and both sizes. When general purpose bit 3 is set, these come
    from the data descriptor instead of the local header.
- **OWM-PKG-008.** The CRC-32 of every entry's uncompressed data MUST match the
  recorded value. Readers MUST verify it.
- **OWM-PKG-009.** Every entry MUST be either a regular file or a directory.
  Symbolic links, hard links, devices, and other special files are prohibited.
  An entry whose external attributes declare a Unix file type (version made by
  host 3) other than regular file (`S_IFREG`) or directory (`S_IFDIR`) MUST be
  treated as prohibited.
- **OWM-PKG-010.** A directory entry has a name ending in `/`, and it MUST have
  zero uncompressed size. Directory entries carry no meaning; readers MUST
  NOT require them.
- **OWM-PKG-011.** Readers MUST ignore the archive comment and per-entry
  comments. They MUST ignore extra fields they do not recognize. One exception:
  the Info-ZIP Unicode Path extra field (header ID `0x7075`) MUST NOT be present.

> **Note (informative).** These rules remove the ambiguity behind well-known
> archive attacks. Local and central headers that disagree, data hidden before
> or between entries, and links that point outside the extraction directory
> all lead different tools to see different files. Data descriptors (bit 3) are
> allowed because streaming producers write them.

### 3.3 Entry names

- **OWM-PATH-001.** Every entry name MUST consist only of printable ASCII
  characters (`0x21`–`0x7E`). Names MUST NOT contain a backslash, MUST NOT
  begin with `/`, and MUST NOT contain an empty segment (`//`) or a segment
  equal to `.` or `..`.
- **OWM-PATH-002.** No two entries may have names that are equal when compared
  ASCII case-insensitively. A directory entry and a file entry also count as
  duplicates when their names differ only by the trailing `/`.

### 3.4 Archive contents

- **OWM-PATH-003.** An archive bundle MUST contain exactly one manifest, the
  regular file entry named `study.yaml` at the root of the archive.
- **OWM-PATH-004.** Every other regular file entry MUST be either an asset or an
  ignorable entry. An asset's name begins with `assets/` and satisfies
  section 10.1. An ignorable entry is any entry whose name begins with
  `__MACOSX/`, or whose final segment is `.DS_Store`, `Thumbs.db`, or
  `desktop.ini`. Any other entry is an error.
- **OWM-PATH-005.** Readers MUST NOT read the contents of ignorable entries, and
  MUST NOT treat them as part of the bundle. Validators SHOULD report each one
  as a warning. Producers SHOULD NOT include them.
- **OWM-PATH-006.** Directory entries MUST be named `assets/` or have names of
  the form `assets/<segments>/`, or they MUST be ignorable entries.

> **Note (informative).** The manifest must be at the root. An archive that
> contains a single folder with `study.yaml` inside it is not a conforming
> bundle. This is the most common packing mistake: compressing the folder
> instead of its contents. Validators are encouraged to say so explicitly.

### 3.5 Text bundles

- **OWM-TEXT-001.** A text bundle is a manifest stored on its own. It MUST
  satisfy every manifest requirement in this specification.
- **OWM-TEXT-002.** A text bundle MUST NOT reference any asset. It MUST NOT
  contain image objects (section 9.2), and its Markdown MUST NOT contain image
  syntax. Readers MUST NOT resolve references against files that sit next to a
  text bundle on the learner's device.

### 3.6 File names and media type

- **OWM-PKG-012.** Producers SHOULD name archive bundles with the extension
  `.waymark`. Readers SHOULD also accept the extension `.zip`. A text bundle
  SHOULD use `.yaml`. Readers MUST NOT infer the form or the format version from
  the file name.

This draft does not register a media type (Appendix C, issue 1).

---

## 4. Manifest encoding: the YAML profile

### 4.1 Character encoding

- **OWM-ENC-001.** The manifest MUST be encoded in UTF-8 [RFC3629], and MUST NOT
  contain byte sequences that are invalid UTF-8. A leading byte order mark
  (`EF BB BF`) is permitted. Readers MUST accept it and ignore it. Producers
  SHOULD NOT write it.
- **OWM-ENC-002.** The manifest MUST NOT contain the following characters,
  anywhere:
  - C0 control characters other than tab (`U+0009`), line feed (`U+000A`), and
    carriage return (`U+000D`);
  - `U+007F`;
  - C1 control characters (`U+0080`–`U+009F`);
  - surrogate code points;
  - the noncharacters `U+FFFE` and `U+FFFF`.
- **OWM-ENC-003.** Producers SHOULD write text in Unicode Normalization Form C.
  Readers MUST NOT alter text other than by the processing this specification
  defines. Identifiers are ASCII (section 7.1), so normalization never affects
  identity.

### 4.2 YAML profile

The manifest is a YAML 1.2.2 [YAML] document, restricted as follows.

- **OWM-YAML-001.** The manifest MUST contain exactly one YAML document. A
  single leading document start marker (`---`) and a single trailing document
  end marker (`...`) are permitted. Directives (`%YAML`, `%TAG`) MUST NOT be
  used.
- **OWM-YAML-002.** The manifest MUST NOT contain anchors (`&`), aliases (`*`),
  or explicit tags (`!`, `!!`, or verbatim tags), anywhere in the document.
- **OWM-YAML-003.** Every mapping key MUST be a plain or quoted scalar that
  resolves to a string. Complex keys (`?`) MUST NOT be used.
- **OWM-YAML-004.** A mapping MUST NOT contain two keys with the same string
  value.
- **OWM-YAML-005.** Untagged plain scalars MUST be resolved using the YAML 1.2
  core schema (YAML 1.2.2, section 10.3). Readers MUST NOT apply YAML 1.1
  resolution rules. For example, `yes`, `no`, `on`, and `off` are strings,
  dates are strings, and `0755` is an integer, not an octal number.

> **Note (informative).** Many widely used YAML libraries implement YAML 1.1
> by default. An implementation built on one of them must configure it for
> the 1.2 core schema, or reject manifests whose meaning differs between the
> two. Lint check OWM-LINT-012 helps authors avoid such scalars entirely.

### 4.3 Data model

After parsing, the manifest is a tree of the following values:

- mappings with string keys;
- sequences;
- strings;
- integers;
- floating-point numbers;
- booleans;
- nulls.

The remaining requirements of this specification apply to that tree. They
never apply to the YAML text.

- **OWM-YAML-006.** Where this specification requires a string, the value MUST be
  a string after resolution. A number or boolean is not accepted in its place.
  For example, `format_version: 0.1` is a floating-point number and therefore
  an error, while `format_version: "0.1"` is a string.
- **OWM-YAML-007.** Where this specification requires an integer, the value MUST
  be an integer after resolution, between -2⁵³+1 and 2⁵³-1 inclusive.
- **OWM-YAML-008.** A null value MUST NOT appear anywhere in the manifest. To
  omit an optional member, leave it out.
- **OWM-YAML-009.** Floating-point numbers MUST NOT appear anywhere in a
  manifest that conforms to format version 0.1. That includes infinities and
  NaN.
- **OWM-YAML-010.** Every string that this specification marks as nonblank MUST
  contain at least one character other than white space. Unless stated
  otherwise, every string member is nonblank.

---

## 5. Versions, compatibility, and extensions

### 5.1 Format version

- **OWM-VER-001.** The root member `format_version` MUST be a string of the form
  `MAJOR.MINOR`, where each part is a decimal integer without leading zeros.
  A bundle conforming to this draft MUST use `"0.1"`.
- **OWM-VER-002.** A reader MUST reject a bundle whose `format_version` it does
  not support. It MUST report the version it found and the versions it
  supports.
- **OWM-VER-003.** While the major version is 0, every minor version is a
  distinct, possibly incompatible draft. A reader that supports `0.N` MUST NOT
  accept any other `0.M` unless it also implements `0.M` in full.

> **Note (informative).** From version 1.0, minor versions are intended to be
> backward compatible within a major version. A later draft will define exactly
> how a 1.x reader treats a bundle from a newer minor version.

### 5.2 Unknown members

- **OWM-VER-004.** A mapping defined by this specification MUST NOT contain
  members other than those defined for it in the bundle's format version,
  except inside an `extensions` mapping (section 5.4). An unknown member is an
  error.

> **Note (informative).** Strictness catches misspelled field names, such as
> `explaination`, that would otherwise disappear silently.

### 5.3 Required features

- **OWM-VER-005.** The optional root member `requires` is a sequence of feature
  identifiers that a reader must understand to interpret the bundle correctly.
  Each identifier MUST be a string matching `^[a-z0-9]+(-[a-z0-9]+)*$` (a
  feature defined by this specification) or a namespace identifier as defined
  in section 5.4 (a feature defined by an extension). Identifiers MUST be
  unique within the list.
- **OWM-VER-006.** A reader MUST reject a bundle that lists a feature it does not
  implement.

Format version 0.1 defines no features. A 0.1 bundle can therefore list only
extension features.

### 5.4 Extensions

- **OWM-EXT-001.** The collection, each question, each choice, and each flashcard
  MAY contain an `extensions` member. Its value MUST be a mapping, and each key
  MUST be a namespace identifier: a lowercase reverse domain name with at least
  two labels, matching `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`.
  An example is `com.example.difficulty`. The value under each key is
  unconstrained, apart from the YAML profile and the resource limits.
- **OWM-EXT-002.** Producers MUST use only namespaces derived from domain names
  they control. Examples and test material MAY use `org.example` and names
  under it, since `example.org` is reserved for documentation [RFC2606].
- **OWM-EXT-003.** An extension MUST NOT change the meaning of any member
  defined by this specification, including grading. A reader MAY ignore any
  extension, unless the bundle lists it in `requires`.
- **OWM-EXT-004.** Readers MUST treat extension values as untrusted data. They
  MUST NOT interpret an extension value as code, markup, a URL to fetch, or a
  path outside the bundle.

---

## 6. The collection

### 6.1 Root members

The root of the manifest is a mapping that describes the collection.

| Member              | Type                   | Required  | Meaning                                                 |
| ------------------- | ---------------------- | --------- | ------------------------------------------------------- |
| `format_version`    | string                 | yes       | Format version (section 5.1)                            |
| `id`                | string (UUID)          | yes       | Collection identity (section 6.2)                       |
| `title`             | string                 | yes       | Human-readable name, at most 200 characters             |
| `version`           | string (SemVer)        | yes       | Content revision (section 6.3)                          |
| `language`          | string (BCP 47)        | yes       | Primary language of the content (section 6.4)           |
| `description`       | string (Markdown)      | no        | Overview, prerequisites, and instructions (section 9.4) |
| `subject`           | string                 | no        | Broad subject area, at most 200 characters              |
| `tags`              | sequence of tags       | no        | Labels for discovery (section 7.6)                      |
| `authors`           | sequence of authors    | no        | People or organizations credited (section 6.5)          |
| `license`           | license object         | no        | Terms for the content (section 6.6)                     |
| `created`           | string (date)          | no        | Date first published (section 6.7)                      |
| `updated`           | string (date)          | no        | Date of this revision (section 6.7)                     |
| `sources`           | sequence of references | no        | Material used to prepare the content (section 7.7)      |
| `practice_defaults` | mapping                | no        | Suggested practice settings (section 6.8)               |
| `requires`          | sequence of strings    | no        | Required features (section 5.3)                         |
| `extensions`        | mapping                | no        | Extension data (section 5.4)                            |
| `questions`         | sequence of questions  | see below | The question pool (section 7.3)                         |
| `flashcards`        | sequence of flashcards | see below | The flashcard collection (section 7.4)                  |

- **OWM-COL-001.** The root MUST be a mapping containing every required member in
  the table, with values of the stated types.
- **OWM-COL-002.** A collection MUST contain at least one item. If `questions` is
  present, it MUST be a nonempty sequence. If `flashcards` is present, it MUST
  be a nonempty sequence. At least one of them MUST be present.
- **OWM-COL-003.** `title` and `subject` MUST be nonblank strings of at most 200
  Unicode code points. They are plain text: readers MUST NOT interpret Markdown
  or markup in them.
- **OWM-COL-016.** Every sequence defined by this specification MUST be nonempty
  when present. That includes `tags`, `authors`, `sources`, `references`, and
  `requires`. To omit one, leave the member out.

A collection has one question pool. Named tests, sections, and multiple pools
are not part of this version.

> **Note (informative).** Item counts, image counts, and bundle sizes are not
> fields. Readers compute them.

### 6.2 Collection identifier

- **OWM-COL-004.** `id` MUST be a UUID [RFC9562] in its canonical textual form,
  using lowercase hexadecimal digits: `8-4-4-4-12`. It MUST NOT be the nil UUID
  (all zeros) or the max UUID (all `f`). Producers SHOULD generate a version 4
  or version 7 UUID when they create a collection.
- **OWM-COL-005.** Producers MUST keep the same `id` for every version of a
  collection, and MUST generate a new `id` for a collection that is not a
  version of an existing one, such as a copy that will be maintained
  separately.

Section 12 explains what an identifier means, and what it does not prove.

### 6.3 Content version

- **OWM-COL-006.** `version` MUST be a version string as defined by Semantic
  Versioning 2.0.0 [SEMVER], for example `1.0.0` or `2.1.0-beta.1`. Versions are
  ordered by SemVer precedence.
- **OWM-COL-007.** Producers MUST increase `version` whenever any content of the
  bundle changes, assets included. Two bundles with the same `id` and the same
  `version` but different content are in conflict (section 12.3).

> **Note (informative).** SemVer's major, minor, and patch numbers have no
> defined meaning for study content. A suggestion: increase the patch version
> for corrections, the minor version for added items, and the major version for
> restructuring.

### 6.4 Language

- **OWM-COL-008.** `language` MUST be a well-formed language tag as defined by
  [BCP47], for example `en`, `en-US`, or `pt-BR`. Validators SHOULD warn when
  a subtag is not in the IANA Language Subtag Registry.

Language applies to the whole collection. This version has no per-item
language.

### 6.5 Authors

- **OWM-COL-009.** `authors` MUST have at most 32 entries. Each entry MUST be a
  mapping with a nonblank `name`, plain text of at most 200 code points. It MAY
  also have a `url`, which must satisfy section 9.5.

### 6.6 License

- **OWM-COL-010.** The `license` member, when present, MUST be a mapping with at
  least one of the following members:
  - `spdx`: a license expression as defined by the SPDX specification [SPDX],
    of at most 1,000 characters, such as `CC-BY-4.0`, `CC-BY-NC-4.0`, or
    `LicenseRef-Example`;
  - `statement`: a nonblank plain-text rights statement of at most 2,000 code
    points;
  - `url`: a URL for the full terms, satisfying section 9.5.
- **OWM-COL-011.** Validators SHOULD check that `spdx` is syntactically valid,
  and SHOULD warn when it contains a license identifier that is not on the
  SPDX License List.
- **OWM-COL-012.** Readers MUST NOT present a bundle without a `license` member
  as permitting redistribution. Readers SHOULD display the license information
  when it is present.

> **Note (informative).** A license with additional permissions can be expressed
> with `spdx` for the base license, plus a `statement` and a `url` for the
> addition. Sources and authors support review; they do not prove accuracy or
> permission.

### 6.7 Dates

- **OWM-COL-013.** `created` and `updated` MUST be strings in the `full-date` form
  of [RFC3339] (`YYYY-MM-DD`), and MUST denote valid calendar dates.

### 6.8 Practice defaults

- **OWM-COL-014.** `practice_defaults`, when present, MUST be a mapping. In this
  version, its only member is `passing_percentage`, an integer from 1 to 100
  inclusive. It suggests the percentage of questions in a practice attempt
  that a learner should answer correctly.
- **OWM-COL-015.** `passing_percentage` is a suggestion. Readers MAY let the
  learner change it, and MUST NOT present reaching it as evidence of
  readiness for, or success in, any official examination.

---

## 7. Items: questions and flashcards

### 7.1 Item identifiers

- **OWM-ID-001.** Every question and every flashcard MUST have an `id`: a string
  of 1 to 64 characters matching `^[a-z0-9][a-z0-9_-]{0,63}$`.
- **OWM-ID-002.** Item identifiers MUST be unique within a collection. Questions
  and flashcards share one namespace, so a question and a flashcard MUST NOT
  have the same `id`.
- **OWM-ID-003.** Every choice MUST have an `id` matching the same pattern.
  Choice identifiers MUST be unique within their question, and they MAY repeat
  across questions.
- **OWM-ID-004.** Producers MUST NOT derive identifiers from an item's position,
  so that reordering items never changes their identity. Producers SHOULD NOT
  derive identifiers from changeable text such as the prompt.

Section 12 defines how identifiers relate items across versions.

### 7.2 Members common to all items

| Member       | Type                   | Required | Meaning                                            |
| ------------ | ---------------------- | -------- | -------------------------------------------------- |
| `id`         | string                 | yes      | Item identifier (section 7.1)                      |
| `hint`       | content object         | no       | Help revealed only when the learner asks for it    |
| `tags`       | sequence of tags       | no       | Labels for targeted study (section 7.6)            |
| `references` | sequence of references | no       | Where to study this item further (section 7.7)     |
| `revision`   | integer                | no       | Material revision number, default 1 (section 12.2) |
| `extensions` | mapping                | no       | Extension data (section 5.4)                       |

- **OWM-ITEM-001.** `revision`, when present, MUST be an integer greater than or
  equal to 1. An absent `revision` is equivalent to 1.
- **OWM-ITEM-002.** Readers MUST NOT show a hint until the learner asks for it.

### 7.3 Questions

A question is a mapping with the common members and the following.

| Member            | Type                   | Required | Meaning                                                             |
| ----------------- | ---------------------- | -------- | ------------------------------------------------------------------- |
| `type`            | string                 | yes      | `multiple_choice`, the only type in this version                    |
| `selection`       | string                 | yes      | `single` or `multiple`                                              |
| `prompt`          | content object         | yes      | The question itself                                                 |
| `choices`         | sequence of choices    | yes      | 2 to 26 choices                                                     |
| `correct_answers` | sequence of choice IDs | yes      | The correct choices                                                 |
| `selection_count` | integer                | no       | For `multiple`, the number of choices to tell the learner to select |
| `shuffle_choices` | boolean                | no       | Whether readers may reorder choices; default `true`                 |
| `explanation`     | content object         | no       | Explanation of the answer as a whole                                |

- **OWM-Q-001.** `type` MUST be `multiple_choice`. Other question types will be
  added only through new format versions or required features (section 5.3).
- **OWM-Q-002.** `selection` MUST be `single` or `multiple`.
- **OWM-Q-003.** `choices` MUST contain at least 2 and at most 26 choices.
- **OWM-Q-004.** `correct_answers` MUST be a nonempty sequence of unique strings.
  Each string MUST be the `id` of a choice in the same question.
- **OWM-Q-005.** When `selection` is `single`, `correct_answers` MUST contain
  exactly one identifier, and `selection_count` MUST NOT be present.
- **OWM-Q-006.** When `selection` is `multiple`, `correct_answers` MAY contain any
  number of identifiers from 1 to the number of choices. When
  `selection_count` is present, it MUST equal the number of identifiers in
  `correct_answers`.
- **OWM-Q-007.** `shuffle_choices`, when present, MUST be a boolean.

#### Choices

A choice is a mapping with these members:

| Member        | Type              | Required  | Meaning                           |
| ------------- | ----------------- | --------- | --------------------------------- |
| `id`          | string            | yes       | Choice identifier (section 7.1)   |
| `text`        | string (Markdown) | see below | The choice's text                 |
| `image`       | image object      | see below | The choice's image                |
| `explanation` | content object    | no        | Why this choice is right or wrong |
| `extensions`  | mapping           | no        | Extension data                    |

- **OWM-Q-008.** A choice MUST have a `text`, an `image`, or both. `text` and
  `image` follow the same rules as in a content object (section 9.1).

#### Presenting choices

- **OWM-Q-009.** Readers MUST generate any display labels for choices, such as
  A, B, C, from the order in which they present the choices. Labels are not
  part of the bundle. Grading MUST use choice identifiers, never labels or
  positions.
- **OWM-Q-010.** When `shuffle_choices` is `false`, readers MUST present the
  choices in the order the manifest lists them. When it is `true` or absent,
  readers MAY present the choices in any order.
- **OWM-Q-011.** Readers MUST make clear whether a question accepts one choice
  or several. For a `multiple` question with `selection_count`, they MUST
  tell the learner how many to select ("Select 2"). Without
  `selection_count`, they SHOULD say "Select all that apply" or the
  equivalent in the reader's language.
- **OWM-Q-012.** For a `multiple` question without `selection_count`, readers
  MUST NOT reveal the number of correct choices before the learner's response
  is graded.

> **Note (informative).** Because readers may shuffle, choice text such as "All
> of the above" or "Both A and B" may become wrong. Authors set
> `shuffle_choices: false` when order matters, and lint check OWM-LINT-004
> flags likely cases.

### 7.4 Flashcards

A flashcard is a mapping with the common members and the following.

| Member  | Type           | Required | Meaning                 |
| ------- | -------------- | -------- | ----------------------- |
| `front` | content object | yes      | Shown first             |
| `back`  | content object | yes      | Revealed by the learner |

- **OWM-CARD-001.** A flashcard MUST have both `front` and `back`. Each MUST be a
  valid content object, so each has text, an image, or both.
- **OWM-CARD-002.** Readers MUST NOT show the back of a flashcard until the
  learner reveals it, except where the learner has chosen a mode that shows
  both sides.

### 7.5 Personal data

- **OWM-ITEM-003.** Bundles MUST NOT contain a learner's personal data, such as
  notes, review states, answers, scores, or study history. Readers MUST store
  such data separately from bundle content, and MUST NOT write it into
  bundles they export as study content.

### 7.6 Tags

- **OWM-ITEM-004.** A tag MUST be a string of 1 to 64 characters matching
  `^[a-z0-9]+(-[a-z0-9]+)*$`. Tags MUST be unique within one `tags` list. An
  item MAY have at most 32 tags, and the collection MAY have at most 64.
- **OWM-ITEM-005.** Tags are labels, compared exactly. Readers MUST NOT interpret
  a tag as a query, an expression, or a reference.

Collection tags support discovery. Item tags support targeted study.

### 7.7 References and sources

A reference identifies material for further study, or material used to
prepare the content.

| Member      | Type   | Required | Meaning                                                                      |
| ----------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `title`     | string | yes      | Title of the work, at most 500 code points                                   |
| `reference` | string | no       | Location within the work: chapter, page, or section, at most 500 code points |
| `url`       | string | no       | A web address for the work (section 9.5)                                     |

- **OWM-ITEM-006.** Each entry in `references` (on an item) and `sources` (on the
  collection) MUST be a mapping with a nonblank `title`. `title` and
  `reference` are plain text. An item MAY have at most 16 references, and
  the collection MAY have at most 64 sources.

---

## 8. Grading

Grading is defined here so that every reader scores the same response the same
way. When and how a reader shows results is up to the reader.

- **OWM-GRADE-001.** A response to a question is a set of choice identifiers
  from that question. The set is empty when the learner selected nothing.
- **OWM-GRADE-002.** A response is **correct** if and only if it is exactly equal
  to the set of identifiers in `correct_answers`. Every other nonempty response
  is **incorrect**, and an empty response is **unanswered**. No response is
  partially correct.
- **OWM-GRADE-003.** Grading MUST NOT depend on the order in which choices were
  presented, the order of `correct_answers`, the time taken, or whether a hint
  was viewed.
- **OWM-GRADE-004.** For a `single` question, readers MUST NOT allow a response
  with more than one choice. For a `multiple` question with `selection_count`,
  readers MAY prevent the learner from selecting more choices than that count.
  They MUST still grade any response according to OWM-GRADE-002.
- **OWM-GRADE-005.** A reader that reports a score for a set of questions, and
  compares it with `passing_percentage`, MUST do the following:
  - count every question equally;
  - count unanswered questions in the total;
  - determine that the attempt meets the target if and only if
    `correct × 100 ≥ passing_percentage × total`, using exact integer
    arithmetic.

> **Note (informative).** Integer arithmetic avoids rounding disagreements. For
> example, 7 correct out of 9 is 77.8 percent. That meets a target of 77 and
> does not meet a target of 78, whichever way a display rounds it.

---

## 9. Content objects and the Markdown profile

### 9.1 Content objects

A content object holds text, an image, or both. Prompts, flashcard faces,
hints, and explanations are content objects. A choice carries the same two
members directly.

| Member  | Type              | Required  | Meaning                                    |
| ------- | ----------------- | --------- | ------------------------------------------ |
| `text`  | string (Markdown) | see below | Text in the Markdown profile (section 9.3) |
| `image` | image object      | see below | One image (section 9.2)                    |

- **OWM-CONT-001.** A content object MUST be a mapping with a `text`, an `image`,
  or both. `text` MUST be nonblank and at most 65,536 bytes when encoded in
  UTF-8.
- **OWM-CONT-002.** When a content object has both, readers MUST present the text
  before the image, in reading order.

### 9.2 Image objects

| Member       | Type                | Required | Meaning                                                       |
| ------------ | ------------------- | -------- | ------------------------------------------------------------- |
| `src`        | string (asset path) | yes      | Path of the image in the archive (section 10.1)               |
| `alt`        | string              | yes      | Text alternative; empty for a decorative image                |
| `credit`     | string              | no       | Attribution for the image, as plain text                      |
| `credit_url` | string              | no       | A web address for the image's source or license (section 9.5) |

- **OWM-IMG-001.** `src` MUST be the path of an asset that is present in the
  bundle and satisfies section 10.
- **OWM-IMG-002.** `alt` MUST be present. It is plain text of at most 1,000 code
  points. An empty string declares the image decorative. A nonempty `alt` MUST
  be nonblank. Readers MUST expose `alt` as the image's text alternative, and
  MUST hide decorative images from assistive technology.
- **OWM-IMG-003.** `credit`, when present, is nonblank plain text of at most 500
  code points. `credit_url` MUST NOT be present without `credit`. Readers
  SHOULD make the credit available wherever they show the image at full size.

> **Note (informative).** An image that conveys information needed to answer or
> learn is never decorative. Its `alt` should describe that information, not
> the file. Images that need attribution, such as those under a Creative
> Commons Attribution license, should be image objects with `credit`, not
> Markdown images.

### 9.3 Markdown profile

Text members use a restricted profile of CommonMark 0.31.2 [COMMONMARK] with
the table extension of GitHub Flavored Markdown [GFM].

- **OWM-MD-001.** Text MUST be interpreted as CommonMark 0.31.2, with the GFM
  table extension (GFM, section 4.10) as the only extension. Other GFM
  extensions are not part of the profile. Strikethrough, task list items,
  extended autolinks, and footnotes are therefore either not recognized as
  syntax, or rendered literally as CommonMark would render them.
- **OWM-MD-002.** Text MAY use these constructs:
  - paragraphs;
  - thematic breaks;
  - block quotes;
  - bullet and ordered lists;
  - indented and fenced code blocks;
  - tables;
  - emphasis and strong emphasis;
  - code spans;
  - hard and soft line breaks;
  - backslash escapes;
  - entity and numeric character references;
  - links and link reference definitions, subject to section 9.5;
  - autolinks, subject to section 9.5;
  - images, subject to section 9.6.

  Headings are permitted only in the collection `description` (section 9.4).

- **OWM-MD-003.** Text MUST NOT contain raw HTML, either as an HTML block or as
  inline HTML, as defined by CommonMark.
- **OWM-MD-004.** Readers MUST NOT interpret any part of the text as HTML, script,
  style, or other active content. Whatever a reader displays, it MUST display
  as inert text.
- **OWM-MD-005.** Readers MUST render code spans and code blocks literally,
  preserving their characters and the line structure of code blocks. Readers
  MAY apply syntax highlighting based on a fenced code block's info string,
  and MUST NOT give the info string any other effect.
- **OWM-MD-006.** Block quotes and lists MUST NOT be nested more than 8 levels
  deep.
- **OWM-MD-007.** Outside the collection `description`, text MUST NOT contain
  headings. That includes ATX headings (`#`) and setext headings (text
  underlined with `=` or `-`).

> **Note (informative).** Educational content legitimately includes shell
> commands, HTML, and attack strings, such as an XSS payload in a security
> course. Write them inside code spans or code blocks, where they are text.
> Executable-looking text in a code block is not evidence of malicious intent.
> A literal `<` outside code can also be written as `\<` or `&lt;`.

> **Note (informative).** A line of `---` directly under a paragraph turns that
> paragraph into a setext heading. To get a thematic break, leave a blank line
> before it.

### 9.4 Collection description

- **OWM-MD-008.** `description` follows the Markdown profile, and MAY also contain
  ATX and setext headings of levels 1 to 3. Readers SHOULD render description
  headings below the reader's own heading level for the page that shows them.
  `description` MUST be at most 65,536 bytes in UTF-8.

### 9.5 Links and URLs

This section applies to link destinations, autolinks, and every `url` and
`credit_url` member.

- **OWM-LINK-001.** Every URL MUST be an absolute URI [RFC3986] with the scheme
  `https`, a nonempty host, no user information (nothing of the form
  `user@` before the host), and at most 2,048 characters. Relative references
  and every other scheme are prohibited. That includes `http`, `mailto`,
  `javascript`, `data`, and `file`.
- **OWM-LINK-002.** Readers MUST NOT fetch, prefetch, or preview any URL in a
  bundle automatically. A link is followed only when the learner explicitly
  activates it.
- **OWM-LINK-003.** Readers SHOULD show a link's destination host before or when
  the learner activates the link. They SHOULD open links outside the reader's
  own context, such as in a separate browser tab or window.

### 9.6 Images in Markdown

- **OWM-MD-009.** An image in Markdown MUST have a destination that is an asset
  path (section 10.1), naming an asset present in the bundle. Readers MUST
  resolve it only within the bundle.
- **OWM-MD-010.** The image description, the alt text between `[` and `]`, is the
  text alternative. An empty description declares the image decorative.
  Readers MUST NOT require a pointer hover to show an image's title.

---

## 10. Images and other assets

### 10.1 Asset paths

- **OWM-IMG-004.** An asset path MUST have the form `assets/<segment>` or
  `assets/<segment>/.../<segment>`. It MUST have at most 8 segments after
  `assets/`, and at most 255 bytes in total. Each segment MUST match
  `^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$`, so a segment cannot begin with a dot.
- **OWM-IMG-005.** References to assets MUST match the entry name exactly,
  including case. Section 3.3 already prohibits entry names that differ only by
  case.

### 10.2 Permitted formats

- **OWM-IMG-006.** Every asset MUST be a still image in one of these formats:
  - PNG [PNG], file extension `.png`;
  - JPEG with JFIF or Exif [JPEG], file extension `.jpg` or `.jpeg`;
  - WebP [RFC9649], lossy or lossless, file extension `.webp`.

  The extension MUST be lowercase.

- **OWM-IMG-007.** An asset's format MUST be determined from its content, by its
  signature, and MUST agree with its extension.
- **OWM-IMG-008.** Animated images are prohibited. These count as animated:
  - a PNG containing an `acTL` chunk;
  - a WebP file with the animation flag set in its `VP8X` chunk, or containing
    an `ANIM` or `ANMF` chunk.
- **OWM-IMG-009.** Every asset MUST decode successfully as its format, in full.
  Readers MUST verify this before marking a bundle ready to use.

Fonts, vector images (including SVG), audio, video, documents, scripts,
archives, and executables are not permitted assets in this version.

### 10.3 Dimensions and metadata

- **OWM-IMG-010.** An image's width and height MUST each be at most 8,192 pixels,
  and their product MUST be at most 25,000,000 pixels. Readers MUST check the
  dimensions declared in the image header before decoding it.
- **OWM-IMG-011.** Producers SHOULD store images in their intended display
  orientation, and SHOULD omit an Exif orientation tag or set it to 1. Readers
  SHOULD apply an Exif orientation tag that is present.

> **Note (informative).** Photographs often carry Exif metadata, including GPS
> location. Producers should remove metadata that the image does not need
> (section 14).

### 10.4 Referenced and unreferenced assets

- **OWM-IMG-012.** Every asset path referenced by an image object or a Markdown
  image MUST name an asset present in the bundle. An asset that nothing
  references is permitted. Validators SHOULD report it as a warning, and
  readers MAY decline to store it.

---

## 11. Resource limits

These limits apply to bundles. They let any reader process any conforming bundle
with predictable resources.

| Quantity                                                                                     | Limit                       |
| -------------------------------------------------------------------------------------------- | --------------------------- |
| Archive size                                                                                 | 104,857,600 bytes (100 MiB) |
| Number of entries, including directories and ignorable entries                               | 2,000                       |
| Total uncompressed size of all entries                                                       | 268,435,456 bytes (256 MiB) |
| Uncompressed size of `study.yaml`, or size of a text bundle                                  | 8,388,608 bytes (8 MiB)     |
| Uncompressed size of any one asset                                                           | 10,485,760 bytes (10 MiB)   |
| Ratio of uncompressed to compressed size, for an entry whose uncompressed size exceeds 1 MiB | 100                         |
| Nesting depth of the YAML data model, where the root mapping is depth 1                      | 32                          |
| Number of nodes in the YAML data model (every mapping, sequence, and scalar)                 | 1,000,000                   |
| Items (questions plus flashcards)                                                            | 10,000                      |
| Image width, or image height                                                                 | 8,192 pixels                |
| Image area (width × height)                                                                  | 25,000,000 pixels           |

Per-field limits appear with each field: lengths, list sizes, and the 64 KiB
limit on text.

- **OWM-LIM-001.** A bundle MUST NOT exceed any limit in this section or in the
  definition of any member.
- **OWM-LIM-002.** Readers and validators MUST enforce these limits while
  processing, not after it. In particular:
  - they MUST stop decompressing an entry as soon as its output exceeds the
    entry's recorded size, the per-entry limit, or the remaining total;
  - they MUST NOT allocate memory for an image until its declared dimensions
    have passed OWM-IMG-010.
- **OWM-LIM-003.** A reader MUST NOT reject a conforming bundle for exceeding any
  limit lower than those in this section. A reader MAY still fail to import a
  bundle for environmental reasons, such as insufficient storage. When it does,
  it MUST report that the failure is environmental, not a conformance
  problem.
- **OWM-LIM-004.** Readers SHOULD also bound the time they spend processing a
  bundle, and SHOULD let the learner cancel an import.

---

## 12. Identity across versions

### 12.1 What identifiers mean

A bundle's `id` is a claim that the bundle is a version of a particular
collection. An item's `id` is a claim that the item is the same learning item
as the item with that `id` in other versions of the collection.

- **OWM-UPD-001.** Producers MUST keep an item's `id` when they correct or
  improve the same item. They MUST give a new `id` to an item that tests a
  different concept, even if it replaces an old item in the same place. The
  same applies to choice identifiers within a question.
- **OWM-UPD-002.** Identifiers are unauthenticated. Anyone can copy an `id`. A
  reader MUST NOT allow a bundle to replace, modify, or delete another
  collection's content or a learner's data because their identifiers match.
  Any such change requires an explicit decision by the learner, or a separate
  trust mechanism outside this specification.

### 12.2 Material changes

A material change is one that may affect whether a learner's earlier
understanding still holds.

- **OWM-UPD-003.** Between two versions of the same collection, an item has
  **changed materially** if either of the following is true:
  1. its `revision` increased;
  2. any of these differs: `type`, `selection`, the set of choice identifiers,
     the set of `correct_answers`, or `selection_count`.

  Any other difference in the item is an **edit**.

- **OWM-UPD-004.** Producers MUST increase an item's `revision` when they change
  its meaning in a way that OWM-UPD-003 would not otherwise detect. One example
  is changing what a correct choice's text claims. Producers SHOULD NOT
  increase it for wording or formatting changes.

> **Note (informative).** This specification defines the classification only.
> What a reader does about a material change is the reader's decision. It might
> draw the learner's attention to the item, or keep earlier results attached to
> the version they were earned on.

### 12.3 Content fingerprint

A content fingerprint lets readers and catalogs recognize identical content,
even if the archive was repacked.

- **OWM-UPD-005.** Computing a fingerprint is OPTIONAL. An implementation that
  computes one MUST use this algorithm, so that results agree across
  implementations. The content fingerprint of a bundle is the lowercase
  hexadecimal SHA-256 [FIPS180-4] digest of the following UTF-8 byte sequence:
  1. the string `openwaymark-fingerprint-v1`, followed by a line feed;
  2. the manifest data model (section 4.3), serialized with the JSON
     Canonicalization Scheme [RFC8785], followed by a line feed;
  3. for each asset, in ascending byte order of path: the path, a tab, the
     lowercase hexadecimal SHA-256 digest of the asset's uncompressed bytes,
     and a line feed.

  Ignorable entries and directory entries are excluded.

- **OWM-UPD-006.** Equal fingerprints mean equal content. A fingerprint MUST NOT
  be treated as proof of origin or authorization.

---

## 13. Security considerations

Every bundle is untrusted input, whatever its source. That includes bundles
from an official catalog and bundles restored from a backup.

- **OWM-SEC-001.** Readers MUST process every bundle with the same checks,
  whatever its source.
- **OWM-SEC-002.** Readers MUST NOT execute, evaluate, or load as code any part
  of a bundle, and MUST NOT extract bundle files to locations where the
  operating system or another program might execute or interpret them.
- **OWM-SEC-003.** Readers MUST import a bundle atomically. Either the complete,
  validated bundle becomes available, or nothing changes. A failed or canceled
  import MUST leave existing collections and learner data unchanged.
- **OWM-SEC-004.** Readers MUST keep each collection's content isolated. That
  means separate from other collections, and separate from the reader's
  configuration, code, credentials, and storage keys. Bundle content, including
  identifiers and paths, MUST NOT be able to name or address storage outside
  its own collection.
- **OWM-SEC-005.** A reader MUST NOT cause any network request as a result of
  bundle content, except when the learner explicitly activates a link
  (OWM-LINK-002).
- **OWM-SEC-006.** Validators and readers MUST NOT describe a bundle as safe,
  harmless, or free of malware because it is conforming or passed any checks.

The following threats are addressed by this specification. This section is
informative.

| Threat                                                                                | Mitigation                                                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Path traversal ("zip slip") and absolute paths                                        | ASCII-only names; no `..`, leading `/`, or backslashes (OWM-PATH-001); readers never extract to the file system as named |
| Symbolic links and special files                                                      | Prohibited (OWM-PKG-009)                                                                                                 |
| Ambiguous archives (local/central mismatch, hidden or prepended data, polyglot files) | Strict structure (OWM-PKG-006, OWM-PKG-007)                                                                              |
| Duplicate or case-colliding names                                                     | Prohibited (OWM-PATH-002)                                                                                                |
| Decompression bombs                                                                   | Size, entry, and ratio limits, enforced while streaming (section 11)                                                     |
| Image decoding bombs                                                                  | Pixel limits checked before decoding (OWM-IMG-010)                                                                       |
| Malformed or disguised images                                                         | Signature checks and full decode (OWM-IMG-007, OWM-IMG-009)                                                              |
| YAML alias expansion ("billion laughs"), custom tags, object construction             | No anchors, aliases, or tags (OWM-YAML-002)                                                                              |
| Excessive nesting or size                                                             | Depth, node, and size limits (section 11)                                                                                |
| Script injection through text                                                         | No raw HTML; inert rendering (OWM-MD-003, OWM-MD-004)                                                                    |
| Tracking and remote content                                                           | No automatic fetching; `https` links only on activation (section 9.5)                                                    |
| Dangerous URL schemes                                                                 | `https` only (OWM-LINK-001)                                                                                              |
| Identity hijacking                                                                    | Identifiers grant no authority (OWM-UPD-002)                                                                             |
| Misleading text direction (bidirectional controls)                                    | Lint warning (OWM-LINT-011)                                                                                              |

> **Note (informative).** Conforming bundles can still contain wrong, offensive,
> or misleading content. Structural validation does not establish that content
> is accurate. A future signature mechanism could establish who published a
> bundle and that it has not been altered. It still would not establish that
> the bundle is harmless.

---

## 14. Privacy considerations

- **OWM-PRIV-001.** Readers MUST NOT transmit a bundle, or any part of its
  content, off the device without an explicit action by the learner. This
  includes sending it to a malware scanner or a validation service.
- **OWM-PRIV-002.** Validators that run locally MUST be able to work without a
  network connection. A validator that offers a remote check, such as an
  external malware scan, MUST NOT use it without the user's explicit consent.

> **Note (informative).** Author names and URLs in a bundle are published along
> with it. Image metadata can reveal where and when a photograph was taken.
> Because readers never fetch remote content, opening a bundle reveals nothing
> to its author.

---

## 15. Validators

- **OWM-VAL-001.** A validator MUST report every error it finds. Each diagnostic
  MUST include:
  - the identifier of the rule concerned;
  - a severity: error or warning;
  - a human-readable message;
  - a location, whenever one exists. A location is the archive entry name,
    plus, inside the manifest, a JSON Pointer [RFC6901] into the data model.
    It SHOULD also include line and column numbers.
- **OWM-VAL-002.** A validator MUST state whether the bundle is conforming. It is
  conforming if and only if no errors were found and every required check was
  performed.
- **OWM-VAL-003.** A validator MUST report which checks it performed, and which
  it did not perform or could not complete, together with the reason. One
  example is image decoding skipped on a platform without a decoder. A
  validator that skips a required check MUST NOT report the bundle as
  conforming.
- **OWM-VAL-004.** A validator that offers malware scanning MUST report whether a
  scan was performed, with which engine, and with what result. When a
  requested scan cannot be performed, it MUST say so, and MUST NOT report a
  clean result. A clean scan MUST be reported as "no threats detected by
  <engine>", never as "safe" or "malware-free".
- **OWM-VAL-005.** Validators MAY report warnings for the lint checks in
  Appendix A, and for others of their own. Warnings MUST NOT affect
  conformance.

This draft does not define a serialization for validator reports (Appendix C,
issue 4).

---

## 16. References

### 16.1 Normative references

- **[APPNOTE]** PKWARE Inc., "APPNOTE.TXT - .ZIP File Format Specification",
  version 6.3.10, 2022.
- **[BCP47]** Phillips, A. and M. Davis, "Tags for Identifying Languages",
  BCP 47, RFC 5646, 2009.
- **[COMMONMARK]** MacFarlane, J., "CommonMark Spec", version 0.31.2, 2024.
  <https://spec.commonmark.org/0.31.2/>
- **[FIPS180-4]** NIST, "Secure Hash Standard (SHS)", FIPS PUB 180-4, 2015.
- **[GFM]** GitHub, "GitHub Flavored Markdown Spec", version 0.29-gfm, 2019,
  section 4.10 (Tables). <https://github.github.com/gfm/>
- **[JPEG]** ITU-T Recommendation T.81, "Digital compression and coding of
  continuous-tone still images", 1992; and ITU-T T.871, "JPEG File Interchange
  Format", 2011.
- **[PNG]** W3C, "Portable Network Graphics (PNG) Specification (Third
  Edition)", 2025.
- **[RFC2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement
  Levels", BCP 14, RFC 2119, 1997.
- **[RFC2606]** Eastlake, D. and A. Panitz, "Reserved Top Level DNS Names",
  BCP 32, RFC 2606, 1999.
- **[RFC3339]** Klyne, G. and C. Newman, "Date and Time on the Internet:
  Timestamps", RFC 3339, 2002.
- **[RFC3629]** Yergeau, F., "UTF-8, a transformation format of ISO 10646",
  RFC 3629, 2003.
- **[RFC3986]** Berners-Lee, T., Fielding, R., and L. Masinter, "Uniform Resource
  Identifier (URI): Generic Syntax", RFC 3986, 2005.
- **[RFC6901]** Bryan, P., Zyp, K., and M. Nottingham, "JavaScript Object
  Notation (JSON) Pointer", RFC 6901, 2013.
- **[RFC8174]** Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key
  Words", BCP 14, RFC 8174, 2017.
- **[RFC8785]** Rundgren, A., Jordan, B., and S. Erdtman, "JSON Canonicalization
  Scheme (JCS)", RFC 8785, 2020.
- **[RFC9562]** Davis, K., Peabody, B., and P. Leach, "Universally Unique
  IDentifiers (UUIDs)", RFC 9562, 2024.
- **[RFC9649]** Zern, J., Massimino, P., and J. Alakuijala, "WebP Image Format",
  RFC 9649, 2024.
- **[SEMVER]** Preston-Werner, T., "Semantic Versioning 2.0.0".
  <https://semver.org/spec/v2.0.0.html>
- **[SPDX]** The Linux Foundation, "SPDX Specification", version 2.3, Annex D
  (SPDX License Expressions). <https://spdx.github.io/spdx-spec/v2.3/>
- **[YAML]** Ben-Kiki, O., Evans, C., and I. döt Net, "YAML Ain't Markup
  Language (YAML) Version 1.2", revision 1.2.2, 2021.
  <https://yaml.org/spec/1.2.2/>

### 16.2 Informative references

- **[OWASP-FILE]** OWASP, "File Upload Cheat Sheet".
- **[OWASP-XSS]** OWASP, "Cross Site Scripting Prevention Cheat Sheet".
- **[JSONSCHEMA]** "JSON Schema: A Media Type for Describing JSON Documents",
  draft 2020-12. The schema for this draft is
  `schema/openwaymark-0.1.schema.json`. It expresses the structure of the
  manifest but not every rule. Cross-references, uniqueness, archive rules,
  Markdown rules, and assets require the checks described in this document.

---

## Appendix A: Recommended lint checks

_Informative._ Lint checks find likely problems in conforming bundles. Validators
report them as warnings (OWM-VAL-005). Each check has a stable identifier.

| Identifier   | Check                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OWM-LINT-001 | A question has no `explanation`, and none of its choices has one                                                                                                               |
| OWM-LINT-002 | An informative image has weak `alt` text: it repeats the file name, or is a single generic word such as "image" or "diagram"                                                   |
| OWM-LINT-003 | Two choices in one question have the same text                                                                                                                                 |
| OWM-LINT-004 | A question allows shuffling, but a choice refers to other choices or to positions ("all of the above", "none of the above", "both A and B")                                    |
| OWM-LINT-005 | An asset is not referenced (OWM-IMG-012)                                                                                                                                       |
| OWM-LINT-006 | A `multiple` question has every choice correct                                                                                                                                 |
| OWM-LINT-007 | A question has more than 8 choices                                                                                                                                             |
| OWM-LINT-008 | A prompt or choice image has empty `alt`, so it is marked decorative                                                                                                           |
| OWM-LINT-009 | `updated` is earlier than `created`                                                                                                                                            |
| OWM-LINT-010 | The bundle has no `license`                                                                                                                                                    |
| OWM-LINT-011 | Text contains bidirectional control characters (`U+202A`–`U+202E`, `U+2066`–`U+2069`)                                                                                          |
| OWM-LINT-012 | A plain (unquoted) scalar would resolve differently under YAML 1.1: `y`, `n`, `yes`, `no`, `on`, `off` in any case, dates, sexagesimal numbers, or numbers with a leading zero |
| OWM-LINT-013 | An image carries Exif GPS data                                                                                                                                                 |
| OWM-LINT-014 | An image's Exif orientation tag is not 1                                                                                                                                       |
| OWM-LINT-015 | A `multiple` question has exactly one correct answer and no `selection_count` (legitimate, but often unintended)                                                               |
| OWM-LINT-016 | The bundle contains ignorable entries (OWM-PATH-005)                                                                                                                           |
| OWM-LINT-017 | A text appears to contain a paragraph accidentally turned into a setext heading (in `description`)                                                                             |
| OWM-LINT-018 | A language subtag is not registered (OWM-COL-008)                                                                                                                              |

---

## Appendix B: Example manifest

_Informative._ A small but complete manifest for an archive bundle. The
`examples/` directory of the repository contains complete bundles with their
images.

```yaml
format_version: "0.1"
id: 6d5a39e7-9461-4c21-a736-f7b014b05783
title: Networking Fundamentals
version: 1.0.0
language: en
description: |
  Practice questions and cards for **networking basics**.

  ![A resolver asking a name server for an address](assets/dns-lookup.png)
tags: [networking, dns]
authors:
  - name: Example Author
license:
  spdx: Apache-2.0
created: "2026-10-18"
updated: "2026-10-18"
practice_defaults:
  passing_percentage: 75

questions:
  - id: dns-record-001
    type: multiple_choice
    selection: single
    prompt:
      text: Which record maps a hostname to an IPv4 address?
    choices:
      - id: record-a
        text: A
      - id: record-aaaa
        text: AAAA
        explanation:
          text: AAAA records map hostnames to IPv6 addresses.
      - id: record-cname
        text: CNAME
    correct_answers: [record-a]
    hint:
      text: Consider the address family in the question.
    explanation:
      text: An **A** record associates a hostname with an IPv4 address.
    tags: [dns, record-types]

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
      - id: record-txt
        text: TXT
    correct_answers: [record-a, record-aaaa]

flashcards:
  - id: dns-card-001
    front:
      text: What does an AAAA record contain?
    back:
      text: An IPv6 address associated with a hostname.
```

---

## Appendix C: Open issues in this draft

_Informative._ These questions are deliberately unresolved in draft 0.1.

1. **Media type.** No media type is registered or defined yet.
2. **Tags beyond ASCII.** Tags are lowercase ASCII slugs, which suits English
   but not every language. A later draft may allow Unicode tags with a defined
   comparison rule.
3. **Compatibility within a 1.x major version.** How a reader treats a bundle
   with a newer minor version, and unknown members within it, is defined only
   once version 1.0 approaches.
4. **Validator report serialization.** A common JSON format for diagnostics
   would let tools interoperate. It is not yet defined.
5. **Mathematical notation.** Not supported in this version. It is a candidate
   for the first required feature (section 5.3).
6. **Other question types**, such as image hotspots for labeling diagrams. They
   would be added through required features or new versions.
7. **ZIP64 and packing tools.** The prohibition on ZIP64 (OWM-PKG-003) needs
   testing against common archivers, some of which may emit ZIP64 records for
   small files in streaming modes.
8. **Signatures.** No mechanism for verifying who published a bundle is
   defined.
