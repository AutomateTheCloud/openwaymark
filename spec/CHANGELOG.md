# OpenWaymark specification change log

Every change to the format is recorded here, including changes between drafts.
Once a format version is released, its meaning never changes. Corrections go
into a new version.

## Draft 0.1 — 2026-10-18 (in review)

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
