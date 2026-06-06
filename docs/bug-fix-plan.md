# Bug Fix Plan

## Overview

Six renderer bugs + one missing side-effect handler discovered after the
ChoiceGroupFactory / playbook-choices-collapse refactor. Work is split into
independent phases that can be implemented and verified one at a time.

---

## Phase 1 — Pack data fixes (data only, no code)

### 1a. Ghost moves — wrong `playbook` field
`packs/src/post-death-moves/ghost/{disembodied,tethered,unliving}.json`
all have `"playbook": "revenant"`. Change to `"playbook": "ghost"`.
Recompile the `post-death-moves` pack.

### 1b. Collapse move packs into a single `moves` pack
Current packs: `basic-moves`, `playbook-moves`, `special-moves`,
`follower-moves`, `homefront-moves`, `post-death-moves`.
Merge into one `moves` pack using sub-folders:
`moves/basic`, `moves/playbook`, `moves/special`, `moves/followers`,
`moves/homefront`, `moves/post-death`.
Update `system.json` `"packs"` entry. Update `FoundryMoveRepository` pack
reference. Recompile.

---

## Phase 2 — Instinct revert + shared instinct abstraction

**Problem:** instinct has a special two-part UI — a text input on top that
shows the computed selection/custom value, and pick options below. This
pattern cannot be rendered by the generic `choice-section` partial. Collapsing
instinct into the generic `choices[]` array was the wrong abstraction for both
playbooks and inserts.

### Schema changes
- `PlaybookData`: add `instinct: new f.ObjectField({ nullable: true, initial: null })`
  (keep it out of `choices[]`)
- `InsertData`: add `instinct: new f.ObjectField({ nullable: true, initial: null })`

### Pack data
- **9 playbook JSON files**: remove `choices[0]` (the instinct group) and
  place it as `system.instinct`.
- **3 insert JSON files** (ghost, revenant, thrall): remove `choices[0]` (the
  instinct group) and place it as `system.instinct`.

### ChoiceGroupFactory — `_smartDefaultDef` update
Add a check for the named instinct field before the `choices[]` array walk:

```js
if (ns === "instinct" && item.system?.instinct?.slug === "instinct")
    return item.system.instinct;
```

This means `forItem` and `forItemType` controllers will find instinct
definitions via `system.instinct` automatically, for both playbooks and
inserts. No per-call opts needed.

### CharacterPlaybook
`buildPlaybookSnapshot` reads instinct definition from `item.system.instinct`
(not from `choices[]`) and builds `instinctGroup: ChoiceGroup|null` from it.
`selectChoice` / `selectCustomInstinct` / `setChoiceText` for instinct continue
to write to `choiceValues.instinct` as before — no change to storage.

### CharacterInserts — `_buildOne`
Reads instinct definition from `item.system.instinct`, builds
`instinctGroup: ChoiceGroup|null`. Non-instinct choices come from `system.choices[]`.

### Snapshot changes
- `PlaybookSnapshot`: add `instinctGroup: ChoiceGroup|null`
- `InsertSnapshot`: add `instinctGroup: ChoiceGroup|null`
- `PlaybookSnapshotBuilder / InsertSnapshotBuilder`: add `withInstinctGroup(v)`

### TestPlaybookItemBuilder / TestInsertItemBuilder
Add `withInstinct(def)` method (separate from `withChoices`).

### Shared instinct abstraction — `InstinctController`

The instinct pattern is identical across playbooks and inserts:
- Definition lives in `system.instinct` (a ChoiceGroup def object)
- Values stored at `choiceValues.instinct`
- Display computed from checked option or `__custom` text
- Operations: `selectOption`, `selectCustom`, `setText`

Extract a `InstinctController` class (or thin wrapper) that encapsulates this
pattern. Both `CharacterPlaybook` and `CharacterInserts._buildOne` delegate to
it. The controller receives a `ChoiceGroupController` scoped to the instinct
namespace and computes `instinctSelected`:

```js
export class InstinctController {
    constructor(ctrl) { this._ctrl = ctrl; }

    async selectOption(slug, siblingSlugsCsv) {
        await this._ctrl.selectOption("instinct", slug, siblingSlugsCsv);
        await this._ctrl.setText("instinct", "__custom", "");
    }

    async selectCustom(text) {
        await this._ctrl.clearValues("instinct");
        await this._ctrl.setText("instinct", "__custom", text);
    }

    async setText(optionSlug, text) {
        if (optionSlug === "__custom") await this._ctrl.clearValues("instinct");
        await this._ctrl.setText("instinct", optionSlug, text);
    }

    computeSelected(group /* ChoiceGroup */, choiceValues) {
        const checkedOption = group?.list[0]?.options?.find(o => o.checked) ?? null;
        if (checkedOption) return `${checkedOption.text} — ${checkedOption.description}`;
        return choiceValues.getText("instinct", "__custom") || null;
    }
}
```

`CharacterPlaybook` creates one `InstinctController` for the playbook.
`CharacterInserts` creates one per insert (scoped to that item's controller).

### Shared instinct partial — `instinct-section.hbs`

The HTML pattern (text input + pick options) is identical for both playbook
and insert tabs. Extract it to a partial `instinct-section.hbs` that accepts:
- `instinctSelected` — current display value
- `instinctGroup` — the `ChoiceGroup` for the pick options
- `namePrefix` — disambiguates radio group names across multiple inserts
- `cgContext` — for pick dispatch (`"instinct"` / `"insert-pick"`)

Used in both `tab-details.hbs` (playbook instinct) and `tab-insert.hbs`.

### Migration — no changes needed
`migratePlaybookChoiceValues` already reads `instinctValues` and
`instinct.custom` and writes to `choiceValues.instinct`. The storage side
is unchanged. The new `system.instinct` field is purely definitional (read-only
from pack data); no migration of instinct values is needed.

---

## Phase 3 — Arcana null guard

**Problem:** `Arcanum.constructor` does `new ArcanumFront(data.front)`.
If `data.front` is `null` (initial value in `ArcanumData`), the constructor
throws. This causes `CharacterArcana.buildSnapshot` to throw, which propagates
out of `Promise.all` in `StonetopCharacter.buildSnapshot`, silently preventing
the entire sheet from rendering.

**Fix:** `src/model/data/character/Arcanum.js`
```js
this.front = new ArcanumFront(data.front ?? {});
```
`ArcanumBack` already has `data.back ?? {}`, so the same pattern.

**Test:** add a test in `CharacterArcana.test.js` for an arcanum item with
`system.front = null` — `buildSnapshot` must not throw.

---

## Phase 4 — PlaybookSnapshot computed view fields

The `tab-details.hbs` template needs to reference appearance and lore groups
without a JS filter helper. Add computed properties to `PlaybookSnapshot`:

- `appearanceGroup: ChoiceGroup|null` — `choices.find(c => c.slug === "appearance") ?? null`
- `loreGroups: ChoiceGroup[]` — `choices.filter(c => c.slug !== "appearance")`
  (instinct is already a separate field; remaining choices are lore)

`PlaybookSnapshotBuilder`: add `withAppearanceGroup(v)` and `withLoreGroups(v)`.
`CharacterPlaybook.buildPlaybookSnapshot`: compute and set both fields.
Tests updated for new snapshot shape.

---

## Phase 5 — Template fixes

### 5a. `tab-details.hbs`
Replace all old snapshot references:

| Old | New |
|---|---|
| `stonetop.playbook.instinct.selected` | `stonetop.playbook.instinctSelected` |
| `stonetop.playbook.instinct.group` | `stonetop.playbook.instinctGroup` |
| `stonetop.playbook.instinct.group.list` | `stonetop.playbook.instinctGroup.list` |
| `stonetop.playbook.appearance.length` | `stonetop.playbook.appearanceGroup` |
| `stonetop.playbook.appearance` (each) | `stonetop.playbook.appearanceGroup.list` |
| `stonetop.playbook.lore` (groups) | `stonetop.playbook.loreGroups` |

### 5b. `character.hbs`
Replace the static post-death tab with dynamic insert tabs:

**Nav:**
```hbs
{{#if stonetop.postDeathInsert}}
<a class="item" data-tab="post-death">...</a>
{{/if}}
```
→
```hbs
{{#each stonetop.inserts}}
<a class="item" data-tab="insert-{{slug}}">{{name}}</a>
{{/each}}
```

**Body:**
```hbs
{{> "stonetop.tab-post-death"}}
```
→
```hbs
{{#each stonetop.inserts}}
{{> "stonetop.tab-insert" insert=this}}
{{/each}}
```

Delete `{{> "stonetop.tab-post-death"}}` from the body. Keep `tab-post-death.hbs`
temporarily (or delete it — it is dead code after this change).

Register `stonetop.tab-insert` partial in `stonetop.js`.

### 5c. New `tab-insert.hbs`
Renders one insert. Template receives `insert` (an `InsertSnapshot`).
Wrap content in `<div data-insert-item-id="{{insert.id}}">` so event
handlers can retrieve the item ID by walking the DOM.

Structure:
```hbs
<div class="tab insert insert-{{insert.slug}}"
     data-group="primary" data-tab="insert-{{insert.slug}}"
     data-insert-item-id="{{insert.id}}">
  <section class="sheet-tab">
    <div class="stonetop-pdi-header">
      <h3>{{insert.name}}</h3>
      <button class="stonetop-pdi-remove" data-insert-item-id="{{insert.id}}">…</button>
    </div>
    {{#if insert.description}}<div>{{{insert.description}}}</div>{{/if}}

    {{! Generic choices (lore / consequences / etc.) }}
    {{> "stonetop.choice-section" groups=insert.choices cgContext="insert"}}

    {{! Instinct — special two-part section }}
    {{#if insert.instinctGroup}}
    <div class="details-section">
      {{> "stonetop.section-heading" title=... note=...}}
      <div class="stonetop-instinct-options">
        {{#each insert.instinctGroup.list}}
        {{> "stonetop.choice-row" radio=true namePrefix="insert-instinct-{{../insert.slug}}"
            cgContext="insert-pick"}}
        {{/each}}
      </div>
    </div>
    {{/if}}

    {{! Moves }}
    {{#if insert.moves.length}}
    {{> "stonetop.move-group" moves=insert.moves ...}}
    {{/if}}
  </section>
</div>
```

---

## Phase 6 — Sheet event wiring for insert choices

**Problem:** All insert choice interactions need to call
`setInsertChoiceCount(itemId, group, option, count)` /
`setInsertChoicePick(itemId, group, option, siblings)` /
`setInsertChoiceText(itemId, group, option, value)`.
The item ID is available on the ancestor `[data-insert-item-id]` element.

**`StonetopCharacterSheet.js` — modify existing cg handlers:**

In each of the three handlers (`.stonetop-cg-track`, `.stonetop-cg-pick`,
`.stonetop-cg-text`), before the existing dispatch, check for the insert
ancestor:

```js
const insertEl = el.closest("[data-insert-item-id]");
if (insertEl) {
    const itemId = insertEl.dataset.insertItemId;
    // route to setInsertChoiceCount / setInsertChoicePick / setInsertChoiceText
    return;
}
// existing dispatch...
```

**Remove the old pdi-lore / pdi-instinct context dispatch** from
`StonetopCharacter.setChoiceCount` / `setChoicePick` / `setChoiceText` if
present (they were never wired and are dead code).

---

## Phase 7 — OutfitItemSideEffectHandler registration

**Problem:** `OutfitItemSideEffectHandler` was designed and implemented but
never registered on the factory in `StonetopCharacter`.

**Fix:** `StonetopCharacter.constructor`:
```js
import { FollowerSideEffectHandler, OutfitItemSideEffectHandler }
    from "./SideEffectHandler.js";
// ...
factory.register(new FollowerSideEffectHandler(this._followers));
factory.register(new OutfitItemSideEffectHandler("choice", outfitItems));
```

`outfitItems` is still passed directly to `CharacterArcana`,
`CharacterPossessions`, and `CharacterInventory` for their non-choice-group
outfit syncing — that is correct and intentional.

**Test:** verify `OutfitItemSideEffectHandler.apply` fires when a choice row
with `outfitItems` is selected.

---

## Phase 8 — Move choice groups not rendering (investigation)

**Symptom:** moves in the "other" category with `system.choices` do not show
their choice groups in the UI.

**Suspected cause:** moves added via `_addCategoryMoves` don't have `choices`
or `pickValues` set (the helper only sets a subset of fields). Only moves
drag-dropped directly have the full system. Need to verify in the running
game whether it's a data issue (choices field missing on embedded item) or a
template/snapshot issue.

**Investigation steps:**
1. Open browser console, call `game.actors.getName("...").items` and check
   whether the embedded move item has `system.choices`.
2. If missing: `_addCategoryMoves` needs to copy `choices` from the compendium
   item when creating the embedded item.
3. If present: check `_buildMoveSnapshot` return value in the snapshot.

---

## Implementation order

Phase 1a → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

DONE - **1a** (ghost move data): standalone
DONE - **1b** (move pack consolidation): standalone, can run in parallel with 2–7
DONE - **2** (instinct revert + shared abstraction): standalone; must precede 4 and 5
DONE - **3** (arcana null guard): standalone (MIS-IDENTIFIED BUG SOURCE)
DONE - **4** (PlaybookSnapshot view fields): requires Phase 2
DONE - **5a** (tab-details template): requires Phase 4
DONE - **5b–5c** (character.hbs + tab-insert.hbs): requires Phase 2; uses `instinct-section.hbs` from Phase 2
DONE - **6** (sheet event wiring): requires Phase 5b–5c
DONE - **7** (OutfitItemSideEffectHandler): standalone
DONE - **8** (move choices investigation): last — needs running game to verify
DONE - **9** dragging a new playbook onto the sheet doesn't update the details tab, or the playbook icons at the top. It keeps adding to special possessions instead of removing old ones
