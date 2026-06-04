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
10. Delete `StonetopFlags` (blocked: still used by `PersonList.js`, `SteadingImprovements.js`, `StonetopNpc.js`); delete `template.json`


# TypeDataModel for Actor State (steading and npc)
to be figured out.

---

## Phase 2: Possession Standalone Item Type

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

### Steps

1. Add `possession` to item types in TypeDataModel (or `template.json` if still present)
2. Create `possessions` compendium pack
3. Extract possessions from each playbook JSON into the new pack
4. Update playbook schema: `specialPossessions.options[]` → `specialPossessions.slugs[]`
5. Update `CharacterPossessions` and `PossessionsSnapshot` to load from new pack

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
