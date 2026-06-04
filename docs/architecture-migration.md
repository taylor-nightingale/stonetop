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

## Phase 3: Embed All Playbook Moves on Selection

### Problem

Moves are only embedded when acquired. Players cannot view or drag unacquired playbook moves.

### Solution

When a playbook is selected, embed ALL its moves with `active: false`. Acquiring a move sets `active: true` on the existing embedded item rather than creating a new one.

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
