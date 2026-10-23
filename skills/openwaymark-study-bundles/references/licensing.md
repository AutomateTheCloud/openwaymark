# Licensing a bundle made from a source

A bundle written from a textbook is an adaptation of it: the questions follow
the book's structure, emphasis, and facts as the book presents them. Treat the
source's license as binding on the bundle. This is practical guidance for
common open licenses, not legal advice; when the stakes are real (a commercial
product, a large public catalog), the person should check with whoever handles
licensing for them.

## Find the license first

Read it from the source itself: the book's copyright page or its metadata
(`source_pack.py list` prints the statements it finds in the front and back
matter). A license stated by the work wins over one stated by a catalog page
or a search result. Record exactly what you found and where.

Parts of a book can carry their own licenses. A copyright page that says "except
where otherwise noted", or acknowledgments that list adapted sources under
other licenses, are signs of this: a book licensed CC BY may contain chapters
adapted from a CC BY-NC-SA source. Downloaded copies often leave out the
per-section notices that the publisher's web pages show. When the signs are
there and the files do not settle it, ask the person to confirm the license of
the sections used (they can check the publisher's pages), and take the most
restrictive. Say in the report what was confirmed and how.

Licenses change between editions and over time, and a work keeps the license
it was released under. If the source shows a different license from the one
the person expects, tell them, and do not choose between versions for them.

## Publisher terms beyond the license

Some publishers add terms of their own to openly licensed books, most often
about AI. Look in the book's copyright and front matter for words like "AI",
"machine learning", "language model", or "permission", as well as at the
license. Such terms are often stated only on the publisher's web pages, so
when the person got the book from a publisher's site, ask whether the site
states any terms about AI use.

Such terms can forbid more than training: for example, a statement that a
book may not be "ingested into large language models or generative AI
offerings" without permission. Writing a bundle with this skill puts the
book's text into a language model, so terms like that apply to it. How such
terms combine with an open license is a legal question this skill does not
answer.

When a source has terms like these, stop before extracting or reading the
text. Quote the terms to the person, and go on only if they say they have
permission or have decided to proceed. Record their answer in the review
report.

## What each license means for the bundle

| Source license                      | Can you make the bundle?                | Bundle `license.spdx`       | Notes                                             |
| ----------------------------------- | --------------------------------------- | --------------------------- | ------------------------------------------------- |
| CC BY 4.0                           | Yes                                     | Any; `CC-BY-4.0` is natural | Credit the source                                 |
| CC BY-SA 4.0                        | Yes                                     | `CC-BY-SA-4.0`              | Share alike: the bundle must carry the same terms |
| CC BY-NC 4.0                        | Yes, not for sale                       | `CC-BY-NC-4.0`              | No commercial use of the bundle                   |
| CC BY-NC-SA 4.0                     | Yes, not for sale                       | `CC-BY-NC-SA-4.0`           | Both of the above                                 |
| CC BY-ND or BY-NC-ND                | **No**                                  |                             | No derivatives allowed; stop and tell the person  |
| CC0 or public domain                | Yes                                     | Any                         | Credit is still good practice                     |
| All rights reserved, or none stated | Only for the person's own private study | Omit `license`              | Say that the bundle must not be shared            |

Use the same version number as the source (a 3.0 source gives a 3.0 bundle
license for SA). If the source has a license not in this table, describe it to
the person and ask before going on.

"Not for sale" (NC) also rules out bundles sold, or used to sell something,
by the person or their organization. If the person mentions a paid product or
a commercial app, raise this before writing anything.

## Attribution

Creative Commons licenses ask for the title, the authors, a link to the source,
the license, and a note that the work was changed. Put it in the bundle in
three places:

```yaml
license:
  spdx: CC-BY-NC-SA-4.0
  url: https://creativecommons.org/licenses/by-nc-sa/4.0/
  statement: >-
    Questions and flashcards written from Introductory Biology by A. Author
    and B. Author (Example Press), licensed under CC BY-NC-SA 4.0. The items
    are new adaptations of the book's content, not text copied from it. Not
    endorsed by Example Press or the book's authors.
sources:
  - title: Introductory Biology (Example Press)
    reference: Chapter 3, Cell Structure and Function
    url: https://books.example.org/introductory-biology/
```

and a sentence in `description` naming the source and its license.

- The statement says what was done ("questions and flashcards written from").
- It says the work is not endorsed by the source. Licenses forbid implying
  endorsement, and publishers' names are often trademarks: name them only in
  attribution, never in the bundle title as if it were their product.
- Use only URLs you have confirmed, such as the ones the extraction scripts
  report.

## Images

Figures in an open textbook are often under different terms from the text:
credit lines such as "modification of work by..." or "credit: NIH" mean the
image has its own source and possibly its own license. Leave images out
unless the person asks for them; if they do, check each image's credit line,
include only images under licenses compatible with the bundle's, and put the
credit in the image's caption or the item's explanation.

## Where the output goes

Keep generated bundles out of repositories whose license would claim them. In
the OpenWaymark repository in particular, everything in `examples/` and
`fixtures/` is Apache 2.0, which a ShareAlike or NonCommercial source cannot
be relicensed under. Write bundles to a separate folder the person chooses.
