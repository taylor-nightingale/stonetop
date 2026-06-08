# Steading Sheet Redesign — Plan

**Goal**: Make our steading sheet's formatting match the dice-goblin reference (`/dice-goblin/Stonetop/templates/sheets/steading-sheet.hbs`) almost exactly.  
**Exception**: The Moves tab uses our existing `move-group` / `items-list` pattern instead of the reference's drag-and-drop move card pattern.

**All design decisions resolved:**

| Question | Decision |
|---|---|
| Improvements tab | Keep current choice-row display; present in 3-column panel layout (Option B) |
| Places of Interest | Keep existing numbered-list UI inside the Notes tab panel frame |
| Content categories | Keep existing editable list-of-items UI inside Notes tab panel frames |
| Neighbor roster | Keep 4 columns (Name / Occupation / Traits / Home) |
| Icon style | Adopt PNG icons (`delete-icon.png`, `plus-icon.png`, `edit-icon.png`); set up shared CSS utility so all sheets can use them |

---

## ✅ Phase 0: Icon PNG Asset Setup (prerequisite for all other phases)

**Files**: `assets/icons/` (new directory), `stonetop.css`

The reference uses PNG icons for delete, add, and edit actions rather than Font Awesome glyphs. These three files exist in the reference project and do not exist in ours:
- `/dice-goblin/Stonetop/assets/icons/delete-icon.png`
- `/dice-goblin/Stonetop/assets/icons/plus-icon.png`
- `/dice-goblin/Stonetop/assets/icons/edit-icon.png`

### Steps

1. Copy all three PNGs from the reference into `assets/icons/` in our project.
2. Add shared CSS utility classes that any sheet can use without repeating `<img>` path strings:

```css
/* Icon button base — shared across all sheets */
.stonetop-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.stonetop-icon-btn:hover { opacity: 1; }

.stonetop-icon-btn img {
  width: 16px;
  height: 16px;
  display: block;
  border: none;
  border-radius: 0;
}

/* Semantic convenience classes */
.stonetop-delete-btn { /* extends .stonetop-icon-btn */ }
.stonetop-add-btn    { /* extends .stonetop-icon-btn */ }
.stonetop-edit-btn   { /* extends .stonetop-icon-btn */ }
```

3. Usage in any template:
```html
<button class="stonetop-icon-btn stonetop-delete-btn" type="button" title="Delete" aria-label="Delete">
  <img src="systems/stonetop/assets/icons/delete-icon.png" alt="">
</button>
```

4. Existing Font Awesome `<i class="fas fa-times">` and `<i class="fas fa-plus">` usages on the steading sheet are replaced during each phase as their surrounding HTML is rewritten. Character sheet icon buttons are not changed in this plan — that is a separate future cleanup.

---

## ✅ Phase 1: Form Class Alignment

**Files**: `templates/actor/steading.hbs`, `StonetopSteadingSheet.js`

The reference CSS is entirely scoped under `form.stonetop.sheet.steading`. Our form currently uses `class="stonetop-steading-sheet"` which hits none of those rules.

Our `defaultOptions.classes` already emits `["stonetop", "sheet", "actor", "steading"]` onto the Foundry window wrapper. We need those same classes on the `<form>` element itself so that intra-form CSS selectors work.

### Changes

- `steading.hbs`: Change `<form class="stonetop-steading-sheet" autocomplete="off">` → `<form class="{{cssClass}}" autocomplete="off">`
- `StonetopSteadingSheet.js`: Change `width: 800, height: 900` → `width: 1180, height: 760`
- `stonetop.css`: Every `.stonetop-steading-sheet` selector is now orphaned. They are removed one-by-one as each subsequent phase replaces the HTML they target. A final cleanup pass in Phase 10 removes any remaining stragglers.

---

## ✅ Phase 2: Header — Stat Panel Frames

**Files**: `templates/actor/steading.hbs`, `stonetop.css`, `StonetopSteadingSheet.js`

Replace the entire current header area — `st-header`, `st-top-row`, `st-mid-row`, and the debilities section from `st-bottom-row` — with the reference's `steading-header-grid` containing seven panel frames.

### Resulting header structure

```html
<header class="sheet-header steading-top">
  <section class="steading-header-grid">

    <!-- Fortunes panel (order 1) -->
    <div class="steading-stat-panel steading-panel-frame steading-fortunes">
      [8 corner/edge spans]
      <h2><button class="steading-stat-roll" data-stat="fortunes">Fortunes</button></h2>
      <div class="steading-start-line">Starts at +1</div>
      <div class="steading-rating-options">
        {{#each stonetop.fortunes.options}}
          <label class="steading-rating-option">
            <input class="steading-box-input" type="radio" ...>
            <span class="steading-box" aria-hidden="true"></span>
            <span class="steading-option-text"><span>{{label}}</span></span>
          </label>
        {{/each}}
      </div>
    </div>

    <!-- Surplus panel (order 2) -->
    <!-- Size panel (order 3) -->
    <!-- Population panel (order 4) -->
    <!-- Prosperity panel (order 5) -->
    <!-- Defenses panel (order 6) -->
    <!-- Debilities panel (order 7) -->

  </section>
</header>
```

### Panel frame markup (identical for every panel)

Eight positioned `<span>` elements go inside each `steading-panel-frame`:
```html
<span class="panel-corner panel-corner-tl"></span>
<span class="panel-corner panel-corner-tr"></span>
<span class="panel-corner panel-corner-bl"></span>
<span class="panel-corner panel-corner-br"></span>
<span class="panel-edge panel-edge-top"></span>
<span class="panel-edge panel-edge-right"></span>
<span class="panel-edge panel-edge-bottom"></span>
<span class="panel-edge panel-edge-left"></span>
```

The PNG corner/edge assets already exist in `assets/sheet/panel-corner-*.png` and `assets/sheet/panel-edge-*.png`.

### Stat panels (Fortunes, Size, Population, Prosperity, Defenses)

Each renders from snapshot data:

| Panel | Snapshot source | Notes |
|---|---|---|
| Fortunes | `stonetop.fortunes.options` | 5 options (-1 to +3); rollable button |
| Size | `stonetop.attributes.size.options` | 4 options with notes (e.g. "hamlet <50 people") |
| Population | `stonetop.attributes.population.options` | 5 options; rollable button |
| Prosperity | `stonetop.attributes.prosperity.options` | 5 options; rollable button |
| Defenses | `stonetop.attributes.defenses.options` | 5 options with labels (feeble/mediocre/etc.); rollable button |

The rollable `<button class="steading-stat-roll" data-stat="..." data-label="...">` inside each `<h2>` triggers the roll dialog (same JS as current, class name change only).

Radio inputs use `class="steading-box-input"` and a sibling `<span class="steading-box">` for the custom visual.

### Surplus panel

```html
<div class="steading-stat-panel steading-panel-frame steading-surplus">
  [spans]
  <h2><button class="steading-stat-roll" data-stat="surplus">Surplus</button></h2>
  <div class="steading-start-line">Starts at 1</div>
  <input class="steading-surplus-input" type="number" value="{{stonetop.surplus.current}}" min="0" step="1">
</div>
```

### Debilities panel

```html
<div class="steading-debilities-panel steading-panel-frame">
  [spans]
  <h2>Debilities</h2>
  <div class="steading-debility-list">
    {{#each stonetop.debilities}}
      <label class="steading-debility-option">
        <input class="steading-circle-input" type="checkbox" data-slug="{{slug}}" {{#if active}}checked{{/if}}>
        <span class="steading-circle" aria-hidden="true"></span>
        <span>{{{description}}} <small>{{note}}</small></span>
      </label>
    {{/each}}
  </div>
</div>
```

### CSS to add (under `form.stonetop.sheet.steading`)

| Selector | Purpose |
|---|---|
| `.steading-header-grid` | Flex row, wraps 7 panels, allows wrap |
| `.steading-stat-panel` | Flex column, fixed minimum width |
| `.steading-panel-frame` | `position: relative`; padding sized to leave room for corner sprites |
| `.panel-corner` | `position: absolute`, 16×16px, background PNG per corner variant |
| `.panel-edge-top/bottom` | Absolute strip with `repeat-x` PNG, 8px tall |
| `.panel-edge-left/right` | Absolute strip with `repeat-y` PNG, 8px wide |
| `.steading-panel-frame > :not(.panel-corner):not(.panel-edge)` | `position: relative; z-index: 1` (keeps content above sprites) |
| `.steading-panel-frame h2` | Font, padding-bottom, border-bottom |
| `.steading-start-line` | Small italic text; `::before` pseudo-element draws the decorative line |
| `.steading-rating-options` | Flex column |
| `.steading-rating-option`, `.steading-debility-option` | Flex row with gap; cursor pointer |
| `.steading-box-input`, `.steading-circle-input` | `display: none` (visuals provided by sibling span) |
| `.steading-box`, `.steading-circle` | Inline-block indicators; filled state via `input:checked + .steading-box` |
| `.steading-option-text` | Flex column; `small` is lighter/smaller |
| `.steading-surplus-input` | Large centered number input; no spin arrows |
| `.steading-debilities-panel` | Same panel-frame rules; `h2` omits the roll button styling |
| `.steading-debility-list` | Flex column |
| `steading-fortunes` through `steading-defenses` | `order: 1` through `order: 6`; `steading-debilities-panel` is `order: 7` |

### JS changes in `StonetopSteadingSheet.js`

Update the selectors in `activateListeners` to match the new class names:

| Old selector | New selector |
|---|---|
| `.stonetop-fortunes-radio` | `.steading-box-input[name="stonetop-fortunes"]` |
| `.stonetop-attr-radio` | `.steading-box-input[data-attr]` |
| `.stonetop-surplus-input` | `.steading-surplus-input` |
| `.stonetop-debility-check` | `.steading-circle-input` |
| `.stonetop-stat-roll` | `.steading-stat-roll` |

The roll dialog JS logic itself does not change.

---

## ✅ Phase 3: Tab Structure

**Files**: `templates/actor/steading.hbs`, `StonetopSteadingSheet.js`

Replace the tab navigation and tab content blocks.

| Position | Old tab | New tab |
|---|---|---|
| 1 | Content | Overview (new) |
| 2 | Residents | Residents |
| 3 | Neighbors | Neighbors |
| 4 | Improvements | Improvements |
| 5 | _(none)_ | Moves (new) |
| 6 | _(none)_ | Notes (new) |

The `Content` tab is removed; its data moves into the Notes tab (Phase 9).

In `StonetopSteadingSheet.js`, change `initial: "content"` → `initial: "overview"`.

---

## ✅ Phase 4: Overview Tab (new)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`, `StonetopSteading.js`, `SteadingSnapshot.js`

3-column panel layout. Each column uses `steading-panel-frame`.

### Layout

```
steading-overview-grid
├── steading-overview-column
│   └── steading-overview-field (panel-frame)  →  h2 "Resources" + textarea
├── steading-overview-divider
├── steading-overview-column
│   └── steading-overview-field (panel-frame)  →  h2 "Defenses" + textarea
├── steading-overview-divider
└── steading-overview-column.steading-assets-column
    ├── steading-overview-field.steading-assets-text-field (panel-frame)  →  h2 "Assets" + textarea
    └── steading-asset-currency-grid
        └── 6× steading-asset-currency-frame
              Silver Purses / Silver Handfuls / Silver Coins /
              Gold Purses / Gold Handfuls / Gold Coins
```

### New data fields

The "Resources" and "Defenses" textareas are free-text notes that supplement the stat values — distinct from `attributes.prosperity.items` and `attributes.defenses.items`. The "Assets" textarea supplements the existing coinage inputs.

Add three string fields to the steading data model:

| Purpose | System path | Domain method on `StonetopSteading` |
|---|---|---|
| Resources notes | `system.resources` | `setResources(text)` |
| Defenses notes | `system.defenseNotes` | `setDefenseNotes(text)` |
| Assets text notes | `system.assetsText` | `setAssetsText(text)` |

Add these to `SteadingSnapshot` and populate in `buildSnapshot()`.

The currency grid uses the existing `stonetop.assets.coinage` array (shape: `{title, purses, handfuls, coins}`) and existing coinage event handlers unchanged.

### New event listeners

Add to `activateListeners`:
```js
html.find(".stonetop-resources-input").on("change", async ev => {
    await this._stonetopSteading.setResources(ev.currentTarget.value);
});
// Same pattern for defenseNotes, assetsText
```

### CSS to add

| Selector | Purpose |
|---|---|
| `.steading-overview-grid` | 3-equal-column flex layout |
| `.steading-overview-column` | `flex: 1; display: flex; flex-direction: column` |
| `.steading-overview-divider` | Thin decorative vertical line (or `border-left`) |
| `.steading-overview-field` | `flex: 1; display: flex; flex-direction: column` (panel-frame) |
| `.steading-overview-field textarea` | `flex: 1; resize: none` |
| `.steading-assets-column` | `display: flex; flex-direction: column; gap` |
| `.steading-assets-text-field textarea` | Shorter height (leaves room for currency grid below) |
| `.steading-asset-currency-grid` | 2×3 grid or 3-col flex-wrap |
| `.steading-asset-currency-frame` | Label wrapping a span + input; bordered |

---

## ✅ Phase 5: Residents Tab (restyling)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`

Keep current data model and event handlers. Replace layout HTML with reference structure and panel frames.

### Roster section

Wrap the table in `steading-panel-frame`. Replace the `<table>` with the reference's div-based layout:
- `.steading-residents-table` wraps the entire roster
- `.steading-residents-header` div holds three column header spans
- `.steading-residents-rows` div holds repeating `.steading-resident-row` divs
- Each row: three `<input type="text">` + delete button (PNG icon via `.stonetop-icon-btn`)
- Add-row button at the bottom of the table (plus PNG icon)

Event handlers stay bound to `data-id` attributes and call the same `residents.*` domain methods.

### Names panel (right column)

Wrap in `steading-panel-frame`. Change from a read-only `<p>` to an editable `<textarea>`:
```html
<textarea name="system.residentNames">{{stonetop.residentNames}}</textarea>
```

Add a change handler calling `this._actor.update({"system.residentNames": value})` (no domain object needed — direct field).

### NPC Traits panel (full-width, below the grid)

Wrap in `steading-panel-frame`. Add:
1. `.steading-npc-traits-heading` div containing `<h2>NPC Traits</h2>` and a subtitle `<span>`
2. A hidden `<textarea class="steading-npc-traits-source">` bound to `system.residentTraits` (allows the GM to edit the trait list, though normally it stays as default)
3. `.steading-npc-traits-columns` div containing 5 `.steading-npc-traits-column` divs, each a list of `.steading-npc-trait` divs

The 5-column split is computed in the snapshot. Add `npcTraitColumns` to `SteadingSnapshot` and populate it in `buildSnapshot()` by splitting `residentTraits` (newline-separated) into 5 equal-length arrays.

### CSS to add

`steading-residents-grid`, `steading-residents-roster`, `steading-residents-divider`, `steading-resident-names`, `steading-residents-table`, `steading-residents-header`, `steading-resident-row`, `steading-delete-resident`, `steading-add-resident`, `steading-npc-traits`, `steading-npc-traits-heading`, `steading-npc-traits-source`, `steading-npc-traits-columns`, `steading-npc-traits-column`, `steading-npc-trait`

---

## ✅ Phase 6: Neighbors Tab (restyling)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`, `StonetopSteadingSheet.js`

Keep current data model and event handlers. Adopt reference structure with panel frames.

### Neighbors roster (left column)

Wrap in `steading-panel-frame`. Use the same div-based table pattern as residents (Phase 5). Keep 4 columns: Name / Occupation / Traits / Home. Delete and add buttons use PNG icons.

### Neighbor places (right column)

Change from the current place-box layout to 5 fixed `steading-neighbor-place steading-panel-frame` sections:

```html
<section class="steading-neighbor-place steading-panel-frame">
  [8 corner/edge spans]
  <h2>Marshedge</h2>
  <label class="steading-neighbor-text-field">
    <span>Notes</span>
    <textarea class="stonetop-neighbor-place-note" data-id="marshedge" ...>{{notes}}</textarea>
  </label>
  <label class="steading-neighbor-text-field">
    <span>Names</span>
    <textarea class="stonetop-neighbor-place-names" data-id="marshedge" ...>{{names}}</textarea>
  </label>
</section>
```

The `NeighborPlaces.updateNames()` method already exists. Add the event listener in `StonetopSteadingSheet.js`:
```js
html.find(".stonetop-neighbor-place-names").on("change", async ev => {
    await this._stonetopSteading.neighborPlaces.updateNames(ev.currentTarget.dataset.id, ev.currentTarget.value);
});
```

The 5 place IDs (`marshedge`, `gordins-delve`, `the-steplands`, `lygos`, `other-places`) must be present in the snapshot data. Confirm that `NeighborPlaces.buildSnapshot()` returns all 5 with default `names` text populated (Marshedge names list, Gordin's Delve note, etc.) — mirror the defaults already in the reference's `_getNeighborPlaces`.

### CSS to add

`steading-neighbors-grid`, `steading-neighbors-roster`, `steading-neighbors-divider`, `steading-neighbor-places`, `steading-neighbor-place`, `steading-neighbor-text-field`

---

## ✅ Phase 7: Improvements Tab (3-column choice-row layout)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`

Keep the existing `stonetop.improvements` choice-row data model entirely. Display it in the reference's 3-column visual structure.

### Layout

```
steading-improvements-grid
├── steading-improvement-column (data-column="left")
│   └── For each improvement group assigned to left:
│       <div class="steading-improvement-group steading-panel-frame">
│         [corner/edge spans]
│         <h3>{{group label}}</h3>
│         {{#each list}} {{> "stonetop.choice-row"}} {{/each}}
│       </div>
├── steading-improvements-divider
├── steading-improvement-column (data-column="middle")
│   └── ...
├── steading-improvements-divider
└── steading-improvement-column (data-column="right")
    └── ...
```

### Column assignment

Improvement groups are assigned to columns based on their order in `stonetop.improvements`. Split the array into thirds: first third goes left, second goes middle, last goes right. This is a pure template computation (no new data model fields needed). If the groups do not divide evenly, the last column gets the remainder.

### No JS changes required

The existing improvement change handler in `StonetopSteadingSheet.js` (the delegated event on `.stonetop-cg-track[data-cg-context="improvement"]`) already works regardless of column structure.

### CSS to add

| Selector | Purpose |
|---|---|
| `.steading-improvements-grid` | 3-equal-column flex layout with dividers |
| `.steading-improvement-column` | `flex: 1; display: flex; flex-direction: column; gap` |
| `.steading-improvements-divider` | Thin vertical decorative line |
| `.steading-improvement-group` | `panel-frame` wrapping each improvement group |
| `.steading-improvement-group h3` | Heading inside the panel |

---

## ✅ Phase 8: Moves Tab (new — our style)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`, `StonetopSteading.js`, `SteadingSnapshot.js`, `StonetopSteadingSheet.js`

New tab using the existing `stonetop.move-group` partial. Does not use the reference's drag-and-drop card format.

### Template structure

```hbs
<div class="tab" data-group="primary" data-tab="moves">
  <section class="sheet-tab">
    {{#each stonetop.moves}}
      {{> "stonetop.move-group" title=label moves=moves categoryKey=key allowAdditional=false}}
    {{/each}}
    {{#unless stonetop.moves}}
      <p class="stonetop-moves-empty">No homefront moves assigned.</p>
    {{/unless}}
  </section>
</div>
```

### Data model additions

Add a `moves` field to `SteadingSnapshot`. In `StonetopSteading.buildSnapshot()`, collect embedded items of type `"move"` with `category === "homefront"` and build move snapshots matching the shape that `move-group.hbs` expects:

```js
{
  label: "Homefront Moves",
  key: "homefront",
  moves: [ ...homefront move snapshots... ]
}
```

This likely needs a `SteadingMoves` class that reads `actor.items`, filters for homefront moves, and produces the snapshot. The snapshot shape per move: `{name, slug, ownedId, rollStat, selection, description, choices, isStarting, selectable, ...}`.

### Event listeners

Add handlers in `StonetopSteadingSheet.js` for:
- `.stonetop-move-check` — toggle move selection (reuse same logic as character sheet)
- `.move-rollable` — trigger roll via `ActorRolling` (steading stats instead of character stats)

### CSS

No new CSS needed — the existing `stonetop-move-group`, `items-list`, and `stonetop-item` styles already apply to any sheet with class `stonetop.sheet`.

---

## ✅ Phase 9: Notes Tab (new)

**Files**: `templates/actor/steading.hbs`, `stonetop.css`

New tab consolidating Places of Interest, the three content categories, and Notes into the reference's 3-column panel layout.

### Layout

```
steading-notes-grid
├── steading-notes-column
│   └── steading-notes-field (panel-frame)
│       ├── h2 "Places of Interest"
│       └── [existing numbered-list UI: .st-places-grid with inputs + add button]
├── steading-notes-divider
├── steading-notes-column.steading-notes-content-column
│   ├── steading-notes-field.steading-notes-content-field (panel-frame)
│   │   ├── h2 "Excluded Content"
│   │   └── [existing list-of-items UI for excluded slug]
│   ├── steading-notes-field.steading-notes-content-field (panel-frame)
│   │   ├── h2 "Veiled Content"
│   │   └── [existing list-of-items UI for veiled slug]
│   └── steading-notes-field.steading-notes-content-field (panel-frame)
│       ├── h2 "Special Handling"
│       └── [existing list-of-items UI for special slug]
├── steading-notes-divider
└── steading-notes-column
    └── steading-notes-field (panel-frame)
        ├── h2 "Notes"
        └── textarea bound to stonetop.notes
```

Places of Interest retains its current numbered-list UX (`.st-places-grid` inputs and add button) inside the panel frame. The event handlers remain unchanged.

The three content panels each render their existing `stonetop-steading-content-group` rows with add/remove per item — same as the current Content tab — now inside panel frames.

The main-sheet `st-bottom-row` (which currently holds Places of Interest and Notes) is removed from the template. The Notes textarea handler (`stonetop-notes`) remains unchanged.

### CSS to add

| Selector | Purpose |
|---|---|
| `.steading-notes-grid` | 3-column flex layout |
| `.steading-notes-column` | `flex: 1; display: flex; flex-direction: column` |
| `.steading-notes-divider` | Thin vertical line |
| `.steading-notes-field` | `flex: 1; display: flex; flex-direction: column` (panel-frame) |
| `.steading-notes-field textarea` | `flex: 1; resize: none` |
| `.steading-notes-content-column` | Flex column with gap (3 stacked panels) |
| `.steading-notes-content-field` | Flex: 1; each takes equal share of column height |

---

## ✅ Phase 10: CSS Cleanup Pass

**Files**: `stonetop.css`

A final cleanup pass after all phases are done.

1. Remove all `st-*` selectors that were part of the old steading layout (`st-header`, `st-top-row`, `st-mid-row`, `st-bottom-row`, `st-places`, `st-debilities-col`, `st-notes-col`, `st-stat-box`, `st-stat-icon`, `st-stat-content`, `st-stat-title`, `st-stat-note`, `st-radio-label`, `st-asset-coinage`, `st-stat-divider`, `st-mid-row`, `st-mid-block`, `st-mid-stat`, `st-item-list`, `st-item-list-title`, `st-extra-row`, `st-residents-layout`, `st-residents-col`, `st-residents-sidebar`, `st-neighbor-people-col`, `st-neighbor-places-col`, `st-neighbor-place-box`, `st-neighbor-place-header`, `st-neighbor-place-body`, `st-improvements-list`, etc.)
2. Remove any remaining `.stonetop-steading-sheet` selectors.
3. Confirm all new panel-frame rules are correctly scoped under `form.stonetop.sheet.steading` to avoid leaking into character sheets.
4. Verify that the shared `stonetop-icon-btn` rules (Phase 0) are scoped under `.stonetop` (window-level) so they work on any sheet.

---

## Implementation Order Summary

| Phase | Name | Key files touched | Depends on |
|---|---|---|---|
| 0 | Icon PNG assets | `assets/icons/`, `stonetop.css` | — |
| 1 | Form class alignment | `steading.hbs`, `StonetopSteadingSheet.js` | 0 |
| 2 | Header stat panels | `steading.hbs`, `stonetop.css`, `StonetopSteadingSheet.js` | 1 |
| 3 | Tab structure | `steading.hbs`, `StonetopSteadingSheet.js` | 2 |
| 4 | Overview tab | `steading.hbs`, `stonetop.css`, `StonetopSteading.js`, `SteadingSnapshot.js` | 3 |
| 5 | Residents tab | `steading.hbs`, `stonetop.css`, `SteadingSnapshot.js` | 3 |
| 6 | Neighbors tab | `steading.hbs`, `stonetop.css`, `StonetopSteadingSheet.js` | 3 |
| 7 | Improvements tab | `steading.hbs`, `stonetop.css` | 3 |
| 8 | Moves tab | `steading.hbs`, `StonetopSteading.js`, `SteadingSnapshot.js`, `StonetopSteadingSheet.js` | 3 |
| 9 | Notes tab | `steading.hbs`, `stonetop.css` | 3 |
| 10 | CSS cleanup | `stonetop.css` | 4–9 |

Phases 4–9 are independent once Phase 3 is done and can be completed in any order.
