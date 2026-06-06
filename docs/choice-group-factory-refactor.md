# ChoiceGroupFactory + Playbook Choices Collapse

## Context

`ChoiceGroupController` has two problems. First, it is recreated on every mutation call — each domain class calls `ChoiceGroupController.forItem(actor, itemId, field, { followers, outfitItems, definitionGetter })` inline, re-passing the same dependencies every time. Second, the `followers` and `outfitItems` side-effect dependencies create a conceptual circular dependency and make each call site responsible for knowing what side effects apply.

Separately, the playbook item stores `instinct`, `appearance`, and `lore` as three separate definition fields with three separate value fields (`instinctValues`, `appearanceValues`, `actor.system.lore`). This is inconsistent with inserts, which already use a single `choices[]` array and `choiceValues` object — a cleaner, uniform shape.

The goal is to:
1. Replace `ChoiceGroupController`'s static factory methods with a `ChoiceGroupFactory` class that holds shared state (actor, registered side-effect handlers). Domain classes store a controller as a field instead of rebuilding it on every call.
2. Move follower and outfit-item side effects into dedicated handler classes, registered on the factory — eliminating the circular dependency.
3. Collapse `instinct`, `appearance`, and `lore` into a single `choices[]` + `choiceValues` field on the playbook item, matching the insert shape exactly.

---

## Phase 1 — Pack data + schema: collapse playbook choices

### Pack files (9 playbooks under `packs/src/playbooks/`)

For each playbook, move `system.instinct` and `system.appearance` into the `system.choices[]` array (instinct at index 0, appearance at index 1). Move each element of `system.lore[]` into `system.choices[]` after them. Remove the top-level `instinct`, `appearance`, and `lore` keys.

Before (the-blessed):
```json
"instinct": { "slug": "instinct", "list": [...] },
"appearance": { "slug": "appearance", "list": [...] },
"lore": [{ "slug": "the-earth-mother", "list": [...] }]
```

After:
```json
"choices": [
  { "slug": "instinct", "list": [...] },
  { "slug": "appearance", "list": [...] },
  { "slug": "the-earth-mother", "list": [...] }
],
"choiceValues": {}
```

### `src/data/PlaybookData.js`

- Add `choices: new f.ArrayField(new f.ObjectField())`
- Add `choiceValues: new f.ObjectField()`
- Remove `instinct`, `appearance`, `lore` (definition fields — now in pack data `choices[]`)
- **Keep** `instinctValues`, `appearanceValues` (migration reads them — removed in follow-up)

### `src/data/CharacterData.js`

- **Keep** `instinct: { custom }` and `lore: { values }` — migration reads them, removed in follow-up

---

## Phase 2 — ChoiceGroupFactory + SideEffectHandlers (TDD)

### New: `src/actors/character/ChoiceGroupFactory.js`

```js
class ChoiceGroupFactory {
    constructor(actor)          // stores actor, initialises _handlers = []
    register(handler)           // adds to _handlers, returns this (fluent)
    forItem(itemId, valueField) // creates a controller bound to specific item ID
    forItemType(type, valueField, definitionGetter = null)
                                // creates a controller with lazy item-type lookup;
                                // can be stored as a constructor field
}
```

`forItem` default definition getter: checks `item.system.choices` as array, then as single object (`choices.slug === ns`), then `item.system.back?.choices` — handles arcana, moves, inserts, and followers without needing a custom getter.

`forItemType` stores the provided `definitionGetter` (or falls back to the same smart default). Because item lookup is a fresh closure each call, the controller correctly follows item replacement (e.g., a new playbook item).

### New: `src/actors/character/SideEffectHandler.js`

```js
class FollowerSideEffectHandler {
    constructor(followers)
    async apply(target, namespace, optionSlug, count)
    // respects target.followers[] array and legacy target.type === "follower"
}

class OutfitItemSideEffectHandler {
    constructor(outfitItems)
    async apply(target, namespace, optionSlug, count)
    // no-ops when target.outfitItems is absent
}
```

### Modify: `src/actors/character/ChoiceGroupController.js`

- **Delete** `static forActorSection(...)` — no production callers
- **Delete** `addGroup(...)` — no production callers
- **Delete** `buildGroupSnapshot(...)` — no production callers
- **Delete** `buildGroupSnapshotFromDef(...)` — no production callers
- Constructor signature: `({ reader, writer, definitionGetter, handlers = [] })`
  - Remove `followers`, `outfitItems`, `definitionStore`
  - Add `handlers`
- `_fireSideEffects`: replace the two hard-coded blocks with `for (const h of this._handlers) await h.apply(target, ...)`

### Rewrite: `tests/actors/character/ChoiceGroupController.test.js`

All tests currently use `forActorSection` + `addGroup` + `buildGroupSnapshot`. Replace the setup pattern with item-based:

```js
function makeItemCtrl(choices = []) {
    const item = { _id: "i1", type: "test", system: { choiceValues: {}, choices } };
    const actor = new FakeActorBuilder().withItems([item]).build();
    const factory = new ChoiceGroupFactory(actor);
    return { ctrl: factory.forItem("i1", "choiceValues"), actor, item };
}
```

Assert on `actor.items.get("i1").system.choiceValues` directly — no `buildGroupSnapshot`.

### New: `tests/actors/character/ChoiceGroupFactory.test.js`

- `forItem` and `forItemType` create working controllers
- `forItemType` re-resolves item on each write (follows item replacement)
- Registered handlers are called during `selectOption`/`setCount`
- Multiple handlers called in registration order
- Handler registered after factory construction but before `forItem` call is included (shared array reference)

### New: `tests/actors/character/SideEffectHandler.test.js`

- `FollowerSideEffectHandler.apply` adds follower when count > 0, removes when 0
- Handles `target.followers[]` and legacy `target.type === "follower"`
- `OutfitItemSideEffectHandler.apply` syncs items when count > 0, deletes when 0
- No-ops when `target.outfitItems` is absent

---

## Phase 3 — Wire domain classes to factory

### `src/actors/character/StonetopCharacter.js`

Constructor changes:
```js
const factory = new ChoiceGroupFactory(actor);
// ... construct followers and outfitItems first ...
factory.register(new FollowerSideEffectHandler(this._followers));
factory.register(new OutfitItemSideEffectHandler(outfitItems));
// inject factory into all domain classes
```

- Remove `this._instinct`, `this._appearance`, `this._lore`
- Remove `get instinct()`, `get appearance()` accessors
- Update `CharacterPlaybook` constructor call (remove instinct/appearance/lore args)
- Update `setChoicePick`: "instinct" → `this._playbook.selectChoice("instinct", ...)` ; "appearance" → `this._playbook.selectChoice("appearance", ...)`
- Update `setChoiceCount`/`setChoiceText`: remove "lore" case; add "playbook-choice" case → `this._playbook.setChoiceCount(...)` / `this._playbook.setChoiceText(...)`

### `src/actors/character/CharacterPlaybook.js`

Constructor: `(actor, background, factory, origin)`

```js
this._ctrl = factory.forItemType("playbook", "choiceValues");
```

Add methods:
```js
async selectChoice(groupSlug, optionSlug, siblingsCsv)
    // if groupSlug === "instinct": also setText("instinct", "__custom", "")
async selectCustomInstinct(text)
    // clearValues("instinct") then setText("instinct", "__custom", text)
async setChoiceCount(groupSlug, optionSlug, count)
async setChoiceText(groupSlug, optionSlug, text)
    // if groupSlug === "instinct" && optionSlug === "__custom": clearValues first
```

Update `buildPlaybookSnapshot`:
- Replace `this._instinct.buildSnapshot(data.instinct)`, `this._appearance.buildSnapshot(data.appearance)`, `this._lore.buildSnapshot(data.lore)` with single choices computation:
```js
const choiceValues = new ChoiceValues(item.system.choiceValues ?? {});
const choices = (item.system.choices ?? []).map(g => ChoiceGroup.fromPackData(g, choiceValues));
```
- Compute `instinctSelected` from the instinct group's checked option or `choiceValues["instinct"]["__custom"]`

### `src/actors/character/CharacterBackgrounds.js`

Constructor: `(actor, factory, resourceController)`

```js
this._ctrl = factory.forItemType("playbook", "backgroundValues",
    (ns, item) => item?.system?.backgrounds?.find(b => b.slug === ns)?.choices ?? null
);
```

`setChoiceValue` becomes: `await this._ctrl.setCount(namespace, optionSlug, count)`

### `src/actors/character/CharacterArcana.js`

Constructor receives `factory`. Replace:
- `ChoiceGroupController.forItem(actor, item._id, "unlockValues")` → `factory.forItem(item._id, "unlockValues")`
- `ChoiceGroupController.forItem(actor, item._id, "backChoiceValues", { followers, definitionGetter })` → `factory.forItem(item._id, "backChoiceValues")` (followers now in factory; default getter handles `item.system.back?.choices`)

### `src/actors/character/CharacterMoves.js`

Constructor receives `factory`. Replace both `ChoiceGroupController.forItem(actor, item._id, "pickValues", ...)` calls with `factory.forItem(item._id, "pickValues")` (no definitionGetter needed — no side effects on move choices).

### `src/actors/character/CharacterFollowers.js`

Constructor receives `factory`. Replace both `ChoiceGroupController.forItem(actor, item._id, "choiceValues")` calls with `factory.forItem(item._id, "choiceValues")`.

### `src/actors/character/CharacterInserts.js`

Constructor: `(actor, factory, moves)`. Replace all three `ChoiceGroupController.forItem(...)` calls with `factory.forItem(itemId, "choiceValues")` (followers now in factory).

### Delete

- `src/actors/character/CharacterInstincts.js`
- `src/actors/character/CharacterAppearance.js`
- `src/actors/character/CharacterLore.js`
- `tests/actors/character/CharacterInstincts.test.js`
- `tests/actors/character/CharacterAppearance.test.js`

---

## Phase 4 — Snapshot changes

### `src/model/snapshot/character/PlaybookSnapshot.js`

`PlaybookSnapshot` replaces `instinct`, `appearance`, `lore` with:
- `choices: ChoiceGroup[]` — all choice groups from playbook `choices[]` mapped with values
- `instinctSelected: string|null` — computed display label (checked option text+description, or `__custom` value)

`PlaybookSnapshotBuilder`: replace `withInstinct`, `withAppearance`, `withLore` with `withChoices`, `withInstinctSelected`.

---

## Phase 5 — Migration

### `src/migration/migrateCharacter.js`

Add `migratePlaybookChoiceValues(actor)` (step M), wired into `migrateCharacter` after `migrateChoiceValues`:

```js
export async function migratePlaybookChoiceValues(actor) {
    const pbItem = [...actor.items].find(i => i.type === "playbook") ?? null;
    if (!pbItem) return;
    if (Object.keys(pbItem.system?.choiceValues ?? {}).length) return; // already migrated

    const instinctValues  = pbItem.system?.instinctValues  ?? {};
    const appearanceValues = pbItem.system?.appearanceValues ?? {};
    const loreValues      = actor.system?.lore?.values     ?? {};
    const customInstinct  = actor.system?.instinct?.custom ?? "";

    const merged = { ...loreValues, ...instinctValues, ...appearanceValues };
    if (customInstinct && !Object.values(merged.instinct ?? {}).some(v => v > 0)) {
        merged.instinct = { ...merged.instinct, __custom: customInstinct };
    }
    if (!Object.keys(merged).length) return;

    await actor.updateEmbeddedDocuments("Item", [{ _id: pbItem._id, system: { choiceValues: merged } }]);
}
```

Update `migrateChoiceValues` (step J): write to `choiceValues` instead of `instinctValues`/`appearanceValues` on the playbook item (so the old flag path also lands in the right field).

Update `migrateCharacterFlags`: remove the `system.lore.values` and `system.instinct.custom` writes (those fields will be removed from CharacterData in the follow-up).

---

## Phase 6 — Follow-up (separate PR, after migration has run)

- Remove `instinctValues`, `appearanceValues` from `PlaybookData`
- Remove `instinct: { custom }`, `lore: { values }` from `CharacterData`
- Clean up any migration code that reads those fields

---

## Verification

```bash
npx vitest run
```

All tests pass. New test files:
- `tests/actors/character/ChoiceGroupFactory.test.js`
- `tests/actors/character/SideEffectHandler.test.js`

Deleted test files:
- `tests/actors/character/CharacterInstincts.test.js`
- `tests/actors/character/CharacterAppearance.test.js`
- `tests/actors/character/ChoiceGroupController.test.js` (rewritten, not deleted)

Key behaviors to verify via snapshot assertions after each phase:
- Selecting an instinct option stores `choiceValues["instinct"][slug] = 1`
- Selecting custom instinct stores `choiceValues["instinct"]["__custom"] = text` and clears pick values
- Selecting appearance stores `choiceValues["appearance"][slug] = 1`
- Lore entry track count stores `choiceValues["the-earth-mother"][slug] = count`
- Migration: actor with `instinctValues = { instinct: { delight: 1 } }` ends up with `choiceValues = { instinct: { delight: 1 } }`
- Follower side effect: selecting a background choice with `followers: ["enfys"]` calls `followers.addFollower("enfys")`
