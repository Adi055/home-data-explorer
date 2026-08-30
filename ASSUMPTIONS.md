# Assumptions

Every data-quality issue found in the generated dataset, and every ambiguity the spec left open,
with the decision made and why. `data-generator.ts`, `mock-validator.ts`, and `theme-config.ts`
were treated as black boxes throughout — nothing here modifies them.

## Data-quality issues found

### Duplicate `id`s (every 9973rd row)

`generateRows` deliberately sets `id = rows[i-1].id` when `i % 9973 === 0`, so `id` is **not** a
unique key across the 50k rows (roughly 5 collisions in the full dataset).

**Decision:** the stable identity used everywhere internally — edits, selection, undo commands,
group membership — is the row's **index in the generated array** (`rowKey: number`), not `id`.
Since `generateRows()` is deterministic and called exactly once, and the array is never
reordered or regenerated during a session, index-as-key is stable for the app's lifetime and
free to compute. `id` is retained purely as a **display label and a search field** — searching
matches `id` text, but two rows can legitimately share the same `id` text and still be edited/
undone independently, because the app never uses `id` for identity.

### `specialty: null` (every 97th row)

**Decision:** rendered as the literal word **"null"**, styled muted/italic, rather than blanked
or replaced with a friendlier placeholder. The assignment is explicit that imperfect data must
be "handled, not hidden" — showing an empty cell would look like a rendering bug; showing the
literal `null` makes the data issue visible and traceable to its source value. For **sorting**,
a null specialty sorts **last**, in both ascending and descending order (see "one universal
null-last rule" below).

### `calls: number | string` union — numeric string (every 211th row)

`calls` is occasionally the string form of the same number (e.g. `"24"` instead of `24`).

**Decision:** the raw value (string or number) is preserved untouched for display and as the
edit-diff baseline — it's never silently coerced in storage. For **sorting, aggregation, and
CPI**, it's coerced via `Number(value)`, which handles a numeric string correctly. If coercion
ever produces `NaN` (defensive — doesn't happen with the current generator, since its string
`calls` are always `String(validNumber)`), that row is treated as incomparable/excluded from the
aggregate's `sumCalls` (tracked in `skippedCallsCount`) rather than corrupting the sum with
`NaN`.

### `calls: 99999` outlier (every 12007th row)

A legitimate (if extreme) numeric value that also happens to always fail the mock validator's
60-call cap if resubmitted.

**Decision:** no special-casing for display or sort — it's a normal (very large) number and
sorts/aggregates accordingly. It only becomes relevant at **edit time**: if a user tries to
re-save that row's Calls value unchanged (or to any value > 60), the validator correctly rejects
it with "exceeds per-HCP call cap (60)", and the cell reverts. This is existing data that
predates the app's edit lifecycle, not a value the app itself produced — the validator's cap is
an edit-time business rule, not a display-time data-cleaning rule.

### `trx: 0` (every 577th row)

Makes `CPI = Calls / TRx * 100` undefined (division by zero).

**Decision:** `computeRowCpi`/`computeAggregateCpi` return `null` whenever `trx` is `0` (or
`calls` doesn't coerce to a finite number), never `NaN`/`Infinity`. The UI renders `null` as an
em dash (`—`). For **sorting by CPI**, a null CPI sorts last, same rule as everywhere else. This
also affects **aggregate CPI**, which is computed as `Σ Calls / Σ TRx * 100` (a ratio of sums,
not an average of per-row CPIs) — a group's aggregate CPI is only undefined if the *group's*
total TRx is zero, which in practice essentially never happens even when individual rows in it
have `trx = 0`.

## Ambiguities resolved

### Row identity for edits/selection/undo

Covered above under duplicate `id`s — resolved to `rowKey` (array index), not `id`.

### One universal "incomparable sorts last" rule

Rather than a different special case per column, every column uses the same rule: a value that
can't be meaningfully compared — null `specialty`, non-numeric `calls`, undefined CPI — sorts
**last**, in both ascending and descending order (i.e., it's not affected by the direction
toggle; it's always at the bottom). This is stated once and applies uniformly, which is easier
to reason about and to explain than "specialty nulls go one way, but CPI nulls go another."
3-state sort is `asc → desc → none`, where "none" reverts to original generation order
(`rowKey` ascending) — which also serves as the stable tiebreaker for every sort, so ties never
reorder unpredictably as you toggle direction.

### Sorting a numeric column reorders groups too

When the active sort column is numeric (Calls/TRx/NRx/CPI), both territory-within-region order
and region order are re-derived from each group's **aggregate** value for that column (not by
peeking at, say, the first row in the group). Sorting by a text column, or no sort at all, falls
back to canonical order (region alphabetically, then territory number).

### Aggregates vs. filter/search — the "hard intersection"

Group aggregates (Σ Calls, Σ TRx, Σ NRx, count, CPI) always reflect the group's **full
membership**, never just what's currently visible. Filtering by region or searching by name/ID
only changes which rows/groups are *rendered* — it never changes what an aggregate sums over.
A collapsed group still shows its correct live aggregate; searching for one name doesn't make a
territory's Σ Calls shrink down to that one row's calls value. This is stated once, explicitly,
because it's exactly the kind of behavior that's easy to get wrong by deriving aggregates from
whatever's currently on screen instead of from canonical group membership.

### Searching auto-expands matching groups (without mutating manual state)

A region/territory containing a search match is shown expanded regardless of its manual
expand/collapse state — but the app never actually *writes* to `expandedRegions`/
`expandedTerritories` to do this; it's computed purely at render/flatten time as
`manuallyExpanded || (searching && hasMatch)`. Clearing the search box reverts exactly to
whatever the user's manual expand/collapse state was before searching, with no leftover
"stuck open" groups. A group with zero matches while actively searching is hidden entirely
(header and rows both), for a focused result view.

### Editing a cell whose previous commit is still in flight

Locked: the cell is a no-op for clicks and keystrokes while `pending`, and shows a small
"saving" indicator. Chosen over queueing a second edit or cancelling the first, since designing
correct request-cancellation/superseding semantics wasn't worth the complexity for this scope —
documented as an intentional simplification, not an oversight.

### Undo of a still-pending edit

Marks the command `stale` and reverts the displayed value immediately (no aggregate change is
needed — a pending edit never touched aggregates in the first place). When the validator's
response for that commit eventually arrives, the reducer checks the `stale` flag and **silently
discards it** — no aggregate update, no status flip, no toast. This is what stops a slow,
already-undone commit from corrupting state when it finally resolves. Verified directly in
`edit-lifecycle.test.tsx`.

### Redo does not re-validate

The value was already successfully validated once. The mock validator's ~10% random failure is
a network-flakiness simulation unrelated to the value itself — redo is reconstructing known-good
prior state locally, not submitting a new business transaction, so re-rolling that failure
chance on redo would make an already-accepted edit spuriously fail for reasons that have nothing
to do with what the user is doing. Redo mints a fresh command id (rather than reusing the
original), specifically so a still-in-flight original promise from before an undo can never be
mistaken for the redone command if it happens to resolve late.

### Footer's "last operation" label

Sort, search, and region-filter changes are timed together as a single unit (they're computed in
the same memoized step), and the label shown prioritizes sort > search > filter when more than
one is active at once — so if a sort is active and the user then searches, the footer keeps
saying "sort" rather than switching to "search," since the sort is still in effect and is
arguably the more expensive/interesting operation of the two. The **timing number and the "rows
in DOM" count are always accurate** regardless of label wording; only the label's specific text
uses this simplified priority rather than tracking the literal most-recent action type.

### Bulk edit (+10% calls) rounding

Not implemented in code (FR-5 is a design-only requirement — see README's FR-5/FR-6 design
section), but the design assumes `Math.round(effectiveCalls * 1.1)`, matching the rounding the
generator itself uses elsewhere, rather than truncating or leaving fractional call counts.
