# Architecture Migration Plan

## Three Data Layers

Stonetop has three distinct data layers:

1. **Compendium data** — Static JSON in packs. Defines what exists: playbook definitions, move text, possessions, arcana, followers. Frozen post-release; changes during development handled by re-running a sync script.
2. **Actor state** — Mutable state on the actor. Records what choices have been made: which playbook, which moves acquired, current HP, selected possessions, etc.
3. **Snapshot** — Ephemeral merge of layers 1+2 plus derived calculations. Produced by `buildSnapshot()`, used only for sheet rendering. Never persisted.

This three-layer architecture is intentional. Slug references instead of embedded copies keep data fresh during active development. Other systems (dnd5e, PF2e) embed copies of items instead and don't need a snapshot layer — but they also require migration scripts when compendium data changes. For Stonetop, the snapshot layer is the right tradeoff.

---

## Fake Library Infrastructure ✓ COMPLETE

`foundry.data.fields.*` and `foundry.abstract.TypeDataModel` fakes are wired into `tests/setup.js` as globals. Production code that extends `foundry.abstract.TypeDataModel` or uses `foundry.data.fields.*` works in tests with no module aliasing. Shared path helpers (`setPath`, `getPath`, `deletePath`) live in `tests/fakes/foundry/utils.js`.

New files:
- `tests/fakes/foundry/fields.js` — NumberField, StringField, BooleanField, ArrayField, ObjectField, SchemaField
- `tests/fakes/foundry/TypeDataModel.js` — TypeDataModel base class
- `tests/fakes/foundry/utils.js` — setPath, getPath, deletePath
- `tests/setup.js` — updated with all globals

---

## Phase 1: TypeDataModel for Actor State

### Problem

Actor state is split between `system.*` (primitives from `template.json`) and `flags.stonetop.*` (most domain state). Flags are for external modules, not first-party system state. Pain points:

- No schema, validation, or migration support
- Split-brain: current HP in `system`, max HP in flags
- Nested flag objects require read-all / mutate / write-all round-trips

### Solution

Replace `template.json` and all `flags.stonetop.*` with a `TypeDataModel`:

```js
class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      health:      new f.SchemaField({ value: new f.NumberField(...), max: new f.NumberField(...) }),
      playbookSlug: new f.StringField({ initial: "" }),
      moves:       new f.ArrayField(new f.SchemaField({ slug: ..., active: ..., current: ... })),
      // ... possessions, arcana, followers, choices, resources, rollMode
    };
  }
}
```

Migrations run transparently on load:

```js
static migrateData(source) {
  Document._addDataFieldMigration(source, "flags.stonetop.playbook.slug", "system.playbookSlug");
  Document._addDataFieldMigration(source, "flags.stonetop.vitals.maxHP",  "system.health.max");
  // ... one entry per flag path
  return super.migrateData(source);
}
```

`StonetopFlags` is deleted. Controllers still own domain logic but write to `actor.update({ "system.x": v })` instead of `setFlag(...)`.

### What Must Stay in Snapshot (Never Store on Actor)

These values derive from other data and go stale if stored:

| Value | Why |
|---|---|
| `xp.max` | `6 + level * 2` |
| Total armor | Summed from equipped outfit items at render time |
| `move.requirement.met` | Depends on current level + acquired moves |
| Possession `maxUses` | Depends on level + acquired moves |
| Resource `max` when `maxStat` set | Scales with a stat that changes |

### Migration Order (one controller at a time, each independently testable)

1. `CharacterVitals` ✓ — `flags.stonetop.vitals.maxHP` → `system.attributes.hp.max`; `CharacterData` TypeDataModel created and registered
2. `CharacterStats` + `CharacterDebilities` ✓ — no flags; no-op
3. `CharacterPlaybook` ✓ — `flags.stonetop.playbook.slug` → `system.playbookSlug`
4. `CharacterMoves` ✓ — `flags.stonetop.moves.categories` → `system.moves`; only `_getCategories()` + `_setCategories()` changed
5. `CharacterInventory` + `CharacterPossessions` ✓ — 10 flags → `system.inventory.*` + `system.possessions.*`; constructor arg changed from injected flags to actor
6. `CharacterArcana` ✓ — 4 flags → `system.arcana.*`; 5 spy-assertion tests rewritten to assert on observable state
7. `CharacterFollowers` ✓ — 2 flags → `system.followers.*`
8. `CharacterBackgrounds` + `CharacterInstincts` + `CharacterAppearance` + `CharacterOrigin` + `CharacterLore` + `CharacterPostDeath` ✓ — 7 flags → `system.background.*`, `system.instinct.*`, `system.origin.*`, `system.lore.*`, `system.postDeath.*`, `system.postDeathInstinct.*`, `system.postDeathLore.*`; `CharacterInstincts` and `CharacterLore` gain optional `systemSection` param for postDeath reuse; `FakeMoves` extended with `addCategory`/`removeCategory`/observable getters
9. `ChoiceGroupController` + `ResourceController` ✓ — `system.choices.*`, `system.postDeathChoices.*`, `system.resources.*`, `system.moveResources.*`; both gain optional `systemSection` param; `StonetopFlags` import removed from `StonetopCharacter.js`
10. `StonetopNpc` + `PersonList` + `SteadingImprovements` ✓ — `NpcData` TypeDataModel created and registered; all three classes migrated from flags to `system.*`; `StonetopFlags.js` deleted; template.json character+npc actor sections removed
11. `SteadingData` TypeDataModel ✓ — `SteadingDefaultData.js` created for large content constants; `SteadingData.js` defines full steading schema with correct defaults; registered in `stonetop.js`; template.json steading actor section removed. All three actor types are now TypeDataModel-managed.
12. Item TypeDataModels ✓ — `MoveData`, `ArcanumData`, `PlaybookData`, `InsertData`, `ImprovementData`, `NpcItemData`, `OutfitItemData` created in `src/data/`; all registered in `stonetop.js`; `FakeFields.js` fixed to handle `nullable:true` on `NumberField` and `ObjectField`; template.json item data schemas removed.
13. `template.json` deleted ✓ — `documentTypes` added to `system.json` for all actor and item types; `"template"` key removed from `system.json`. **Phase 1 complete.**

---

## Phase 2: Possession Standalone Item Type ✓ COMPLETE

### Problem

Possessions are defined inline in each playbook's `specialPossessions.options[]`. They cannot be dragged, shared across playbooks, or treated as Foundry documents.

### Solution

New `possession` item type with its own compendium pack.

**Possession schema:**

```json
{
  "slug": null,
  "label": "",
  "description": "",
  "outfitItems": [],
  "resource": null,
  "choices": null,
  "scaling": null,
  "sortOrder": null
}
```

**Playbook `specialPossessions` becomes:**

```json
{
  "pickNote": "Pick 2",
  "pickCount": 2,
  "preselected": [],
  "slugs": ["burglars-kit", "carpenters-tools", "..."]
}
```

**Key decisions:**

- No `playbookSlug` on possessions — possessions can be shared across playbooks; the playbook owns its list via `slugs`
- `outfitItems` stay inline on the possession item (not standalone compendium entries) — matches how arcana front/back items work
- Drag-and-drop adds a possession to the actor without auto-selecting it in the playbook picking flow
- `scaling` field on `PossessionData` (not `usesBonus`) — fixes field-name bug from inline possession data

### Steps

1. ✓ Add `possession` to item types in TypeDataModel — `PossessionData.js` registered in `stonetop.js` + `system.json`
2. ✓ Create `possessions` compendium pack — `packs/src/possessions/` (39 files), registered in `system.json`
3. ✓ Extract possessions from each playbook JSON — `scripts/extract-possessions.js` run once; 9 playbooks updated
4. ✓ Update playbook schema: `specialPossessions.options[]` → `specialPossessions.slugs[]`
5. ✓ Update `CharacterPossessions` to load from repository — `FoundryPossessionRepository` wired via `FoundryRepositoryFactory.possessions` into `StonetopCharacter`; `FakeRepositoryFactory` + `TestCharacterBuilder` updated to match

---

## Phase 2b: Dropped Possessions Show on Sheet

### Problem

A possession item dragged from the compendium browser lands in the actor's embedded items (via Foundry's default `_onDropItemCreate`) but never appears on the sheet. `CharacterPossessions.buildSnapshot()` only reads the playbook's `slugs[]` list — it has no concept of "possession items already embedded on this actor."

Additionally, `StonetopCharacter.buildSnapshot()` never calls `this._possessions.buildSnapshot()` at all, so the possessions section is absent from the snapshot entirely.

### Solution

Two changes:

**1. Wire possessions into `StonetopCharacter.buildSnapshot()`**

Add `this._possessions.buildSnapshot(level)` to the `Promise.all` block and pass the result to `CharacterSnapshotBuilder.withPossessions(...)`.

**2. Merge embedded possession items into `CharacterPossessions.buildSnapshot()`**

After building the list from the playbook slugs, read `actor.items` for type `"possession"` and append any whose `system.slug` is not already in the playbook's slug list. These "dropped" possessions appear selected and not disabled (the player owns them), but are never preselected, not counted against `pickCount`, and carry no `preselectedSource`.

Concretely, `buildSnapshot(level)` becomes:

```
playbookSlugs = sp.slugs                          // from playbook
playbookPossessions = repo.findBySlugs(slugs)     // compendium data
embeddedPossessions = actor.items                 // embedded on actor
  .filter(type === "possession" && slug not in playbookSlugs)
  .map(item => new Possession(item.system))

allPossessions = [...playbookPossessions, ...embeddedPossessions]
```

Embedded-only possessions are always `selected: true`, `disabled: false`, `preselected: false`.

### Key decisions

- Embedded possessions are not subject to `pickCount` — the player acquired them outside the standard picking flow.
- If a possession's slug appears in both the playbook list and embedded items, the playbook entry wins (deduplication by slug before merging).
- `onDropItems` in `StonetopCharacter` does not need to change — `possession` items already fall through to `super._onDropItemCreate()`.
- No `selectPossession()` call on drop — the item being embedded is sufficient.

### Steps

1. Add `possessions` to `CharacterSnapshotBuilder` — `withPossessions(snap)` method + field on the snapshot
2. Add `buildSnapshot(level)` call to `StonetopCharacter.buildSnapshot()`
3. Extend `CharacterPossessions.buildSnapshot()` to read embedded possession items from the actor and merge them after the playbook list
4. Update `FakeActor` / `FakeActorBuilder` to expose an `items` collection that tests can populate with possession items
5. Write tests: embedded possession appears in snapshot; playbook possession wins on slug collision; embedded possession is selected+not-disabled

---

## Architecture Audit: Item-Centric Snapshot Direction

*Audited 2026-06-03.* Evaluates the proposed direction: embed all character-owned items in `actor.items` at acquisition time, then have `buildSnapshot()` read from `actor.items` instead of doing async compendium fetches.

### Current state: what lives where

| Domain | Items in `actor.items`? | Mutable state in `actor.system.*` | Async compendium fetch in `buildSnapshot`? |
|---|---|---|---|
| **Moves** | Yes — one item per acquired move | `system.moves[]` categories with `selection.{max,value}` and `ownedIds[]` | Yes — `buildSlugIndex()` to fetch all move definitions |
| **Possessions** | Partial — dropped possessions only; playbook possessions are slug-only | `system.possessions.{selected,uses,maxUses,pickValues,choiceUses}` | Yes — `findBySlugs(slugs)` for playbook possessions |
| **Arcana** | No — slug-only | `system.arcana.{owned,flipped,unlock,backChoices}` | Yes — `findBySlugs(ownedSlugs)` |
| **Followers** | No — slug-only | `system.followers.{owned,state}` (state includes hp, armor, damage, loyalty, choice values) | Yes — `findBySlugs(ownedSlugs)` |
| **Playbook** | Yes — one item created on drop | `system.playbookSlug` (pointer only) | Yes — `findBySlug(slug)` for all background/instinct/lore/origin data |
| **Insert** | Yes — one item created on drop | `system.postDeath.insert` (pointer only) | Yes — `getAll()` + `findBySlug()` |
| **Outfit items** | Yes — fully embedded | `system.inventory.checked{}` (equipped state only) | Yes — `getAll()` for inventory item definitions |

### What the proposed direction requires

To eliminate async fetches, items must be **self-contained at acquisition time** — all pack data (label, description, choices, resource definition, etc.) copied into the item's `system.*` fields when the item is first embedded. Slugs alone are not enough. This means:

- **On selection/acquisition**: copy the full compendium shape into the item's system data
- **Mutable per-actor state** (uses, choice picks, hp overrides, etc.) moves from `actor.system.*` onto the item's system fields
- **`buildSnapshot()`** becomes a synchronous map over `actor.items` — no repos, no awaits

### Domain-by-domain assessment

**Possessions** — lowest friction, clearest win
- Pack data shape is compact (slug, label, description, resource, choices, scaling, outfitItems)
- Mutable state: `uses` and `choiceUses` move to item system fields
- `selected` and `preselected` would be item flags or boolean system fields
- `pickValues` (sub-choice picks) moves to item system
- `computeMaxUses` stays in the domain class (still depends on level + moves), result goes on item or snapshot-only

**Arcana** — feasible but has side effects
- Pack data is nested (front.unlock.list, back.choices.list, back.moves[], etc.) — all copyable at acquisition
- Mutable state: `flipped` boolean, `unlock` values, `backChoices` values move to item system
- **Side effects don't disappear**: `_syncSideEffects()` still needs to run on flip/acquire/remove to keep outfit items and follower references in sync. Embedding arcana items doesn't eliminate this reactive logic.
- Linked followers from arcana back-side choices are not "owned" followers — they're static references fetched on render. These would still need a lookup unless follower data is also embedded.

**Followers** — straightforward data migration, deeper dependencies
- Pack data is moderate (tags, hp, armor, damage, choices) — copyable at acquisition
- Mutable state: hp, hpMax, name, armor, damage overrides, loyalty, choice values all move to item system
- Custom followers (created blank, not from compendium) already work this way; just need schema alignment
- **Arcana dependency**: `CharacterArcana.buildSnapshot()` currently fetches followers linked to arcana back choices. If followers are in `actor.items`, this becomes a filter on items — cleaner, but means arcana and follower rendering are no longer independent.

**Moves** — category metadata is the blocker
- Move documents are already embedded. The async fetch (`buildSlugIndex()`) exists to get move definitions (label, description, results, requirement) for moves that are in the actor's category list but whose item may not exist.
- If all owned moves have their items embedded with full pack data, `buildSlugIndex()` goes away.
- **Blocker**: `actor.system.moves[]` category metadata (key, label, renderStyle, allowAdditional, ownedIds[]) does not belong on items — it's the actor's organizational structure, not item data. This stays in `actor.system` regardless.
- `ownedIds[]` becomes redundant (filter `actor.items` by type + slug instead), but the category array itself stays.

**Playbook** — highest risk, lowest priority
- Pack data is very large: backgrounds[], instinct.list[], appearance.list[], origin.list[], lore.list[], all with nested ChoiceRows
- The playbook item already exists on the actor but is a thin marker — all data is fetched from the repo
- Copying full playbook data into the item system at selection time is feasible but makes PlaybookData the largest schema in the system
- Given there is exactly one playbook per actor and the fetch is cached, this is the **lowest-value migration**. Defer.

**Inventory items (outfit items)** — already mostly done
- Items are embedded. Pack data (name, weight, inventoryColumn, resource) is already on the item.
- Only remaining async fetch: `getAll()` in `CharacterInventory.buildSnapshot()` to get ALL compendium inventory items (not just owned ones, for the full catalog display). This is a different pattern — it's not "owned items only."

### Key risks

**1. Schema expansion**: Item system schemas grow significantly to hold pack data + per-actor mutable state. `PossessionData`, `ArcanumData`, `NpcItemData` all need new fields.

**2. Data duplication**: Compendium is still source of truth during development. Embedded copies go stale if pack data changes (text edits, balance changes). A sync step or re-embed would be needed after pack updates — same tradeoff as dnd5e/PF2e.

**3. Move category ordering**: The `ownedIds[]` tracking inside `actor.system.moves` is currently used to associate multiple instances of the same move with a category slot. This becomes a filter-by-slug on `actor.items`, which works but may change ordering semantics.

**4. Circular follower–arcana dependency**: `CharacterFollowers.buildSnapshot()` currently runs before `CharacterArcana.buildSnapshot()` because arcana needs follower data for linked-follower rows. With items, both just read `actor.items` — the ordering concern goes away, but the templates still need follower snapshots for arcana back-side rendering.

### Recommended direction

**Do** migrate possessions, arcana, and followers to item-centric embedding — these three have the most async I/O and the most to gain. Migration order: possessions first (smallest schema, already partially done), then arcana, then followers.

**Keep** `actor.system.moves[]` category array in system data — it's structural metadata, not item data. Move items stay embedded but the category structure stays in system.

**Defer** playbook and insert — they are singleton items per actor, their fetches are cached, and the schema expansion is not worth the complexity at this stage.

**Keep** inventory item `getAll()` as-is — that's a catalog query, not an owned-items query. It's a different pattern.

**Snapshot stays**. Even with items fully embedded, `buildSnapshot()` remains the sheet's data source — it maps `actor.items` into a clean plain-JS shape with derived values computed. The only difference is it becomes synchronous (or nearly so) instead of making async pack fetches.

---

## Phase 3: Embed All Playbook Moves on Selection

### Problem

Moves are only embedded when acquired. Players cannot view or drag unacquired playbook moves. Move category metadata (`label`, `renderStyle`, `allowAdditional`) lives in `actor.system.moves[]` alongside per-move selection state, coupling organisational structure to actor state. Every `buildSnapshot()` call does an async `buildSlugIndex()` fetch to get move definitions for all moves in all categories.

### Solution

Embed all moves at playbook selection time. Move items become self-contained; category structure comes from playbook data and a static basic-moves definition. `actor.system.moves[]` is eliminated.

**Move items gain:**

```json
{
  "categoryKey": "blessed",
  "acquired": false,
  "instanceCount": 0
}
```

- `categoryKey` — which category this move belongs to (e.g. `"basic"`, `"blessed"`, `"other"`, `"post-death"`)
- `acquired` — whether the player has taken this move
- `instanceCount` — for repeatable moves, how many times acquired (replaces `selection.value`)

**Category metadata sources:**

| Category | Where metadata comes from |
|---|---|
| `basic` | Hardcoded in the system (static — label, renderStyle never change) |
| Playbook-specific (e.g. `blessed`) | Playbook pack data embedded in the playbook item at selection time |
| `other` | Hardcoded catch-all for moves acquired outside the playbook flow |
| `post-death` | Insert item defines the post-death category |

**On playbook selection:**
1. Embed all playbook moves as items with `acquired: false`, `categoryKey: <playbookSlug>`
2. Set `acquired: true` on moves that are starting moves (`isStartingMove: true`)

**On character creation (basic moves):**
- Embed all basic moves with `acquired: true`, `categoryKey: "basic"`

**On acquiring a move:**
- Flip `acquired: true` on the existing embedded item (or increment `instanceCount` for repeatable moves)
- No new item created — the item already exists from playbook selection

**`buildSnapshot()` for moves:**
1. Read the embedded playbook item for playbook category metadata (label, renderStyle, allowAdditional)
2. Read all move items from `actor.items` where `type === "move"`
3. Group by `categoryKey` — basic group is static, playbook group from playbook item, others as catch-all
4. No async fetch — all data is on the items

**Eliminates:**
- `actor.system.moves[]` category array
- `ownedIds[]` tracking on move flags
- `buildSlugIndex()` async compendium fetch in `CharacterMoves.buildSnapshot()`

**Custom / post-death categories** (moves added from other sources or post-death inserts) use `categoryKey: "other"` or `categoryKey: "post-death"`. If the player manually adds a custom category, a minimal `actor.system.customCategories[]` can hold the label for that category only.

---

## Phase 4: Embed Arcana and Followers on Acquisition

Arcana and NPC item types already exist. Embed when acquired; remove when lost. Enables drag-and-drop for both.

---

## Item Types by Actor Type

| Item type | character | steading | npc actor |
|---|---|---|---|
| `move` | ✓ | | |
| `playbook` | ✓ | | |
| `possession` | ✓ | | |
| `insert` | ✓ | | |
| `arcanum` | ✓ | | |
| `npc` | ✓ | | |
| `outfitItem` | ✓ | | |
| `improvement` | | ✓ | |

---

## Key Files

| File | Role |
|---|---|
| `module/documents/StonetopCharacter.js` | Facade; orchestrates all controllers |
| `module/actors/character/` | Domain controllers (one per concern) |
| `module/actors/character/StonetopFlags.js` | **Deleted in Phase 1** |
| `template.json` | **Replaced by TypeDataModel in Phase 1** |
| `packs/src/playbooks/*.json` | Updated in Phase 2 (possessions extracted) |
| `packs/src/possessions/` | New pack created in Phase 2 |
