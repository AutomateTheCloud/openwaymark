# Copyright 2026 Automate the Cloud Inc.
# SPDX-License-Identifier: Apache-2.0
"""Turns local source files into a source pack: one Markdown file to write from.

    python3 source_pack.py list <file>
    python3 source_pack.py build <file>... -o <dir> [--items 3-7] [--pages 12-40]

Inputs are files the person provides: EPUB, HTML or XHTML, PDF, Markdown, or
plain text. Nothing is fetched from the network.

`list` describes a file without converting it: an EPUB's metadata and its
documents in reading order (numbered, with titles and word counts), or a
PDF's metadata and page count. Use it to choose what to build from.

`build` converts the inputs, in the order given, and writes
<dir>/source-pack.md and <dir>/source.json. `--items` picks EPUB documents by
the numbers `list` shows; `--pages` picks PDF pages. HTML keeps its headings,
lists, tables, figure captions, and image descriptions; PDF text is extracted
with pdftotext (poppler), with a [PDF p. N] marker at each page; with
--page-offset, the markers give the printed page number too.

Both commands also print sentences that look like license or copyright
statements, and sentences about AI or permissions, from the whole file. They
feed the license check; they are not a substitute for reading the source's
copyright page.

Inputs are untrusted. EPUB archives are read in memory with size limits, HTML
is parsed with the standard library's parser, and only text is kept. Standard
library only, plus pdftotext for PDFs; Python 3.10+.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import json
import posixpath
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser
from pathlib import Path

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
SKIP = {"script", "style", "noscript", "svg", "button", "form", "nav", "head"}
BOX_LABELS = {
    "learning-objectives": "Learning objectives",
    "key-takeaways": "Key takeaways",
    "summary": "Summary",
    "exercises": "Exercises",
    "examples": "Examples",
}
LICENSE_PATTERN = re.compile(
    r"\b(licen[cs]ed?|copyright|all rights reserved|public domain|CC[ -]BY|CC0|adapted from|derived from|remix\w*)\b|©",
    re.I,
)
# "AI" alone is too common (it also abbreviates "Adequate Intake"), so it
# counts only next to words that make it mean artificial intelligence.
TERMS_PATTERN = re.compile(
    r"artificial intelligence|language models?|machine learning|\bgenerative\b|text and data mining|"
    r"\bAI\b (?:systems?|tools?|models?|training|offerings?|products?|services?)|"
    r"\b(?:train|training|generative|ingest\w*) (?:\w+ ){0,3}AI\b|\bpermission\b",
    re.I,
)
# Credit lines under images name their own licenses; they are not the
# source's license, so they are left out of the statements.
IMAGE_CREDIT = re.compile(
    r"\b(image|photo|figure|illustration|graphic)s? (\d|by|courtesy|credit)|\breused\b|"
    r"(?<!/)/ ?(CC|Public Domain|Pixabay|Unsplash)",
    re.I,
)
# Machine-readable requests not to use content for AI, in HTML <meta> tags:
# robots "noai"/"noimageai", and the TDM Reservation Protocol.
OPT_OUT_META = re.compile(r"<meta\b[^>]*>", re.I)
# Where books state their license and terms: front and back matter.
FRONT_MATTER = re.compile(
    r"copyright|licen[cs]e|legal|colophon|title|about|preface|acknowledg|front|imprint|terms|rights", re.I
)
PDF_FRONT_PAGES = 15
PDF_BACK_PAGES = 5
SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z\u201c\"(])")
SUBSCRIPT = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")
SUPERSCRIPT = str.maketrans("0123456789+-=()", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾")

# Limits for reading an EPUB, which is a ZIP archive from an unknown source.
EPUB_MAX_MEMBERS = 5_000
EPUB_MAX_MEMBER_BYTES = 50 * 1024 * 1024
EPUB_MAX_TOTAL_BYTES = 300 * 1024 * 1024


# --- HTML to Markdown -------------------------------------------------------


class Node:
    def __init__(self, tag: str, attrs: dict[str, str]) -> None:
        self.tag = tag
        self.attrs = attrs
        self.children: list[Node | str] = []

    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())


class TreeBuilder(HTMLParser):
    """Builds a small element tree, tolerating unclosed tags."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {})
        self.stack = [self.root]
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {k: v or "" for k, v in attrs})
        self.stack[-1].children.append(node)
        if tag == "title":
            self._in_title = True
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        self.stack[-1].children.append(data)


def parse(markup: str) -> TreeBuilder:
    builder = TreeBuilder()
    builder.feed(markup)
    builder.close()
    return builder


def walk(node: Node, tag: str):
    for child in node.children:
        if isinstance(child, Node):
            if child.tag == tag:
                yield child
            yield from walk(child, tag)


def walk_all(node: Node):
    """Every element under node, in document order."""
    for child in node.children:
        if isinstance(child, Node):
            yield child
            yield from walk_all(child)


class Converter:
    """Renders HTML as Markdown, keeping what matters for study material."""

    def __init__(self) -> None:
        self.terms: dict[str, str] = {}
        self.definitions: dict[str, str] = {}
        self.exercises: list[str] = []
        self.footnotes: list[str] = []

    def inline(self, node: Node) -> str:
        return "".join(
            html.unescape(child) if isinstance(child, str) else self.inline_element(child)
            for child in node.children
        )

    def flat(self, node: Node) -> str:
        return " ".join(self.inline(node).split())

    def inline_element(self, node: Node) -> str:
        tag, classes = node.tag, node.classes()
        if tag in SKIP or tag == "template" or "screen-reader-text" in classes:
            return ""
        if tag == "a" and classes & {"footnote", "return-footnote", "noteref"}:
            return ""
        text = self.inline(node)
        if tag == "a" and "glossary-term" in classes:
            # A term linked to a definition elsewhere in the document.
            self.terms[node.attrs.get("href", "").lstrip("#")] = " ".join(text.split())
            return f"**{text.strip()}**"
        if tag in ("strong", "b", "dfn"):
            return f"**{text.strip()}**" if text.strip() else text
        if tag in ("em", "i"):
            return f"_{text.strip()}_" if text.strip() else text
        if tag == "sub":
            return text.translate(SUBSCRIPT) if re.fullmatch(r"[0-9+\-=()]+", text) else f"_({text})"
        if tag == "sup":
            return text.translate(SUPERSCRIPT) if re.fullmatch(r"[0-9+\-=()]+", text) else f"^({text})"
        if tag == "br":
            return " "
        if tag == "img":
            return f" [Image: {' '.join(node.attrs.get('alt', '').split()) or 'no description'}] "
        return text

    def blocks(self, node: Node, depth: int) -> list[str]:
        lines: list[str] = []
        run: list[str] = []

        def flush() -> None:
            text = " ".join("".join(run).split())
            if text:
                lines.extend([text, ""])
            run.clear()

        for child in node.children:
            if isinstance(child, str):
                run.append(html.unescape(child))
            elif self.is_block(child):
                flush()
                lines.extend(self.block(child, depth))
            else:
                run.append(self.inline_element(child))
        flush()
        return lines

    @staticmethod
    def is_block(node: Node) -> bool:
        return node.tag in {
            "p", "div", "section", "article", "main", "body", "html", "figure", "table", "ul", "ol",
            "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "iframe", "template", "hr", "dl",
            "aside", "header", "footer", "pre",
        } or node.tag in SKIP

    def block(self, node: Node, depth: int) -> list[str]:
        tag, classes = node.tag, node.classes()
        if tag in SKIP or tag == "hr" or "screen-reader-text" in classes:
            return []
        if tag == "template":
            if node.attrs.get("id"):
                self.definitions[node.attrs["id"]] = self.flat(node)
            return []
        if classes & {"footnotes"} or node.attrs.get("epub:type") in ("footnotes", "endnotes"):
            self.footnotes += [f"- {self.flat(li)}" for li in walk(node, "li")]
            return []
        if "glossary" in classes:
            for child in walk(node, "template"):
                self.block(child, depth)
            return []
        if tag == "iframe" or any("iframe" in c for c in classes):
            title = node.attrs.get("title") or next((n.attrs.get("title", "") for n in walk(node, "iframe")), "")
            return [f"[Interactive content omitted: {title or 'untitled'}]", ""]
        if re.fullmatch(r"h[1-6]", tag):
            text = self.flat(node)
            level = min(6, depth + int(tag[1]) - 1)
            return [f"{'#' * level} {text}", ""] if text else []
        if tag in ("ul", "ol"):
            return self.list_lines(node, 0) + [""]
        if tag == "dl":
            return self.definition_list(node)
        if tag == "figure" or "wp-caption" in classes:
            return self.figure(node)
        if tag == "table":
            return self.table(node)
        if tag == "pre":
            return ["```", "".join(c if isinstance(c, str) else self.inline(c) for c in node.children), "```", ""]
        if tag == "blockquote":
            return [f"> {line}" if line else ">" for line in self.blocks(node, depth)] + [""]
        if "textbox" in classes or tag == "aside":
            kind = next((k for k in BOX_LABELS if k in classes), "")
            label = BOX_LABELS.get(kind, "Box")
            body = self.blocks(node, depth + 1)
            if kind == "exercises":
                self.exercises += [line for line in body if line] + [""]
                return []
            if not any(line and not line.startswith("#") for line in body):
                return []  # a box whose content (an interactive widget) did not survive
            return [f"> **[{label}]**", ">"] + [f"> {line}" if line else ">" for line in body] + [""]
        return self.blocks(node, depth)

    def list_lines(self, node: Node, indent: int) -> list[str]:
        lines = []
        items = [c for c in node.children if isinstance(c, Node) and c.tag == "li"]
        for index, item in enumerate(items):
            marker = f"{index + 1}." if node.tag == "ol" else "-"
            nested = [c for c in item.children if isinstance(c, Node) and c.tag in ("ul", "ol")]
            item.children = [c for c in item.children if c not in nested]
            lines.append(f"{'  ' * indent}{marker} {self.flat(item)}")
            for sub in nested:
                lines += self.list_lines(sub, indent + 1)
        return lines

    def definition_list(self, node: Node) -> list[str]:
        lines, term = [], ""
        for child in node.children:
            if isinstance(child, Node) and child.tag == "dt":
                term = self.flat(child)
            elif isinstance(child, Node) and child.tag == "dd":
                lines.append(f"- **{term}**: {self.flat(child)}" if term else f"- {self.flat(child)}")
        return lines + [""]

    def figure(self, node: Node) -> list[str]:
        caption = next((self.flat(n) for n in walk(node, "figcaption")), "") or next(
            (self.flat(n) for n in walk(node, "p") if "wp-caption-text" in n.classes()), ""
        )
        # Books usually number figures in their own text, so the pack does not
        # number them again.
        lines = [f"> **Figure:** {caption}".rstrip()]
        for image in walk(node, "img"):
            name = Path(image.attrs.get("src", "").split("?")[0]).name
            lines.append(f"> _Image ({name}):_ {' '.join(image.attrs.get('alt', '').split())}")
        return lines + [""]

    def table(self, node: Node) -> list[str]:
        caption = next((self.flat(n) for n in walk(node, "caption")), "")
        rows = [
            [self.flat(cell).replace("|", "/") for cell in row.children if isinstance(cell, Node) and cell.tag in ("td", "th")]
            for row in walk(node, "tr")
        ]
        rows = [row for row in rows if row]
        lines = [f"**Table:** {caption}".rstrip(), ""]
        if rows:
            width = max(len(row) for row in rows)
            rows = [row + [""] * (width - len(row)) for row in rows]
            lines.append("| " + " | ".join(rows[0]) + " |")
            lines.append("|" + " --- |" * width)
            lines += ["| " + " | ".join(row) + " |" for row in rows[1:]]
        return lines + [""]

    def document(self, markup: str, depth: int) -> tuple[str, list[str]]:
        """Converts one HTML document; returns its title and Markdown lines.
        Glossary definitions found in the document are listed after it."""
        built = parse(markup)
        lines = self.blocks(built.root, depth)
        terms = [
            f"- **{term}**: {self.definitions[key]}" for key, term in self.terms.items() if key in self.definitions
        ]
        if terms:
            lines += [f"{'#' * min(6, depth)} Key terms", ""] + terms + [""]
        self.terms.clear()
        self.definitions.clear()
        # The first nonempty heading names the document better than <title>,
        # which often repeats the book's title.
        headings = (self.flat(n) for n in walk_all(built.root) if re.fullmatch(r"h[1-3]", n.tag))
        title = next((h for h in headings if h), "") or " ".join(built.title.split())
        return title, lines


def opt_outs(markup: str, where: str) -> list[str]:
    """Machine-readable AI opt-outs in an HTML document's meta tags."""
    found = []
    for tag in OPT_OUT_META.findall(markup):
        lowered = tag.lower()
        if re.search(r"\bnoai\b|\bnoimageai\b", lowered) or (
            "tdm-reservation" in lowered and re.search(r"content=[\"']?1", lowered)
        ):
            found.append(f"Machine-readable AI opt-out in {where}: {' '.join(tag.split())}")
    return found


def plain(markup: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", markup)).split())


# --- EPUB -------------------------------------------------------------------


class Epub:
    """Reads an EPUB's metadata and documents in reading order, in memory."""

    def __init__(self, path: Path) -> None:
        self.zip = zipfile.ZipFile(path)
        members = self.zip.infolist()
        if len(members) > EPUB_MAX_MEMBERS:
            sys.exit(f"{path}: too many entries ({len(members)}) for an EPUB")
        if sum(m.file_size for m in members) > EPUB_MAX_TOTAL_BYTES:
            sys.exit(f"{path}: expands to more than {EPUB_MAX_TOTAL_BYTES} bytes")
        container = ET.fromstring(self.read("META-INF/container.xml"))
        rootfile = next(e for e in container.iter() if e.tag.endswith("rootfile")).get("full-path", "")
        self.base = posixpath.dirname(rootfile)
        opf = ET.fromstring(self.read(rootfile))
        meta = {}
        for element in opf.iter():
            name = element.tag.split("}")[-1]
            if element.tag.startswith("{http://purl.org/dc/elements/1.1/}") and (element.text or "").strip():
                meta.setdefault(name, []).append(" ".join(element.text.split()))
        self.metadata = meta
        manifest = {
            item.get("id"): item.get("href", "")
            for item in opf.iter()
            if item.tag.endswith("}item")
        }
        self.documents = [
            posixpath.normpath(posixpath.join(self.base, manifest[ref.get("idref")]))
            for ref in opf.iter()
            if ref.tag.endswith("}itemref") and ref.get("idref") in manifest
        ]

    def read(self, name: str) -> bytes:
        info = self.zip.getinfo(name)
        if info.file_size > EPUB_MAX_MEMBER_BYTES:
            sys.exit(f"EPUB entry {name} is too large ({info.file_size} bytes)")
        with self.zip.open(info) as handle:
            data = handle.read(EPUB_MAX_MEMBER_BYTES + 1)
        if len(data) > EPUB_MAX_MEMBER_BYTES:
            sys.exit(f"EPUB entry {name} expands beyond its recorded size")
        return data

    def text(self, name: str) -> str:
        return self.read(name).decode("utf-8", "replace")


# --- PDF --------------------------------------------------------------------


def pdf_pages(path: Path, first: int | None, last: int | None) -> list[str]:
    if not shutil.which("pdftotext"):
        sys.exit("PDF input needs pdftotext (poppler-utils). Install it, or convert the PDF another way.")
    command = ["pdftotext", "-enc", "UTF-8"]
    if first:
        command += ["-f", str(first)]
    if last:
        command += ["-l", str(last)]
    result = subprocess.run(command + [str(path), "-"], capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        sys.exit(f"pdftotext failed on {path}: {result.stderr.strip()}")
    pages = result.stdout.split("\f")
    if pages and not pages[-1].strip():
        pages.pop()  # pdftotext ends every page, the last one included, with a form feed
    return pages


def pdf_info(path: Path) -> dict[str, str]:
    if not shutil.which("pdfinfo"):
        return {}
    result = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, timeout=60)
    return dict(
        (key.strip(), value.strip())
        for key, _, value in (line.partition(":") for line in result.stdout.splitlines())
        if value.strip()
    )


# --- Commands ---------------------------------------------------------------


def span(value: str | None) -> tuple[int | None, int | None]:
    if not value:
        return None, None
    first, _, last = value.partition("-")
    return int(first), int(last or first)


def statements(text: str) -> tuple[list[str], list[str]]:
    """License-like and AI-or-permission sentences, deduplicated."""
    sentences = [" ".join(s.split()) for s in SENTENCE_END.split(text)]
    found = []
    for pattern in (LICENSE_PATTERN, TERMS_PATTERN):
        matches = []
        for sentence in sentences:
            hits = list(pattern.finditer(sentence))
            if not hits:
                continue
            if len(sentence) <= 400:
                pieces = [sentence]
            else:
                # A long run of text without sentence breaks (a list of
                # adapted sources, say): show an excerpt around each match.
                pieces = ["..." + sentence[max(0, m.start() - 150) : m.end() + 150] + "..." for m in hits]
            for piece in pieces:
                if pattern is LICENSE_PATTERN and IMAGE_CREDIT.search(piece):
                    continue
                matches.append(piece)
        found.append(list(dict.fromkeys(matches))[:25])
    return found[0], found[1]


def print_statements(licenses: list[str], terms: list[str]) -> None:
    print("\nLicense or copyright statements found:")
    print("\n".join(f"  - {s}" for s in licenses) or "  none found; check the copyright page by hand")
    print("\nSentences about AI or permissions:")
    print("\n".join(f"  - {s}" for s in terms) or "  none found")


def front_matter(path: Path) -> tuple[str, list[str]]:
    """The parts of a file where a license and terms are usually stated, and
    any machine-readable AI opt-outs anywhere in it."""
    kind = path.suffix.lower()
    if kind == ".epub":
        book = Epub(path)
        parts = [" ".join(book.metadata.get("rights", []))]
        flags: list[str] = []
        for number, name in enumerate(book.documents, start=1):
            markup = book.text(name)
            flags += opt_outs(markup, name)
            if number <= 3 or FRONT_MATTER.search(name) or FRONT_MATTER.search(" ".join(parse(markup).title.split())):
                parts.append(plain(markup))
        return "\n".join(parts), list(dict.fromkeys(flags))
    if kind == ".pdf":
        pages = pdf_pages(path, None, None)
        return "\n".join(pages[:PDF_FRONT_PAGES] + pages[-PDF_BACK_PAGES:]), []
    if kind in (".html", ".htm", ".xhtml"):
        markup = path.read_text(encoding="utf-8", errors="replace")
        return plain(markup), opt_outs(markup, path.name)
    return path.read_text(encoding="utf-8", errors="replace"), []


def scan(paths: list[Path], extra: str = "") -> tuple[list[str], list[str]]:
    texts, flags = [], []
    for path in paths:
        text, found = front_matter(path)
        texts.append(text)
        flags += found
    licenses, terms = statements("\n".join(texts + [extra]))
    return licenses, flags + terms


def list_file(path: Path) -> None:
    kind = path.suffix.lower()
    if kind == ".epub":
        book = Epub(path)
        for key in ("title", "creator", "publisher", "date", "rights", "language"):
            if key in book.metadata:
                print(f"{key}: {'; '.join(book.metadata[key])}")
        print()
        for number, name in enumerate(book.documents, start=1):
            markup = book.text(name)
            title, _ = Converter().document(markup, 3)
            print(f"{number:4}  {title or '(untitled)'}  [{name}, {len(plain(markup).split())} words]")
        print_statements(*scan([path]))
    elif kind == ".pdf":
        for key, value in pdf_info(path).items():
            if key in ("Title", "Author", "Subject", "Creator", "Producer", "CreationDate", "Pages"):
                print(f"{key}: {value}")
        print("\nPages that start like a chapter or part (PDF page numbers):")
        for number, text in enumerate(pdf_pages(path, None, None), start=1):
            head = " ".join(text.split()[:14])
            if re.match(r"(?i)(part|chapter|unit|module|section)\s+[\dIVXLC]+\b", head):
                print(f"  {number:5}  {head[:90]}")
        print(f"\nStatements below come from the first {PDF_FRONT_PAGES} and last {PDF_BACK_PAGES} pages.")
        print_statements(*scan([path]))
    elif kind in (".html", ".htm", ".xhtml"):
        markup = path.read_text(encoding="utf-8", errors="replace")
        title, lines = Converter().document(markup, 2)
        print(f"title: {title}")
        print("\n".join(line for line in lines if line.startswith("#")))
        print_statements(*scan([path]))
    else:
        text = path.read_text(encoding="utf-8", errors="replace")
        print(f"{len(text.split())} words")
        print_statements(*scan([path]))


def build(paths: list[Path], items: str | None, pages: str | None, page_offset: int, out: Path) -> None:
    converter = Converter()
    pack: list[str] = []
    inputs = []
    all_text: list[str] = []
    first_item, last_item = span(items)
    first_page, last_page = span(pages)
    for path in paths:
        kind = path.suffix.lower()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        record: dict = {"file": path.name, "sha256": digest}
        if kind == ".epub":
            book = Epub(path)
            record["metadata"] = book.metadata
            chosen = list(enumerate(book.documents, start=1))
            if first_item:
                chosen = [(n, d) for n, d in chosen if first_item <= n <= (last_item or first_item)]
            record["items"] = [n for n, _ in chosen]
            for _, name in chosen:
                markup = book.text(name)
                title, lines = converter.document(markup, 3)
                pack += [f"## {title or posixpath.basename(name)}", ""] + lines
                all_text.append(plain(markup))
        elif kind == ".pdf":
            record["metadata"] = pdf_info(path)
            texts = pdf_pages(path, first_page, last_page)
            start = first_page or 1
            record["pages"] = f"{start}-{start + len(texts) - 1}"
            pack += [f"## {path.name}", ""]
            for offset, text in enumerate(texts):
                number = start + offset
                label = f"PDF p. {number}" + (f", book p. {number - page_offset}" if page_offset else "")
                if text.strip():
                    pack += [f"[{label}]", "", text.rstrip(), ""]
            all_text += texts
        elif kind in (".html", ".htm", ".xhtml"):
            markup = path.read_text(encoding="utf-8", errors="replace")
            title, lines = converter.document(markup, 3)
            pack += [f"## {title or path.name}", ""] + lines
            all_text.append(plain(markup))
        else:
            text = path.read_text(encoding="utf-8", errors="replace")
            pack += [f"## {path.name}", "", text.strip(), ""]
            all_text.append(text)
        inputs.append(record)

    # Selected chapters rarely state the license, so scan each whole file's
    # front matter, plus the selected text.
    licenses, terms = scan(paths, "\n".join(all_text))
    header = [
        f"# Source pack: {', '.join(p.name for p in paths)}",
        "",
        f"Built {datetime.date.today().isoformat()} from local files. License and copyright",
        "statements found in the source (check them against its copyright page):",
        "",
    ]
    header += [f"- {s}" for s in licenses] or ["- none found"]
    header.append("")
    if any(line.strip() and not line.startswith("#") for line in converter.exercises):
        pack += ["## Exercises from the source", "", "Use these only to check coverage. Do not copy them.", ""]
        pack += converter.exercises
    if converter.footnotes:
        pack += ["## Notes and references from the source", ""] + converter.footnotes + [""]

    out.mkdir(parents=True, exist_ok=True)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(header + pack)).strip() + "\n"
    (out / "source-pack.md").write_text(text, encoding="utf-8")
    info = {
        "built": datetime.date.today().isoformat(),
        "inputs": inputs,
        "license_statements": licenses,
        "terms_statements": terms,
    }
    (out / "source.json").write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out / 'source-pack.md'} ({len(text.split())} words) and {out / 'source.json'}")
    print_statements(licenses, terms)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    list_cmd = commands.add_parser("list", help="describe a file without converting it")
    list_cmd.add_argument("file", type=Path)
    build_cmd = commands.add_parser("build", help="write a source pack from one or more files")
    build_cmd.add_argument("files", type=Path, nargs="+")
    build_cmd.add_argument("-o", "--output", type=Path, required=True)
    build_cmd.add_argument("--items", help="EPUB documents to include, by number from `list`, such as 3-7")
    build_cmd.add_argument("--pages", help="PDF pages to include, such as 12-40")
    build_cmd.add_argument(
        "--page-offset",
        type=int,
        default=0,
        help="PDF page minus printed page number, to label pages with both (such as 42)",
    )
    args = parser.parse_args()
    if args.command == "list":
        list_file(args.file)
    else:
        build(args.files, args.items, args.pages, args.page_offset, args.output)


if __name__ == "__main__":
    main()
