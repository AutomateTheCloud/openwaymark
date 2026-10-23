# Example bundles

Valid OpenWaymark bundles for format **draft 0.1**, and one for **draft 0.2**
(`answer-variants`). Each one exercises a
different part of the format. Every manifest here is checked in CI against the
JSON Schema and the cross-reference rules (`test/examples.test.ts`).

| Example                                                | Form    | Exercises                                                                                                                                                                             |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`networking-fundamentals/`](networking-fundamentals/) | Archive | IT certification style: single and multiple answers, `selection_count`, hints, per-choice explanations, references, fixed choice order, images in prompts, cards, and the description |
| [`anatomy-basics/`](anatomy-basics/)                   | Archive | High-school style: a labeled diagram question, image credits, a WebP image inside an explanation, a flashcard with an image front, "select all that apply"                            |
| [`rendering-showcase/`](rendering-showcase/)           | Archive | Choice images (JPEG), a decorative image, headings and a table in the description, code spans and blocks, literal security examples, block quotes, lists, extensions                  |
| [`biology-terms/`](biology-terms/)                     | Archive | A flashcards-only collection with no images, so the folder holds only `study.yaml`                                                                                                    |
| [`spanish-basics/`](spanish-basics/)                   | Archive | Language learning: Spanish choices and card sides that declare their own `language`                                                                                                   |
| [`answer-variants/`](answer-variants/)                 | Archive | Draft 0.2: correct and incorrect choices with several wordings, in single- and multiple-answer questions                                                                              |

Each folder is the source of a bundle. To make a `.waymark` file, pack it:

```bash
pnpm openwaymark pack examples/biology-terms
```

`pack` zips the folder's **contents**, so that `study.yaml` sits at the top of
the archive, and checks the result. `validate`, `lint`, and `inspect` also take
a folder, and pack it in memory first.

## Images

Every image was drawn by `tools/generate-example-images.py` and contains no
metadata. The diagrams are simplified schematics for demonstration, not
reference material.

## License

These examples are part of this repository and are licensed under the Apache
License 2.0. They are deliberately small and illustrative. Real study
collections are separate works with their own licenses.
