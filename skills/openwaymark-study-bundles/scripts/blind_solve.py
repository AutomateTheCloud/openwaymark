# Copyright 2026 Automate the Cloud Inc.
# SPDX-License-Identifier: Apache-2.0
"""Prepares and scores a blind solve of a bundle's questions.

A blind solve checks the answer key: someone answers every question from the
source alone, without seeing the key, and every disagreement is investigated.
IDs often name the answer (a choice called `split-water`, a question called
`golgi-packages-proteins`), so the questions are numbered Q1, Q2, ... with
lettered choices, and the key is kept in a separate file.

    python3 blind_solve.py make study.yaml -o <dir> [--only id,id,...]
    python3 blind_solve.py score <dir>/blind-key.json <answers.json>

`make` writes <dir>/blind-questions.md (numbered questions with lettered
choices, and no IDs, answers, explanations, or hints), <dir>/blind-variants.md
when choices have answer variants (every wording of each choice, to check that
they make the same claim), <dir>/blind-cards.md
(flashcards with their references, for checking each back against the
source), and <dir>/blind-key.json. Give the solver only the two .md files and
the source pack. Ask for answers as JSON,
`{"Q1": ["B"], ...}`, with the supporting passage for each in a separate
notes file.

After changing items, check just those with `--only` and their item IDs, into
a new folder (work/blind-2, ...), and give them to a solver that has not seen
the earlier wording.

`score` compares the answers with the key and lists every disagreement. Exit
status is 1 if any question disagrees or is missing. Requires PyYAML.
"""

from __future__ import annotations

import argparse
import json
import string
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("blind_solve.py needs PyYAML: python3 -m pip install pyyaml")


def text(content: object) -> str:
    if isinstance(content, dict):
        return str(content.get("text", ""))
    return "" if content is None else str(content)


def instruction(question: dict) -> str:
    if question.get("selection") == "multiple":
        count = question.get("selection_count")
        return f"Choose {count}." if count else "Choose all that apply."
    return "Choose one."


def make(manifest_path: Path, out: Path, only: set[str] | None = None) -> None:
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    if only:
        for member in ("questions", "flashcards"):
            manifest[member] = [i for i in manifest.get(member) or [] if i.get("id") in only]
    out.mkdir(parents=True, exist_ok=True)
    lines = ["# Questions", ""]
    key: dict[str, dict] = {}
    for number, question in enumerate(manifest.get("questions") or [], start=1):
        choices = question.get("choices") or []
        letters = {c.get("id"): string.ascii_uppercase[i] for i, c in enumerate(choices)}
        key[f"Q{number}"] = {
            "id": question["id"],
            "answer": sorted(letters[a] for a in question.get("correct_answers") or []),
        }
        lines += [f"## Q{number}", "", text(question.get("prompt")).strip(), ""]
        lines += [f"{letters[c.get('id')]}. {text(c).strip()}" for c in choices]
        lines += ["", instruction(question), ""]
    if key:
        (out / "blind-questions.md").write_text("\n".join(lines), encoding="utf-8")

    # Answer variants (format 0.2): every wording of each choice, without the
    # key, so a solver can confirm that all wordings of a choice say the same.
    wordings = [
        "# Answer variants",
        "",
        "The app shows each choice in one of the wordings listed under it. For every",
        "choice, check that all its wordings make the same claim: a learner who knows",
        "the material would judge them all correct, or all incorrect. List any wording",
        "that differs, and any that would stand out next to the other choices.",
        "",
    ]
    varied = 0
    for number, question in enumerate(manifest.get("questions") or [], start=1):
        choices = question.get("choices") or []
        if not any(c.get("variants") for c in choices):
            continue
        varied += 1
        wordings += [f"## Q{number}", "", text(question.get("prompt")).strip(), ""]
        for index, choice in enumerate(choices):
            wordings.append(f"{string.ascii_uppercase[index]}.")
            for wording in [choice, *(choice.get("variants") or [])]:
                wordings.append(f"   - {text(wording).strip() or '(image only)'}")
        wordings.append("")
    if varied:
        (out / "blind-variants.md").write_text("\n".join(wordings), encoding="utf-8")

    cards = ["# Flashcards", "", "Check that each back is correct and supported by the cited passage.", ""]
    flashcards = manifest.get("flashcards") or []
    for card in flashcards:
        where = "; ".join(
            f"{r.get('title', '')}, {r.get('reference', '')}".strip(", ")
            for r in card.get("references") or []
        )
        cards += [
            f"## {card['id']}",
            "",
            f"Front: {text(card.get('front')).strip()}",
            f"Back: {text(card.get('back')).strip()}",
            f"Reference: {where or 'none'}",
            "",
        ]
    if flashcards:
        (out / "blind-cards.md").write_text("\n".join(cards), encoding="utf-8")
    if key:
        (out / "blind-key.json").write_text(json.dumps(key, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(key)} questions ({varied} with answer variants) and "
        f"{len(flashcards)} flashcards to {out}"
    )


def score(key_path: Path, answers_path: Path) -> None:
    key = json.loads(key_path.read_text(encoding="utf-8"))
    answers = json.loads(answers_path.read_text(encoding="utf-8"))
    disagree = []
    for number, entry in key.items():
        qid, expected = entry["id"], entry["answer"]
        given = answers.get(number)
        if given is None:
            disagree.append(f"- {number} (`{qid}`): not answered")
            continue
        given = sorted(str(a).strip().upper() for a in (given if isinstance(given, list) else [given]))
        if given != expected:
            disagree.append(f"- {number} (`{qid}`): key {', '.join(expected)}; solver {', '.join(given)}")
    matched = len(key) - len(disagree)
    print(f"Blind solve: {matched} of {len(key)} questions match the key.")
    if disagree:
        print("\nInvestigate each; the item is wrong, ambiguous, or has two defensible answers:\n")
        print("\n".join(disagree))
    sys.exit(1 if disagree else 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    make_cmd = commands.add_parser("make", help="write the blind question set and the key")
    make_cmd.add_argument("manifest", type=Path)
    make_cmd.add_argument("-o", "--output", type=Path, required=True)
    make_cmd.add_argument("--only", help="comma-separated item IDs to include (default: all)")
    score_cmd = commands.add_parser("score", help="compare a solver's answers with the key")
    score_cmd.add_argument("key", type=Path)
    score_cmd.add_argument("answers", type=Path)
    args = parser.parse_args()
    if args.command == "make":
        make(args.manifest, args.output, set(args.only.split(",")) if args.only else None)
    else:
        score(args.key, args.answers)


if __name__ == "__main__":
    main()
