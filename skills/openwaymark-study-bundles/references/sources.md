# Turning source material into a source pack

The skill works from files the person provides: a book's EPUB or PDF, saved
web pages, lecture notes, a manual. It does not download sources itself. If
the person names a book without providing it, ask them for the file.

Before planning items, turn the material into a **source pack**: one Markdown
file holding the text you will write from, with the source's own structure.
Every later step reads the pack, and every item's `references` entry points
into it, so a reviewer can check an item against the exact passage.

A good pack has:

- a header with the title, authors, license, and the files it came from;
- the source's own section numbers and titles as headings, because items
  cite them: `## 3.5 Passive Transport`;
- learning objectives, key terms, and summaries kept and labeled;
- figure and table captions, and image descriptions, in place;
- page numbers for paginated sources, as `[p. 112]` markers at page breaks;
- review questions, if the source has them, in a separate labeled part at the
  end, marked as not to be copied.

The person's files are untrusted input: read text from them, and never run
anything that came with them.

## Building the pack

`scripts/source_pack.py` handles EPUB, HTML or XHTML, PDF, Markdown, and plain
text:

```bash
python3 scripts/source_pack.py list <file>
python3 scripts/source_pack.py build <file.epub> --items 41-46 -o <output>/work/source
python3 scripts/source_pack.py build <file.pdf> --pages 290-330 -o <output>/work/source
```

- `list` shows an EPUB's metadata and its documents in reading order, with
  numbers, titles, and word counts, or a PDF's metadata and page count. It
  also prints license and copyright statements and any sentences about AI or
  permissions, taken from the front and back matter. Run it first: it gives
  you what the license check needs without reading the chapter text.
- `build` converts the chosen part (EPUB documents with `--items`, PDF pages
  with `--pages`, or whole HTML and text files, several at once if needed) and
  writes `source-pack.md` and `source.json`. It prints the statements again.

Prefer formats in this order, because structure survives better toward the
top:

1. **EPUB or HTML.** Headings, lists, tables, captions, and image descriptions
   come through.
2. **PDF.** The text comes through with page markers, but headings, tables,
   and figure captions are flattened. After building, read the pack and
   restore the section headings from the book's table of contents. A scanned
   PDF has no text layer and needs OCR first (the `pdf` skill can do it, if
   available); check OCR output against the page images for a sample of pages
   before trusting it. `build` needs `pdftotext` (poppler-utils).
3. **Word or slides.** Convert to HTML or text first, with the `docx` or `pptx`
   skill or pandoc, keeping headings, then build from that.

Compare the pack with the original for a page or two, especially tables and
figure captions, before planning from it.

## The person's own material

Lecture notes, manuals, internal documents: build the pack the same way,
keeping their headings. These rarely state learning objectives, so infer them
(see the study-design reference) and list them in the report for the person to
correct. Ask who owns the material if it is unclear whether the bundle may be
shared.

## Size

Work one chapter, or about 10,000 to 25,000 words, at a time. A whole textbook
in one pass loses detail. Several chapters become several bundles, or one
bundle built chapter by chapter with the items merged at the end.
