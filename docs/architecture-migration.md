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
| **Moves** | Yes ✓ — full item embedded at playbook selection | none (`system.moves[]` removed) | No ✓ — reads from `actor.items` |
| **Possessions** | Yes ✓ — full item embedded at playbook drop (playbookSlug set); drag-dropped items also embedded (playbookSlug=null) | none (`system.possessions.*` removed) | No ✓ — reads from `actor.items` |
| **Arcana** | Yes ✓ — full item embedded at acquisition | none (`system.arcana.*` removed) | No ✓ — reads from `actor.items` |
| **Followers** | Yes ✓ — full item embedded at acquisition (owned=true); linked preview items (owned=false) | none (`system.followers.*` removed) | No ✓ — reads from `actor.items` |
| **Playbook** | Yes ✓ — full item embedded at selection | `system.playbookSlug` (pointer for selectBackground catKey) | No ✓ — reads from `actor.items` |
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

**Moves** ✓ COMPLETE (Phase 3)
- All moves embedded at playbook selection time with full pack data. `buildSlugIndex()` eliminated.
- `actor.system.moves[]` eliminated entirely — category membership derived from `item.system.categoryKey`, ordering from `item.system.sortOrder`, metadata from `item.system.categoryLabel`/`categoryNote` or hardcoded constants.
- `buildSnapshot()` is now a synchronous filter-and-group over `actor.items`.

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

**3. Move category ordering**: ✓ Resolved — `item.system.sortOrder` (set at embed time) preserves display order. Filter by `categoryKey`, sort by `sortOrder`.

**4. Circular follower–arcana dependency**: `CharacterFollowers.buildSnapshot()` currently runs before `CharacterArcana.buildSnapshot()` because arcana needs follower data for linked-follower rows. With items, both just read `actor.items` — the ordering concern goes away, but the templates still need follower snapshots for arcana back-side rendering.

### Recommended direction

**Do** migrate possessions, arcana, and followers to item-centric embedding — these three have the most async I/O and the most to gain. Migration order: possessions first (smallest schema, already partially done), then arcana, then followers.

~~**Keep** `actor.system.moves[]` category array in system data~~ — superseded by Phase 3 Part 5. The category array is eliminated; move items carry their own ordering and category label via `sortOrder`, `categoryLabel`, and `categoryNote` system fields.

**Defer** playbook and insert — they are singleton items per actor, their fetches are cached, and the schema expansion is not worth the complexity at this stage.

**Keep** inventory item `getAll()` as-is — that's a catalog query, not an owned-items query. It's a different pattern.

**Snapshot stays**. Even with items fully embedded, `buildSnapshot()` remains the sheet's data source — it maps `actor.items` into a clean plain-JS shape with derived values computed. The only difference is it becomes synchronous (or nearly so) instead of making async pack fetches.

---

## Phase 3: Embed All Playbook Moves on Selection ✓ COMPLETE

### Problem

Moves were only embedded when acquired. Players could not view or drag unacquired playbook moves. Move category metadata (`label`, `renderStyle`, `allowAdditional`) lived in `actor.system.moves[]` alongside per-move selection state. Every `buildSnapshot()` call did an async `buildSlugIndex()` fetch.

### Solution (completed in five parts)

**Part 1** — `MoveData` TypeDataModel with `categoryKey`, `acquired`, `instanceCount`, `isStartingMove`, `repeatMax`.

**Part 2** — Embed ALL playbook moves at selection time (`acquired: false` for non-starting). `incrementMove` / `decrementMove` update existing items instead of creating/deleting them.

**Part 3** — `buildSnapshot()` reads move content from `actor.items` instead of calling `buildSlugIndex()`. Snapshot path is now synchronous.

**Part 4** — Strip redundant state from `actor.system.moves[]`. Flag moves shrunk from `{ slug, compendiumId, isStarting, selection: {max,value}, ownedIds: [id] }` to `{ slug, compendiumId, ownedId }`.

**Part 5** — Eliminate `actor.system.moves[]` entirely. Items carry ordering (`sortOrder`) and category metadata (`categoryLabel`, `categoryNote`, `compendiumId`). `buildSnapshot()` groups `actor.items` by `categoryKey`, derives metadata from items or hardcoded constants, needs no category array.

**Move item fields added across Parts 1–5:**

| Field | Type | Purpose |
|---|---|---|
| `categoryKey` | string | which category the move belongs to |
| `categoryLabel` | string\|null | display label for the category (non-hardcoded categories) |
| `categoryNote` | string\|null | starting-moves note for playbook categories |
| `compendiumId` | string\|null | original compendium document ID |
| `acquired` | boolean | whether the player has taken this move |
| `instanceCount` | number | how many times acquired (for repeatable moves) |
| `isStartingMove` | boolean | cannot decrement below 1 |
| `sortOrder` | number\|null | display order within the category |

**Category metadata derivation:**

| Category key | label | renderStyle | allowAdditional | note |
|---|---|---|---|---|
| `basic` | hardcoded "Basic Moves" | `side-bar` | false | null |
| `playbook-*` | `item.system.categoryLabel` | `standard` | false | `item.system.categoryNote` |
| `post-death-*` | `item.system.categoryLabel` | `standard` | false | null |
| `other` | hardcoded "Other Moves" | `standard` | true | null |

**Eliminated:**
- `actor.system.moves[]` category array — removed from `CharacterData` schema
- `ownedIds[]` / flag-move list — category membership derived from `item.system.categoryKey`
- `buildSlugIndex()` async compendium fetch — `buildSnapshot()` reads only from `actor.items`

---

## Phase 4: Embed Arcana and Followers on Acquisition ✓ COMPLETE

Arcana and NPC item types already exist. Embed when acquired; remove when lost. Enables drag-and-drop for both.

### What changed

**Schema:**
- `ArcanumData`: added `flipped`, `unlockValues`, `backChoiceValues` fields — mutable per-actor state moves from `system.arcana.*` onto each embedded item
- `NpcItemData`: added `owned` (false = pre-embedded linked follower, true = player-owned), `choiceValues`; `damage.die` made nullable (null means no damage, was "d6")
- `CharacterData`: removed `arcana` and `followers` SchemaFields entirely

**CharacterArcana:**
- `ownedSlugs` getter reads from `actor.items` (type=arcanum)
- `addArcanum` fetches from repo, embeds full item; pre-embeds linked followers (owned=false) via `embedLinkedFollowers`
- `removeArcanum` deletes arcanum item; calls `removeLinkedFollower` for back-choice followers (only deletes if still owned=false)
- `flipArcanum`/`unflipArcanum` update `item.system.flipped` via `updateEmbeddedDocuments`
- `setUnlockCount`/`setBackChoiceValue` update `item.system.unlockValues`/`backChoiceValues`
- `buildSnapshot()` reads entirely from `actor.items` — no repo fetch

**CharacterFollowers:**
- `ownedSlugs` getter reads from `actor.items` (type=npc, owned=true)
- `addFollower` embeds from repo as owned=true; upgrades owned=false → owned=true if pre-embedded
- New `embedLinkedFollowers(slugs)` — called by CharacterArcana.addArcanum; creates npc items with owned=false
- New `removeLinkedFollower(slug)` — deletes only if owned=false (called by removeArcanum)
- `removeFollower` deletes the item entirely
- `addCustomFollower` no longer throws if blank not in repo — uses blank as template if available, hardcoded defaults otherwise
- All setters (setHp, setName, setTags, setArmor, setDamage, setChoiceValue, setChoiceText) update embedded items via `updateEmbeddedDocuments`
- `buildSnapshot()` reads from `actor.items` — no repo fetch

**FakeActor:**
- `updateEmbeddedDocuments` now does deep merge (via `_deepAssign`) and handles top-level `name` updates

**Eliminated:**
- `actor.system.arcana.{owned,flipped,unlock,backChoices}` — removed from `CharacterData` schema
- `actor.system.followers.{owned,state}` — removed from `CharacterData` schema
- All `findBySlugs` calls in `buildSnapshot()` for both classes

---

## Phase 5: Embed Possessions on Playbook Acquisition ✓ COMPLETE

Possessions are embedded into `actor.items` when a playbook is dropped onto a character, and removed when the playbook is removed. Same pattern as Phase 3 (moves) and Phase 4 (arcana/followers).

### What changed

**Schema:**
- `PossessionData`: added `selected`, `preselected`, `uses`, `pickValues`, `choiceUses`, `playbookSlug` fields — mutable per-actor state moves from `system.possessions.*` onto each embedded item. `playbookSlug` distinguishes playbook possessions (non-null) from drag-dropped possessions (null).
- `CharacterData`: removed `possessions` SchemaField entirely

**CharacterPossessions:**
- Constructor: removed `_playbook` arg (no longer needed)
- `selected` getter reads from `actor.items` (type=possession, selected=true)
- All mutations (`select`, `deselect`, `setUses`, `addSubChoice`, `removeSubChoice`, `selectExclusive`, `setChoiceUses`) update embedded items via `updateEmbeddedDocuments`
- New `addPossessionsFromPlaybook(sp, playbookSlug)` — called on playbook drop; fetches from repo, embeds items; preselected ones start selected=true and get outfit items synced
- New `removePossessionsFromPlaybook(playbookSlug)` — deletes all possession items with matching playbookSlug
- `syncPossessionItems` reads from embedded item (no repo call)
- `buildSnapshot()` reads `pickCount`/`pickNote` from embedded playbook item in `actor.items`; reads all other data from possession items — no repo fetch
- `computeMaxUses` no longer merges a persisted `maxUses` map; computes scaling bonus only

**StonetopCharacter:**
- `_onCreateDescendantDocuments`: calls `addPossessionsFromPlaybook` instead of `syncPossessionItems` loop
- Added `_onDeleteDescendantDocuments`: calls `removePossessionsFromPlaybook` when playbook is deleted
- `selectPossession`, `selectSubChoice`, `deselectSubChoice`, `selectSubChoiceExclusive`: removed dead `sp` fetch

**Eliminated:**
- `actor.system.possessions.{selected,uses,maxUses,pickValues,choiceUses}` — removed from `CharacterData` schema
- `findBySlugs` call in `buildSnapshot()` — `_possessionRepo` used only in `addPossessionsFromPlaybook`
- `_playbook` dependency in `CharacterPossessions`

---

## Phase 6: CharacterPlaybook.getData() Reads from actor.items ✓ COMPLETE

`CharacterPlaybook.getData()` previously called `this._repo.findBySlug(slug)` on every
`buildPlaybookSnapshot()` and `selectBackground()` call. The embedded playbook item in
`actor.items` already has all the data (`PlaybookData` system fields + `item.name` + `item.img`).

### What changed

**CharacterPlaybook:**
- Constructor: removed `playbookRepo` arg
- `getData()` reads from `actor.items.find(i => i.type === "playbook")` and returns `{ ...item.system, name: item.name, img: item.img }` — no repo call

**Eliminated:**
- `playbookRepo` / `_repo` from `CharacterPlaybook`
- `repos.playbook` from `StonetopCharacter` constructor
- `playbook` getter from `FoundryRepositoryFactory`
- `playbook` field from `FakeRepositoryFactory`
- `withPlaybookRepo` / `addPlaybook` from `TestCharacterBuilder`

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

| File                                    | Role |
|-----------------------------------------|---|
| `src/documents/StonetopCharacter.js`    | Facade; orchestrates all controllers |
| `src/actors/character/`                 | Domain controllers (one per concern) |
| `src/actors/character/StonetopFlags.js` | **Deleted in Phase 1** |
| `template.json`                         | **Replaced by TypeDataModel in Phase 1** |
| `packs/src/playbooks/*.json`            | Updated in Phase 2 (possessions extracted) |
| `packs/src/possessions/`                | New pack created in Phase 2 |

## Phase 7: ChoiceGroupController — Storage Abstraction + Declarative Side Effects ✓ COMPLETE

`ChoiceGroupController` hard-coded state storage to `actor.system[section]`. Follower and outfit-item side effects were scattered: `setFollowerCount` in the controller, direct `addFollower/removeFollower` calls in `CharacterArcana.setBackChoiceValue`, and a separate `.stonetop-arcanum-follower-check` sheet handler.

**What changed:**
- New constructor: `{ reader, writer, definitionReader, followers, outfitItems }` — storage and side-effect targets are injected
- Two static factories: `ChoiceGroupController.forActorSection(actor, section, handlers)` and `ChoiceGroupController.forItem(actor, itemId, valueField, handlers)`
- `_fireSideEffects(namespace, optionSlug, count, newRawValues)` — after every write, inspects the definition for follower-type rows and outfit-item-declaring options; fires the appropriate handler automatically
- `setFollowerCount` removed — absorbed into `_fireSideEffects`
- `CharacterArcana.setBackChoiceValue` and `setUnlockCount` use `forItem`; direct follower calls removed
- `CharacterBackgrounds.setFollowerChoiceValue` removed; `setChoiceValue` handles all background choices
- `StonetopCharacter.setBackgroundFollowerChoiceValue` removed
- `CharacterFollowers.setChoiceValue/setChoiceText` use `forItem`
- `buildGroupSnapshot(namespace, followersBySlug = {})` gained the `followersBySlug` param

**This phase is a prerequisite for Phase 8, 9A, and 9B.**

---

## Phase 8: ChoiceGroup Row Type Unification ✓ COMPLETE

Three row types existed (`heading`, `follower`, unnamed pick default). `heading` was misleadingly named; `follower` was special-cased. The unified model has two types: **`entry`** and **`pick`**.

**`entry`** — replaces both `heading` and `follower`. Carries `content`, `track`, `input`, `note`, `followers: [slug]`, `outfitItems: [descriptor]`, `inlineDisplay`. Follower side effects are declared via `followers` field, not by row type.

**`pick`** — unchanged container of options. Options now also carry `followers` and `outfitItems` for side effects, matching `entry` semantics.

**What changed:**
- `HeadingRow` class renamed to `EntryRow` (`type: "entry"`); `FollowerRow` class removed
- `ChoiceGroup.buildRow` handles legacy types (`"heading"`, `"follower"`) for backward compatibility with existing actor groupDefs
- `ChoiceGroup.buildEntryRow` resolves `followers: [slug]` from `followersBySlug` map; legacy `type: "follower"` rows use the row's own slug
- `ChoiceGroupController._fireSideEffects` unified: looks up target by slug across both entry rows and pick options; fires follower effects via `target.followers[]` (or legacy `target.type === "follower"`); fires outfitItem effects per-option with source `${sourcePrefix}:${namespace}:${optionSlug}`
- `ChoiceGroupController.selectOption` now fires remove side effects for previously-selected siblings (follower remove, outfitItem deleteBySource)
- `_syncOutfitItems` method removed — replaced by per-option source logic in `_fireSideEffects`
- `outfitItems` handler shape changed: `{ items, source }` → `{ items, sourcePrefix }`
- Templates: `choice-row.hbs` merges follower/heading branches under `type === "entry"`; follower card section conditional on `row.followers.length > 0`; `tab-equipment.hbs` and `move.hbs` updated to `"entry"` type check
- Pack data: 131 files migrated `"heading"` → `"entry"`; 12 playbook files migrated `"follower"` → `"entry"` with `followers: [slug]`, `content.text` from `title`; 5 follower pack files fixed a pre-existing bug (`type: "heading"` in pick options → `type: "input"`)
- Migration script: `scripts/migrate-choice-row-types.js`

**Actor groupDef migration** — `system.choices.groupDefs` and `system.postDeathChoices.groupDefs` on existing actors still contain old row types. Backward compat in `buildRow` and `_fireSideEffects` handles this until Phase 10. The migration function is documented in Phase 10.

---

## Phase 9A: Embed Insert on Drag-Drop ✓ COMPLETE

`CharacterPostDeath` previously called `insertRepo.getAll()` and `insertRepo.findBySlug(slug)` on every render, and stored the active insert slug in `actor.system.postDeath.insert`.

**New flow:** drag an `insert` item from the compendium browser → Foundry embeds it in `actor.items` → post-death tab appears. Presence of the embedded item is the state.

**What changed:**
- `CharacterPostDeath`: removed `_insertRepo`; removed `setInsert`, `activeSlug`, `setActiveSlug`; added `onInsertDropped(item)`, `removeInsert()`, `onInsertRemoved(slug)`; `buildSnapshot()` reads from `actor.items`, returns `PostDeathInsertSnapshot | null`
- `StonetopCharacter`: `_onCreateDescendantDocuments` calls `onInsertDropped`; `_onDeleteDescendantDocuments` calls `onInsertRemoved`; removed `setPostDeathInsert`; added `removeInsert()`
- `PostDeathSectionSnapshot` + builder deleted; `CharacterSnapshot.postDeathInsert` is now `PostDeathInsertSnapshot | null`
- `CharacterData`: removed `postDeath: SchemaField({ insert: StringField })` — embedded item is the state
- `StonetopCharacterSheet`: removed `.stonetop-pdi-activate` handler; `.stonetop-pdi-remove` now calls `removeInsert()`
- `character.hbs`: post-death tab nav is conditional on `stonetop.postDeathInsert`
- `tab-post-death.hbs`: removed choose-fate block; paths flattened from `activeInsert.name` → `name`
- Removed `postDeathInsert` from `FoundryRepositoryFactory`, `FakeRepositoryFactory`, `TestCharacterBuilder`
- Added `tests/fakes/TestInsertItemBuilder.js`

**Actor migration note:** `system.postDeath.insert` on existing actors is orphaned — cleaned up in Phase 10.

---

## Phase 9B: Strip Possession Delegation from CharacterInventory ✓ COMPLETE

`CharacterInventory.buildSnapshot()` previously delegated to `this._possessions.buildSnapshot(level)` and assembled the full `InventorySnapshot` itself, while `StonetopCharacter.buildSnapshot()` was also calling `this._possessions.buildSnapshot(level)` independently — computing the possessions snapshot twice. `CharacterSnapshot.possessions` was a dead top-level property; templates exclusively use `stonetop.inventory.possessions`.

**What changed:**
- `CharacterInventory`: removed `possessions` constructor arg; `buildSnapshot(level)` now returns `OutfitSnapshot` only (no `InventorySnapshot` wrapping, no `_possessions` call)
- `StonetopCharacter.buildSnapshot()`: assembles `new InventorySnapshot(outfit, possessions, this._inventory.otherItems)` after the `Promise.all`, using the independently-computed `possessions` result
- `CharacterSnapshot`: removed dead `possessions` top-level property and `withPossessions()` builder method
- `CharacterInventory.test.js`: removed `possessions` param from `makeCi`; updated return-type assertions (`snap.outfit.*` → `snap.*`); removed delegation tests
- `StonetopCharacter.buildSnapshot.test.js`: updated `snap.possessions` → `snap.inventory.possessions`

The outfit catalog `getAll()` repo call stays — it is a catalog display query, not an ownership query.

---
## Phase 10: fix the move item builder COMPLETE

## Phase 11
Data and character migrations for pre-refactor to post-refactor changes.

**Actor groupDef migration (from Phase 8):** scan `game.actors`, update `system.choices.groupDefs` and `system.postDeathChoices.groupDefs`:

```js
function migrateGroupDefs(defs) {
    let changed = false;
    const result = {};
    for (const [ns, def] of Object.entries(defs ?? {})) {
        const newList = (def.list ?? []).map(row => {
            if (row.type === "follower") {
                changed = true;
                return { ...row, type: "entry", followers: [row.slug], content: { title: null, text: row.title ?? "" } };
            }
            if (row.type === "heading") { changed = true; return { ...row, type: "entry" }; }
            return row;
        });
        result[ns] = { ...def, list: newList };
    }
    return changed ? result : null;
}
```

Once this migration runs, the backward compat branches in `buildRow` and `_fireSideEffects` can be removed.
After migration is live, the backward-compat branches in ChoiceGroup.buildRow and
ChoiceGroupController._fireSideEffects for "heading" / "follower" row types (Phase 8)
can be deleted — all actor groupDefs will have been migrated to "entry" by step E.


The plan doc is at docs/bug-fix-plan.md. Here's the summary of what's captured:

DONE - Phase 1a — Fix ghost move playbook field in 3 JSON files
DONE - Phase 1b — Collapse all move packs into a single moves pack with subfolders (moves/basic, moves/post-death, etc.)
DONE - Phase 2 — Revert instinct out of choices[] for all 9 playbooks and 3 inserts; add system.instinct field to PlaybookData and InsertData; update _smartDefaultDef to check system.instinct; extract InstinctController class shared by CharacterPlaybook and
  CharacterInserts; extract instinct-section.hbs partial used by both tab-details.hbs and tab-insert.hbs
- Phase 3 — Arcana null guard: data.front ?? {}
- Phase 4 — Add appearanceGroup and loreGroups computed fields to PlaybookSnapshot
- Phase 5 — Template fixes: tab-details.hbs (use new snapshot fields), character.hbs (dynamic insert tabs), new tab-insert.hbs wrapping content in data-insert-item-id
- Phase 6 — Sheet event handlers use el.closest("[data-insert-item-id]") to route to setInsertChoiceCount/Pick/Text with itemId
- Phase 7 — Register OutfitItemSideEffectHandler on factory
- Phase 8 — Investigate move choice groups (needs running game)
