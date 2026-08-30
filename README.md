# HCP Data Explorer

A client-side data explorer for 50,000 healthcare-provider records: virtualized grid, two-level
grouping with live aggregates, sort/search/filter, async-validated inline editing with
undo/redo, a computed CPI column, and runtime white-labelling. No backend — everything runs
in the browser against a deterministic generated dataset.

## Running it

```bash
npm install
npm run dev      # starts the app
npm run test     # runs the test suite
npm run build    # type-checks + production build
```

Requires Node 20.19+ or 22.12+ (see "Known environment issue" below if `npm install` fails on
an older Node).

## Architecture overview

```
src/
  data/            the three provided black-box files, verbatim, plus load-rows.ts
                    (generates the 50k rows once and attaches a stable rowKey)
  domain/          pure functions: grouping/sorting/filtering pipeline, aggregation,
                    CPI, edit-effective-value helpers, undo command shape, theme validation
  state/           the single reducer/store (rows are NOT in it — see below), actions,
                    the validator injection point
  selectors/       useDerivedRows — the memoized pipeline that turns raw state into
                    what the grid actually renders
  components/      Grid (virtualized), Toolbar, Footer, Toast — all thin, all reading
                    from the store/selectors rather than holding their own copies of data
  theme/           ThemeProvider — resolves the active tenant theme and writes it to CSS
                    custom properties at runtime
  test/            Vitest + React Testing Library suite, plus a fake validator for
                    deterministic async tests
```

No `services/`, `hocs/`, or interface-ceremony layers. Each folder should be explainable in one
sentence, and mostly is above.

### Why rows aren't in the reducer

`generateRows()` is called exactly once (`data/load-rows.ts` caches the array as a module-level
singleton) and the array is never reordered or mutated afterward — sorting/filtering/grouping
all produce new *views* over it, never a new copy of it. Since it never changes, there is no
reason to route it through the reducer; anything that needs the rows just calls `loadRows()`
directly and gets the same reference back for free. What *does* live in the reducer is
everything that actually changes: UI state (sort/search/filter/expand-collapse/tenant... tenant
is actually in its own `ThemeProvider`, see below), the edits map, the aggregates, the undo
stacks, and toasts.

### State shape

```ts
interface AppState {
  ui: {
    expandedRegions: Set<string>;
    expandedTerritories: Set<string>;
    search: string;
    regionFilter: string | null;
    sort: { column: SortableColumn; direction: "asc" | "desc" } | null;
  };
  edits: Record<number /* rowKey */, {
    status: "pending" | "saved" | "rejected";
    value: number | string;       // current effective value
    rejectionReason?: string;
    commandId: string;
  }>;
  aggregates: {
    territory: Map<string, GroupAggregate>;   // key: "region::territory"
    region: Map<string, GroupAggregate>;
  };
  undo: { past: Command[]; future: Command[] };
  toasts: { id: string; message: string }[];
}
```

`edits` is keyed by `rowKey` (a row's index in the generated array — see ASSUMPTIONS.md for why
`id` isn't safe to use as identity). A row with no entry in `edits` has never been touched;
its displayed value is just `row.calls`.

**Reducer actions:** `TOGGLE_REGION_EXPANDED`, `TOGGLE_TERRITORY_EXPANDED`, `SET_SEARCH`,
`SET_REGION_FILTER`, `SET_SORT`, `EDIT_COMMIT`, `EDIT_RESOLVED`, `EDIT_REJECTED`, `UNDO`,
`REDO`, `DISMISS_TOAST`. All of it lives in one `reducer.ts` — it never grew large enough to
be worth splitting into per-slice files, so it wasn't.

### The derived-data pipeline (`selectors/useDerivedRows.ts`)

```
rows (stable, module singleton)
  → groupRows(rows)                              — Region → Territory, canonical order
  → sortGroupsAndRows(groups, sort, aggregates, edits)   — reorders groups by aggregate
    when sorting a numeric column; sorts rows within each territory
  → flattenGroups(sortedGroups, ui)               — applies region filter + search,
    auto-expands (without mutating manual expand state) groups containing a match,
    produces the flat array the virtualizer windows over
```

Memoization boundaries: `groupRows` only reruns if `rows` changes (never, post-load).
`sortGroupsAndRows` + `flattenGroups` are timed and measured together as one operation — this
is what the Footer's timing readout reports — and rerun only when `[groups, ui, aggregates,
edits]` actually change. Search is debounced 150ms in the Toolbar before it ever reaches
`dispatch`, so typing doesn't retrigger the pipeline on every keystroke. **Accepting a
single-cell edit never touches `groupRows` or the filter/search logic** — a row's group
membership never changes from editing `calls` — it only potentially reruns the sort (if
currently sorted by Calls/CPI), because the `aggregates` reference it's derived from changes.

Group-header aggregate numbers (Σ Calls, Σ TRx, Σ NRx, CPI) read directly from
`state.aggregates` via `Map.get`, not through the pipeline — so accepting an edit re-renders
only the affected header rows, never a 50k-row recompute.

### Aggregation: build once, delta forever

`buildAggregates(rows)` walks all 50k rows once at store-creation time. When an edit is
**accepted** (never while pending), `applyCallsDelta()` does an O(1) update to both the
territory's and its parent region's aggregate — `sumCalls += next - prev` — and returns new
`Map`s (immutable update, so React sees a new reference and re-renders the right things). There
is no code path that ever rebuilds the aggregates from scratch after the initial load.

**Aggregates vs. filter/search:** group aggregates always reflect the group's full membership,
regardless of the current search/filter/collapse state — a collapsed group still shows correct
live totals, and searching for one name doesn't shrink a territory's Σ Calls down to just that
row. Filter/search only decide what's *rendered*, never what's *summed*. This was the
"intersection" the assignment flagged as the hard part, and it's why aggregates live in state
independently of the render pipeline rather than being derived from whatever's currently
visible.

### Virtualization (FR-1)

One `useVirtualizer` (`@tanstack/react-virtual`) in `Grid.tsx`, over the single flattened array
from the pipeline above — region headers, territory headers, and data rows are one interleaved
list as far as the virtualizer is concerned; grouping is purely a property of how that array was
built, not something the virtualizer knows about. Two fixed row heights (32px data rows, 36px
group headers), so no dynamic `measureElement` is needed. A collapsed group's rows are removed
from the array entirely, not CSS-hidden — that's what keeps the Footer's "rows in DOM" number
(`virtualizer.getVirtualItems().length`) small regardless of scroll position or how many groups
are expanded.

**Why a library and not hand-rolled:** the custom semantics this assignment actually grades
(grouping, aggregation, edit lifecycle, undo) all live in plain application code either way —
TanStack Virtual only owns "given N items of known heights and a scroll position, which indices
are visible." That's a solved, easy-to-get-subtly-wrong problem (scroll math, resize handling,
overscan tuning) that isn't where the interesting engineering is for this project, so it wasn't
worth re-deriving. Hand-rolling it would have been a reasonable choice too (and is listed as a
bonus item), but the time was better spent on the state model.

### Async edit lifecycle (FR-4)

```
idle --click--> editing --Enter--> pending --resolve--> saved
        |--Esc-->idle      pending--reject--> rejected (reverted value + reason)
                            pending--(re-edit attempt)--> pending  (no-op, locked)
```

`editing` (the draft text while typing) is local component state in `EditableCallsCell` — it
never touches the store, since nothing outside that one cell needs to know about it. Pressing
Enter dispatches `EDIT_COMMIT`, which creates a `Command` (id, rowKey, prevValue, nextValue,
`groupKeys`), pushes it onto `undo.past`, clears `undo.future`, and marks the cell `pending`.
The component then calls the **injected validator** (`useValidator()`, resolving to the real
`validateCalls` by default, or a fake in tests — see Testing below) and dispatches
`EDIT_RESOLVED`/`EDIT_REJECTED` when it settles.

**Re-editing a pending cell:** locked, a no-op. The cell shows a small "saving" indicator and
ignores clicks/keystrokes until it settles. Simpler and safer than designing
request-cancellation for this scope, and documented as a deliberate choice, not an oversight.

**Undo/redo — a command history, not snapshots.** `UNDO` pops `undo.past`. If the command was
already `saved`, it reverses the aggregate delta and reverts the displayed value. If the command
is still `pending`, nothing has touched aggregates yet, so undo just marks the command `stale`
and reverts the displayed value immediately — no aggregate change needed. When the validator's
response for that (now-stale) commit eventually arrives, `EDIT_RESOLVED`/`EDIT_REJECTED` check
the `stale` flag and **silently discard it** — this is what prevents a late response from
corrupting state after the user has already undone it (verified in tests — see below). `REDO`
re-applies the value **without calling the validator again**: the value was already validated
once, and the validator's ~10% random failure is a flakiness simulation, not a business-rule
re-check — re-rolling it on redo would make an already-accepted edit spuriously fail for reasons
that have nothing to do with the value itself. Redo mints a fresh command id specifically so a
still-in-flight original promise (from before the undo) can never be mistaken for the redone
command if it resolves late.

Undo/redo operate on `rowKey`, never on the currently-displayed/sorted/filtered array, so they
work correctly regardless of the current sort, filter, or grouping state — undoing a row's edit
updates the canonical `edits` map and the aggregates whether or not that row happens to be
visible right now.

## FR-5 / FR-6 — design (not implemented in code)

Per the assignment, these are design deliverables; implementing them was deprioritized in favor
of a solid, tested core (FR-1–4, 7, 8). This is the design I'd build against.

### FR-5: Bulk edit with partial failure

**Selection.** Per-row checkboxes plus a "select all in this territory" control on
`GroupHeaderRow`, recomputed from `state.rows`-equivalent (`loadRows()`) at click time rather
than cached, so it's always correct. `state.selection: { selectedRowKeys: Set<number> }`.

**Trigger.** A "+10% calls" toolbar action, enabled when the selection is non-empty.

**State addition.**
```ts
state.bulk: {
  active: boolean;
  total: number;
  settled: number;
  results: Map<number /* rowKey */, "saved" | "rejected">;
} | null
```

**Event flow for one bulk operation:**
1. `BULK_COMMIT_START(rowKeys, computeDelta)` marks every selected row not already `pending` as
   `pending` (rows already mid-edit for an unrelated reason are skipped and reported separately,
   not counted as failures) and initializes `state.bulk`.
2. A `useBulkEdit()` hook (orchestration outside the reducer, which stays synchronous) fires all
   validations **concurrently** — one call per row, no `Promise.all` gate — since the mock
   validator has no shared state across calls, true concurrency is safe. Each settle dispatches
   `BULK_ROW_RESOLVED`/`BULK_ROW_REJECTED` as they land, in whatever order they land in (not
   call order). Each accepted row applies its aggregate delta **immediately** as it settles, so
   the group's Σ numbers creep up live rather than jumping once at the end.
3. Once `settled === total`, `BULK_FINALIZE(successfulRowKeys)` builds **exactly one**
   `bulk-edit-calls` command from only the successful entries and pushes it as a **single**
   `undo.past` entry. A toast reports "N applied, M rejected" with reasons grouped by row.
   Rejected rows are not part of the command and aren't independently undoable — they already
   self-reverted at reject time, same as a single-cell rejection.
4. Undoing that one command reverses every entry's delta in one reducer action — atomic from the
   undo stack's point of view, indistinguishable in shape from a single-cell undo except it
   touches multiple `rowKey`s.

This is the concrete answer to "the applied subset must form exactly one undo step": the command
object itself only ever contains the successes: partial failure never enters the undo history
at all.

### FR-6: Undo at scale

Extends the FR-4 model to three hard cases:

- **Undoing a row inside a collapsed group.** Would dispatch `TOGGLE_REGION_EXPANDED`/
  `TOGGLE_TERRITORY_EXPANDED` for the affected row's group (looked up from `loadRows()[rowKey]`,
  independent of sort/filter) if not already expanded, then `virtualizer.scrollToIndex(...)`
  once the flat list includes it. For a bulk command spanning multiple territories, only the
  first affected row's group would auto-expand — expanding every touched group at once is
  overkill for what this buys; a scoped simplification I'd call out explicitly rather than
  silently narrow.
- **Whether redo re-validates.** No — see the FR-4 rationale above; the same reasoning applies
  identically to a redone bulk command.
- **Row excluded by the current search/filter when undo fires.** Undo still applies to canonical
  data by `rowKey` regardless of filter, but wouldn't force-clear the user's filter to reveal it
  — instead a toast would confirm the change with a "(currently hidden by filter)" note. Clearing
  someone's filter out from under them on an unrelated undo click is more surprising than telling
  them what happened.

Command shape, unifying both:

```ts
type Command =
  | { id, type: "edit-calls", rowKey, prevValue, nextValue, stale, status, groupKeys }
  | { id, type: "bulk-edit-calls", entries: { rowKey, prevValue, nextValue }[], groupKeysTouched }
```

## Runtime white-labelling (FR-8)

`domain/theme-validate.ts` validates each of `TenantTheme`'s 7 fields **independently** —
`isValidHex` (regex), `isValidRadius` (finite number 0–24), `isValidAppName` (non-empty string)
— and falls back per-field to `DEFAULT_THEME` on failure. No schema library: 7 known fields is
shorter and clearer hand-written than pulled in as a dependency. Verified against the `meridian`
tenant, which has an invalid hex `primary`, a string `"huge"` for `radius`, and no `onPrimary` or
`text` at all — each field falls back independently; the app never crashes on it (see tests).

`ThemeProvider` resolves the active tenant's theme and writes it to CSS custom properties on
`:root` (`--color-primary`, `--radius`, etc.) plus `document.title`, at runtime, no rebuild.
Switchable via a dropdown in the Toolbar or a `?tenant=` query parameter read once on mount.

**Edited-cell state colors (`--state-pending-bg`, `--state-rejected-border`, etc.) are a fixed
palette defined once in `index.css`, deliberately never derived from the tenant's `primary`/
`surface`.** This is what keeps pending/saved/rejected states legible under *any* tenant
palette, including an adversarial one that happened to pick colors close to a state color —
verified visually under `default`, `aurelia`, and `meridian`.

## Testing

`state/validatorContext.ts` exposes a React context for the "commit calls" async function,
defaulting to the real `validateCalls`. Tests never import `mock-validator.ts` into a component
directly — they wrap the tree in `<ValidatorContext.Provider value={fakeValidator}>` instead
(`test/fakeValidator.ts`), which is what makes async outcomes and timing fully controllable
without touching the black-box file.

- **`edit-lifecycle.test.tsx`**: pending immediately on commit (before the fake validator
  settles); aggregate stays unchanged while pending and only updates after resolve; rejection
  reverts the value and surfaces the exact reason; re-editing a pending cell is a no-op; undo
  fired mid-flight reverts immediately and the late validator response is discarded, verified by
  waiting past the fake delay and checking the value/aggregate/status are still correct; undo
  then redo round-trips the value and the aggregate.
- **Race / partial-failure scenario** (required deliverable): two rows committed concurrently,
  deliberately settling **out of order** (the later-started commit has the shorter delay) — one
  rejects, one accepts. Asserts each row's state is correct independently while the other is
  still pending, with no cross-contamination.
- **Unit tests**: `comparators.test.ts` (null-last sorting, effective-value sorting),
  `aggregate.test.ts` (base build + O(1) delta, non-numeric `calls` bookkeeping), `cpi.test.ts`
  (undefined cases never leak NaN/Infinity), `theme-validate.test.ts` (per-field fallback against
  the real `meridian` config).

28 tests, all passing (`npm run test`).

## Build vs. buy

| Concern | Choice | Why |
|---|---|---|
| Virtualization | `@tanstack/react-virtual` | Headless, small, lets custom grouping/aggregation stay 100% application code |
| State | `useReducer` + Context, no library | Full manual control over the command-history undo model; the app is small enough that Redux/Zustand would add ceremony without buying anything |
| Styling | Plain CSS + custom properties | Maps directly onto runtime theming (FR-8); no build-time CSS-in-JS step needed |
| Theme validation | Hand-written per-field checks | 7 fields; a schema library would be more code, not less, for this size |
| Tests | Vitest + React Testing Library | Native fit with Vite; no separate test-runner config |

## Known environment issue

Vite 8's rolldown bundler ships platform-specific native bindings as optional dependencies.
Under some npm versions (a known npm bug, npm/cli#4828) the correct one for your platform
doesn't get installed, and `vite`/`vitest` fail immediately with
`Cannot find native binding`. If this happens: delete `node_modules` and `package-lock.json` and
`npm install` again; if it persists, install the missing platform package explicitly, e.g.
`npm install @rolldown/binding-win32-x64-msvc --no-save` (swap in your platform's package name
from `npm view rolldown optionalDependencies`).

## What I'd do differently with more time

- **FR-5/FR-6 in code** — the design above is concrete enough to build directly; it just lost
  the time trade-off against a tested, working core.
- **Full keyboard navigation** across virtualized rows (arrow keys between cells) — currently
  only the Calls cell itself is keyboard-operable (Enter to edit, Escape to cancel); there's no
  arrow-key traversal between rows/columns.
- **Hand-rolled virtualization** as the bonus item suggests, once the state-model work is
  otherwise done, to compare against the library approach.
- **Fake timers** (`vi.useFakeTimers()`) instead of small real delays in the async tests, so the
  suite runs in milliseconds instead of seconds — skipped because mixing fake timers with RTL's
  `waitFor` + React 19's scheduling reliably introduces `act()` flakiness, and real-but-small
  delays (30–700ms) were more robust to get right the first time.
- **Column pinning** and a third grouping level, to demonstrate the pipeline generalizes — the
  grouping/flatten functions are already written generically enough that this would mostly be a
  matter of extending `RegionGroup`/`FlatRow`'s shape, not restructuring.
