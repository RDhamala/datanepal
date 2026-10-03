---
name: datanepal-adr
description: Use when writing, numbering or amending a record in docs/adr/, when a decision in this project would be expensive to reverse (a change to the observation model, the geography spine, licensing, deployment shape, or what gets published), when asked to "write this up as an ADR" or to document why an approach was chosen, and when superseding or extending an existing ADR. Also use when you are about to make such a decision inline and should instead propose a record. Owns the decision-record format and the bar for earning one; it does not decide the technical question, the domain skills do.
---

# DataNepal ADRs

`docs/adr/` holds one record per decision that would be **expensive to
reverse**. The README says this and the repo means it: eight records in the
project's lifetime. Routine choices belong in code comments.

This skill exists because these records have an unusually consistent voice —
they argue, they name what was rejected and why, and they state their own
reversal cost — and that consistency is what makes them worth reading two
years later.

## Does this earn a record?

Yes, when the decision:

- changes the meaning of a column, a grain, or a join key that other things
  key on,
- constrains what can be published or how (licensing, provenance, privacy),
- would require touching many models or every observation to undo,
- or was *non-obvious*, such that a future reader will otherwise re-litigate it.

No, when it is a naming choice, a library pick with an easy swap, a
performance tweak, or a thing the code already says clearly. Write a comment.

If unsure: the test is not importance, it is **cost of reversal plus
likelihood of being questioned again**.

## Format

Filename `NNNN-kebab-title.md`, next free number, no gaps. Title is the
decision stated as a claim, not a topic — `Places are valid over an interval,
and successions are data`, not `Temporal geography`.

```markdown
# ADR-NNNN: <the decision, as a claim>

**Status:** Accepted · YYYY-MM-DD[ · Supersedes … | Extends [ADR-000X](…)]

## Context
## Decision
## Alternatives considered      (or "Alternatives rejected"; omit if there were none worth naming)
## Consequences
## Notes                        (or "Triggers for revisiting"; omit if nothing to add)
```

Then **add the row to `docs/adr/README.md`** — the index is how anyone finds
these, and a record missing from it effectively does not exist.

Prose, wrapped at 79 columns, matching the existing records. Bold lead-ins for
the two or three claims a section turns on (`**Every place carries a validity
interval.**`) rather than bullet lists of equals.

## What each section is for

**Context** — the forcing situation, with the specifics that make it real.
Numbers, dates, instrument names. ADR-0008 opens with the 2015 constitution
and the 2017 restructuring, counted: 75 districts to 77, 3,915 VDCs to 753
local units. Then the consequences of *not* deciding, in increasing order of
seriousness. A reader should feel the problem before reaching the decision.

**Decision** — numbered when the parts depend on each other, and each part
justified where it is non-obvious. Say what the decision *refuses* to do as
clearly as what it does: `place_successions` records the relationship and
refuses to invent the share, and that refusal is a third of the record.

**Alternatives considered** — the serious ones, each with the reason it was
rejected. The standard answer deserves naming precisely because it is standard:
ADR-0008 rejects a Type 2 SCD on the grounds that it conflates a rename with a
cessation. A record that lists no alternatives reads as a decision that was
never actually examined.

**Consequences** — both directions, labelled **Good** and **Costs**. State the
new failure mode the decision introduces and what mitigates it. Record what is
*not verified*: ADR-0008 says plainly that nine local units carry a `valid_from`
that is possibly early, and that nothing currently depends on it. End with
**Reversal cost**, because that is the claim the next person will test.

**Notes / Triggers for revisiting** — the test that gives the model teeth, or
the condition under which this should be reopened.

## Voice

Write the reasoning, not the minutes. Specific over general: *"reaches 751 of
753 with zero type disagreements"* is worth a paragraph of adjectives. Say "we
rejected X because Y" in plain words; no hedging, no passive constructions
hiding who decided.

Status is `Accepted` on merge. Superseding an earlier record means amending the
older one's status line and the README row — do not silently orphan it.
