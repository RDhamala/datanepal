---
name: datanepal-commits
description: Use whenever writing a commit message or pull request description in this repo, when asked to commit, stage and commit, or open a PR, and when splitting a batch of work into commits. This project's history is written in an unusual and consistently-held style -- prose paragraphs that state what changed, why, what was measured, and what was deliberately not done -- and a conventional-commits or bullet-list message would stand out as wrong. Read this before writing the message, not after.
---

# DataNepal commit messages

The history here is written to be read. Each message explains a change to
someone who will meet it in `git blame` a year from now with no memory of the
session that produced it. That reader needs the reasoning and the evidence,
not a summary of the diff — they can read the diff.

## Subject line

A declarative sentence saying what the change does to the product, in the
present tense. Sentence case, no trailing period, no type prefix. Length
follows the sentence — these run 40 to 113 characters and that is fine.

```
Let section headings scale with the viewport
Give each topic card its shape, not just its number
Lead with the census, show projections only where they earn it
Launch Labour & Migration; scope and deliberately skip Tourism
Scale the World Bank connector's shape guard to the indicators it actually has
```

Two related changes join with a comma or semicolon rather than being forced
apart. What is *not* used: `feat:`, `fix:`, `chore:`, scopes in parentheses,
or a subject that names files (`Update data.ts`).

## Body

Blank line, then prose paragraphs wrapped at 79 columns. Bullets are available
but rare — reach for them only when the content is genuinely a list of peers.
Most messages here run 20 to 60 lines, and length should track how surprising
the change is, not how large.

Cover, in roughly this order, skipping what does not apply:

**What was wrong, concretely.** With the number that makes it real. *"'Explore
by topic' was the tallest section on the homepage at 817px and drew nothing."*
*"Section headings were a fixed 1.0625rem against 15px body — a 1.13× ratio."*

**Why this fix rather than another.** The reasoning a reviewer would otherwise
have to reconstruct. *"Fixed by making the token fluid rather than adding a
breakpoint, which is what the homepage h1 already does."*

**What was deliberately not done, and why.** This is the part most projects
omit and the part this one depends on. *"7 of 10 topics get a line. The rest
have no series to draw: literacy is a single 2021 observation… so a line there
would invent a trend and blur precisely the distinction this project refuses to
blur."* A scope boundary that is not written down gets re-crossed.

**What was measured.** Not "tested" — *measured*, with the values. *"500px
still measures 17.0, 1024px 19.5, 1440px 22.0."* *"the four bars measure
78.2/4.5/0.4/16.9%, summing to 100.0."* For anything visual this means the
browser, per `datanepal-visual-review`; for anything data-side it means a
rebuilt `publish/dist`, per `datanepal-build-publish`. If verification was
constrained, say how: *"Verified in an isolated worktree, the main tree's build
being broken by unrelated in-flight work."*

**A mistake worth recording.** Where a first attempt failed in a way the next
person could repeat. *"A first attempt used h-[34px] with h-auto on the svg,
which rendered 61px into a 34px box and overlapped the footer by 15px —
invisible in the diff, obvious the moment it was measured."*

## Scope of a commit

One change with one argument. "Launch the Health topic with four World Bank
indicators" is one commit across connector, models, catalog and page, because
the argument is singular. Unrelated formatting goes in its own commit — the
history has `Run prettier over this session's changes` for exactly that reason.

Do not mix a data-model change with the UI change that consumes it unless
neither works alone.

## Pull requests

Same voice, longer. Open with the problem in a sentence or two, then what
changed and why, then what was measured, then what is explicitly out of scope.
Link the ADR where one exists — a PR implementing a decision should point at
the record rather than re-argue it.

## Attribution

Use the trailer the current session specifies, exactly as given, and nothing
else. The repo's history is mixed on this (recent commits carry no trailer,
earlier ones do), so follow the session's instruction rather than imitating
whichever neighbouring commit you happen to look at.
