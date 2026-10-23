# OpenWaymark specification change log

Every change to the format is recorded here, including changes between drafts.
Once a format version is released, its meaning never changes. Corrections go
into a new version.

## Draft 0.2 — 2026-10-23 (working draft)

Draft 0.2 is draft 0.1 with answer variants added. Nothing else changes, and
every 0.1 bundle stays valid as a 0.1 bundle.

- **Added answer variants.** A choice may carry `variants`, up to 8 other
  wordings of the same answer, each with `text`, `image`, or both, and an
  optional `language` (section 7.3, OWM-Q-013 to OWM-Q-015). Each time readers
  present a question, they show every choice once in one of its wordings,
  chosen at random, and keep that wording through feedback (OWM-Q-016,
  OWM-Q-017). Grading is unchanged: it uses choice identifiers.
- `format_version` is `"0.2"` for this draft (OWM-VER-001). A reader of draft
  0.2 may also accept `"0.1"` bundles, checking them by these rules with the
  0.2 members treated as unknown (OWM-VER-008). Producers should keep writing
  `"0.1"` for bundles without variants (OWM-VER-009).
- OWM-UPD-004: changing what a variant claims is a change in meaning; adding or
  removing variants that make the same claim is not.
- Lint checks OWM-LINT-003 (same text twice) and OWM-LINT-004 (choices that
  refer to other choices) now cover variants.
- OWM-YAML-009 no longer names a format version.
- New schema: `schema/openwaymark-0.2.schema.json`. The 0.1 schema is
  unchanged.
- Appendix C, issue 12, now lists what remains open: distractor pools and
  variants of prompts and flashcards.

## Draft 0.1 — 2026-10-18 (in review)

**Revisions while drafting:**

- **Removed text bundles.** Every bundle is now a ZIP archive; a collection
  without images is an archive containing only `study.yaml` (section 3.1).
  OWM-PKG-001 now requires the archive form, and readers reject any other
  file. OWM-TEXT-001 and OWM-TEXT-002 are retired (Appendix D).
- Recorded the intended direction for private bundles: an encryption envelope
  using an open standard around an ordinary bundle (Appendix C, issue 10).
- Listed two new open issues: links to video from prompts and explanations
  (Appendix C, issue 11), and answer variants that readers draw from each time
  (issue 12). Neither changes the format in this draft.
- Reserved `signatures/` for a future, optional signature mechanism
  (section 3.8, OWM-SIG-001 to OWM-SIG-003). Readers ignore it, so signed bundles
  made later still open in readers built for this version.
- Added the optional integrity file, `integrity.json`, listing a SHA-256
  digest of every file (section 3.7, OWM-INT-001 to OWM-INT-005). Readers
  verify it when it is present. It is excluded from the content fingerprint.
  Lint check OWM-LINT-019 notes an archive without one.
- Added `language` on content objects and choices, for parts of a bundle in
  another language, such as the target language of a vocabulary card
  (OWM-CONT-003, OWM-CONT-004). Translations of a whole collection remain
  separate bundles (Appendix C, issue 9).
- Added OWM-YAML-011: the manifest must be well-formed YAML. This was implied,
  but no rule stated it.
- Added OWM-VER-007: required members must be present, with values of the
  stated types. This was expressed only by the tables.
- OWM-IMG-006 no longer requires JPEG files to carry a JFIF or Exif header.
  Many tools write valid JPEGs with neither.
- OWM-EXT-002 permits `org.example` namespaces in examples and tests.
- OWM-COL-016 (sequences are nonempty), size limits for `authors` and `spdx`,
  and the prohibition of user information in URLs, aligning the text with the
  schema.

First complete draft. It turns the design baseline's illustrative fields into
normative rules.

**New:**

- Conformance classes for bundles, producers, readers, and validators. Readers
  must reject nonconforming bundles, atomically.
- The archive profile: ZIP, stored or deflate only. No encryption, ZIP64, links,
  or hidden data. Local and central headers must agree, and names are ASCII
  without case collisions. Specific OS metadata files are tolerated and ignored.
- The text bundle form, a single YAML file without assets.
- The YAML profile: YAML 1.2 core schema and one document. No anchors, aliases,
  tags, directives, nulls, or floating-point numbers. Duplicate keys are
  rejected.
- Versioning: `format_version` "MAJOR.MINOR", with exact matching for 0.x
  drafts. Unknown members are errors. Must-understand features go in
  `requires`, and namespaced data in `extensions`.
- Collection metadata:
  - a canonical lowercase UUID `id`;
  - a SemVer `version` and a BCP 47 `language`;
  - `authors`, `sources`, and dates;
  - a structured `license` (`spdx`, `statement`, `url`);
  - `practice_defaults.passing_percentage`, an integer.
- Items:
  - questions and flashcards share one ID namespace, and choice IDs are scoped
    to their question;
  - multiple choice with `single` or `multiple` selection, and an optional
    `selection_count`;
  - `shuffle_choices`, hints, explanations, tags, references, and `revision`.
- Grading: exact set equality. No partial credit, and unanswered responses
  count in the total. A passing comparison uses integer arithmetic.
- Content objects: `text` before `image`. Image objects require `alt` (empty for
  decorative) and may carry `credit` and `credit_url`.
- The Markdown profile: CommonMark 0.31.2 plus GFM tables. No raw HTML. Headings
  only in `description`. `https` links only, opened on activation. Images only
  from the bundle.
- The image profile: still PNG, JPEG, and WebP, identified by signature and
  fully decoded. At most 8,192 pixels per side and 25 megapixels.
- Resource limits, enforced while processing.
- Identity across versions: unauthenticated identifiers, the definition of a
  material change, and an optional content fingerprint (SHA-256 over JCS).
- Security and privacy considerations, validator reporting requirements, and
  recommended lint checks.

**Changed from the design baseline's illustrative fields:**

- `question` (the prompt) is renamed `prompt`.
- Choice content is written inline on the choice (`text`, `image`), and a
  choice's explanation is a content object.
- `license` is a mapping, not a string.
