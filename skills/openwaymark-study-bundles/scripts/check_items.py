# Copyright 2026 Automate the Cloud Inc.
# SPDX-License-Identifier: Apache-2.0
"""Reports item-writing problems that a format validator cannot see.

The OpenWaymark validator checks that a bundle is well-formed. This script
looks at the items as a test writer would: where the correct answers sit,
whether the correct choice gives itself away by its length, missing
explanations and references, near-duplicate items, and flashcards that try
to hold too much.

    python3 check_items.py path/to/study.yaml

It prints a Markdown report. Exit status is 1 when there are warnings, so a
loop can run it until clean; notes alone exit 0. Requires PyYAML.
"""

from __future__ import annotations

import difflib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("check_items.py needs PyYAML: python3 -m pip install pyyaml")

POSITIONAL_ID = re.compile(r"^(q|question|item|card|choice|option|answer|ans)[-_]?\d*[a-z]?$|^[a-z]$|^\d+$")
ABOVE = re.compile(r"\b(all|none|both|neither) of (the )?(above|these|those)\b", re.I)
NEGATIVE_STEM = re.compile(r"\b(NOT|EXCEPT|LEAST|FALSE)\b")
ABSOLUTE = re.compile(r"\b(always|never|only|all|none|every|completely)\b", re.I)
CARD_BACK_WORDS = 40


def text(content: object) -> str:
    """The text of a content object, plain string, or missing member."""
    if isinstance(content, dict):
        return str(content.get("text", ""))
    return "" if content is None else str(content)


def wordings(choice: dict) -> list[str]:
    """A choice's own text and, in format 0.2, its variants' texts."""
    return [text(choice), *(text(v) for v in choice.get("variants") or [])]


def wording_length(choice: dict) -> float:
    """Average length of a choice's wordings, since any of them may be shown."""
    texts = wordings(choice)
    return sum(len(t) for t in texts) / len(texts)


def words(value: str) -> int:
    return len(re.findall(r"\w+", value))


def normalized(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def check_variants(question: dict, warnings: list[str], notes: list[str]) -> None:
    """Answer variants (format 0.2): wordings that repeat, stand out, or vary
    only on the correct answer."""
    choices = question.get("choices") or []
    if not any(c.get("variants") for c in choices):
        return
    qid = question.get("id")
    seen: set[str] = set()
    for choice in choices:
        for wording in wordings(choice):
            key = normalized(wording)
            if key and key in seen:
                warnings.append(f"`{qid}`: the wording \"{wording}\" appears twice in the question.")
            seen.add(key)
        own = len(text(choice))
        for variant in choice.get("variants") or []:
            length = len(text(variant))
            if own and abs(length - own) >= 15 and not 0.6 <= length / own <= 1.6:
                notes.append(
                    f"`{qid}`: a variant of `{choice.get('id')}` is {length} characters against "
                    f"{own} for its choice; wordings of different lengths stand out when mixed."
                )
    correct = set(question.get("correct_answers") or [])
    varied = {c.get("id") for c in choices if c.get("variants")}
    if varied and varied <= correct:
        warnings.append(
            f"`{qid}`: only the correct choice has variants, so it is the one whose wording "
            "changes. Give the wrong choices variants too."
        )


def check(manifest: dict) -> tuple[list[str], list[str], list[str]]:
    questions = manifest.get("questions") or []
    cards = manifest.get("flashcards") or []
    warnings: list[str] = []
    notes: list[str] = []
    summary: list[str] = []

    singles = [q for q in questions if q.get("selection") == "single"]
    multiples = [q for q in questions if q.get("selection") == "multiple"]
    summary.append(
        f"{len(questions)} questions ({len(singles)} single answer, {len(multiples)} multiple answer), "
        f"{len(cards)} flashcard{'' if len(cards) == 1 else 's'}."
    )

    # Where the correct answer sits, for questions whose choices may be shuffled
    # as well as fixed ones: a reader that does not shuffle shows this order.
    positions: Counter[int] = Counter()
    choice_counts: Counter[int] = Counter()
    longest = 0
    longest_ids: list[str] = []
    for question in singles:
        choices = question.get("choices") or []
        ids = [c.get("id") for c in choices]
        choice_counts[len(choices)] += 1
        correct = (question.get("correct_answers") or [None])[0]
        if correct not in ids:
            continue
        positions[ids.index(correct)] += 1
        lengths = [wording_length(c) for c in choices]
        right = lengths[ids.index(correct)]
        others = [n for i, n in enumerate(lengths) if i != ids.index(correct)]
        if others and right > max(others):
            longest += 1
            longest_ids.append(str(question.get("id")))
            if right >= 1.5 * max(others) and right - max(others) >= 15:
                warnings.append(
                    f"`{question.get('id')}`: the correct choice is much longer than every distractor "
                    f"({right:.0f} vs at most {max(others):.0f} characters), which gives it away."
                )
    if singles:
        spread = ", ".join(f"{chr(65 + p)}: {positions[p]}" for p in sorted(positions))
        summary.append(f"Correct-answer positions (single answer): {spread}.")
        most, count = positions.most_common(1)[0] if positions else (0, 0)
        typical = max(choice_counts, key=lambda n: choice_counts[n])
        unused = [chr(65 + p) for p in range(typical) if positions[p] == 0]
        if len(singles) >= 8 and (count > 1.6 * len(singles) / typical or unused):
            warnings.append(
                f"Position {chr(65 + most)} holds the correct answer in {count} of {len(singles)} "
                "single-answer questions"
                + (f", and position {', '.join(unused)} never does" if unused else "")
                + ". Spread the correct answers across positions."
            )
        if len(singles) >= 8 and longest / len(singles) > 0.4:
            warnings.append(
                f"The correct choice is the longest one in {longest} of {len(singles)} questions. "
                "Test-wise learners pick the longest choice; balance choice lengths in some of: "
                + ", ".join(f"`{qid}`" for qid in longest_ids)
                + "."
            )
        summary.append(f"Correct choice is the longest in {longest} of {len(singles)} single-answer questions.")

    for question in questions:
        qid = question.get("id")
        prompt = text(question.get("prompt"))
        choices = question.get("choices") or []
        check_variants(question, warnings, notes)
        if not text(question.get("explanation")) and not any(text(c.get("explanation")) for c in choices):
            warnings.append(f"`{qid}`: no explanation.")
        if not question.get("references"):
            warnings.append(f"`{qid}`: no references; cite the section the answer comes from.")
        if ABOVE.search(prompt) or any(ABOVE.search(text(c)) for c in choices):
            warnings.append(f"`{qid}`: uses \"all/none of the above\"; rewrite it as a direct question.")
        if NEGATIVE_STEM.search(prompt):
            notes.append(f"`{qid}`: negative stem ({NEGATIVE_STEM.search(prompt).group(0)}). Keep these rare.")
        correct = set(question.get("correct_answers") or [])
        absolute_wrong = [c for c in choices if c.get("id") not in correct and ABSOLUTE.search(text(c))]
        absolute_right = [c for c in choices if c.get("id") in correct and ABSOLUTE.search(text(c))]
        if len(absolute_wrong) >= 2 and not absolute_right:
            notes.append(
                f"`{qid}`: only distractors use absolute words (always, never, only...), "
                "which hints that they are wrong."
            )
        if POSITIONAL_ID.match(str(qid)):
            warnings.append(f"`{qid}`: positional ID. Base IDs on content, such as `osmosis-direction`.")
        for choice in choices:
            if POSITIONAL_ID.match(str(choice.get("id"))):
                warnings.append(f"`{qid}`: positional choice ID `{choice.get('id')}`.")
                break

    for card in cards:
        cid = card.get("id")
        back = text(card.get("back"))
        if words(back) > CARD_BACK_WORDS:
            warnings.append(
                f"`{cid}`: the back has {words(back)} words. A card should hold one fact; "
                "split it, or turn it into a question."
            )
        if not card.get("references"):
            notes.append(f"`{cid}`: no references.")
        if POSITIONAL_ID.match(str(cid)):
            warnings.append(f"`{cid}`: positional ID.")

    # Duplicates: the same prompt twice, or a card that repeats a question.
    # Prompts with the same words are duplicates. Prompts that are merely
    # similar are often legitimate pairs ("hypotonic" and "hypertonic",
    # "chlorophyll" and "chlorophyll b"), so they are only notes.
    stems = [(q.get("id"), normalized(text(q.get("prompt")))) for q in questions]
    stems += [(c.get("id"), normalized(text(c.get("front")))) for c in cards]
    for i, (first, a) in enumerate(stems):
        for second, b in stems[i + 1 :]:
            if not (a and b):
                continue
            if set(a.split()) == set(b.split()):
                warnings.append(f"`{first}` and `{second}` have the same prompt.")
            elif difflib.SequenceMatcher(None, a, b).ratio() > 0.9:
                notes.append(
                    f"`{first}` and `{second}` have very similar prompts. Fine for a contrasting "
                    "pair; otherwise make them easier to tell apart."
                )

    # Coverage by cited section, so gaps against the blueprint stand out. A
    # reference that contains a section number (3.5) is counted under that
    # number, however the rest of it is worded.
    by_section: dict[str, int] = defaultdict(int)
    for item in [*questions, *cards]:
        cited = set()
        for reference in item.get("references") or []:
            where = str(reference.get("reference") or reference.get("title"))
            # Skip figure and table numbers ("Figure 9.1"), which look alike.
            number = re.search(r"(?<!Figure )(?<!Table )\b\d+\.\d+\b", where)
            # Without a number, group by the part before any subsection
            # ("Chapter 4, Digestion: From the Mouth" -> "Chapter 4, Digestion").
            cited.add(f"Section {number.group(0)}" if number else re.split(r":| - | — | – ", where)[0].strip())
        for section in cited:
            by_section[section] += 1
    if by_section:
        summary.append("Items citing each section:")
        summary += [f"  - {section}: {count}" for section, count in sorted(by_section.items())]
    tags = Counter(tag for item in [*questions, *cards] for tag in item.get("tags") or [])
    if tags:
        summary.append("Most used tags: " + ", ".join(f"{t} ({n})" for t, n in tags.most_common(12)) + ".")
    return summary, warnings, notes


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: check_items.py path/to/study.yaml")
    manifest = yaml.safe_load(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        sys.exit("study.yaml is not a mapping; run the validator first")
    summary, warnings, notes = check(manifest)
    print("# Item check\n")
    print("\n".join(summary))
    print(f"\n## Warnings ({len(warnings)})\n")
    print("\n".join(f"- {w}" for w in warnings) or "None.")
    print(f"\n## Notes ({len(notes)})\n")
    print("\n".join(f"- {n}" for n in notes) or "None.")
    sys.exit(1 if warnings else 0)


if __name__ == "__main__":
    main()
