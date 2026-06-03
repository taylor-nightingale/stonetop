# FoundryVTT Fake Library Audit

## What Already Exists (tests/fakes/ — 31 files)

### Core document fakes
| File | What it does |
|---|---|
| `FakeActor.js` | Simulates Actor: `update()`, `getFlag()`, `setFlag()`, `createEmbeddedDocuments()`, `deleteEmbeddedDocuments()` |
| `FakeActorBuilder.js` | Fluent builder for character actors: `withStats()`, `withPlaybook()`, `withHp()`, `withLevel()`, etc. |
| `FakeFlags.js` | Flag storage: `setFlag()`, `getFlag()`, `setFlagNonAsync()`, `toRaw()`, `clear()` |
| `FakeSteadingBuilder.js` | Full steading actor with system structure + `vi.fn()` stubs |
| `FakePackBuilder.js` | Compendium pack: `getDocument()`, `.index` array |
| `FakeCompendiumMoveBuilder.js` | Individual move items with full system data |

### Repository fakes
`FakeMoveRepository`, `FakePlaybookRepository`, `FakeArcanaRepository`, `FakeFollowerRepository`, `FakePostDeathInsertRepository`, `FakeInventoryRepository`, `FakeWorldItemStore`, `FakeRepositoryFactory`

### Domain fakes
`FakeMoves`, `FakePlaybook`, `FakeVitals`, `FakeFollowers`, `FakeOutfitItems`

### Builder fakes
`TestCharacterBuilder`, `TestChoiceGroupBuilder`, `TestChoiceRowBuilder`, `TestSpecialPossessionBuilder`, `StonetopFakeFlagsBuilder`

### Roll fakes
`FakeNormalRollBuilder`, `FakePoolRollBuilder`

---

## Current Global Setup (tests/setup.js)

```js
game = { i18n: { localize, has } }
Hooks = { once(), on() }
CONFIG = {}
foundry.utils.mergeObject()   // shallow spread
Math.clamp()                   // polyfill
```

---

## Foundry APIs Used in Production Code

### `game.*`
| API | Usage |
|---|---|
| `game.settings.register()` | 4 settings at init |
| `game.settings.get/set("stonetop", key)` | rollMode, debugMode, etc. |
| `game.packs.get("stonetop.{pack-name}")` | Load compendium packs (playbooks, moves, followers, arcana, etc.) |
| `game.items?.contents` / `.get(id)` | World items (non-compendium) |
| `game.actors?.filter()` | Find all character actors |
| `game.i18n.localize(key)` / `.has(key)` | Translations |

### Other globals
| API | Usage |
|---|---|
| `ChatMessage.getSpeaker({ actor })` | Roll output |
| `ChatMessage.create({ speaker, content, flavor })` | Roll output |
| `new Roll(formula)` → `.evaluate()` → `.toMessage()` | 2d6 rolls, advantage/disadvantage |
| `Dialog` | User input modals |
| `TextEditor.getDragEventData(event)` | Drag-and-drop handling |
| `foundry.utils.mergeObject(a, b)` | Object merging |
| `foundry.utils.deepClone(obj)` | Deep clone |
| `foundry.utils.setProperty(obj, path, value)` | Dot-path property sets |
| `foundry.appv1.sheets.ActorSheet` | Base class for sheets |

### Actor document API
| API | Used for |
|---|---|
| `actor.update({ "system.path": val })` | All state writes (HP, XP, armor, level, damage, debilities, steading attrs) |
| `actor.getFlag("stonetop", key)` | All custom state reads |
| `actor.setFlag("stonetop", key, value)` | All custom state writes |
| `actor.createEmbeddedDocuments("Item", [...])` | Add items (outfit items, moves) |
| `actor.deleteEmbeddedDocuments("Item", [ids])` | Remove items |
| `actor.items.get(id)` | Look up embedded item by ID |
| `actor.type`, `actor.name`, `actor.system`, `actor.flags`, `actor.items` | Property access |

### Item document API
| Property | Used for |
|---|---|
| `item.name`, `item.type` | Identity |
| `item.system.rollStat`, `.description`, `.moveType`, `.playbook` | Move data |
| `item.system.isStartingMove`, `.repeatMax`, `.requirement` | Move rules |
| `item.system.resource`, `.choices`, `.moveResults` | Move content |
| `item.system.source` | Outfit item source tracking |

---

## Gaps: What Needs to Be Built for TypeDataModel Migration

### 1. foundry.data.fields fakes (HIGH PRIORITY — Phase 1 foundation)

All field types used or planned:

| Field type | Used for |
|---|---|
| `NumberField` | HP, XP, level, armor, pool counts, resource counts |
| `StringField` | playbookSlug, rollMode, damage die, names |
| `BooleanField` | debilities, move `active`, arcana `flipped`/`owned` |
| `ArrayField` | moves list, owned slugs, selected slugs |
| `ObjectField` | resource counts map, choice values map, follower state map |
| `SchemaField` | health {value,max}, stats, debilities, nested structures |

Each fake field must implement: `initial` default, type coercion/casting, `required`/`nullable`/`blank` options.

### 2. foundry.abstract.TypeDataModel fake (HIGH PRIORITY — Phase 1 foundation)

Must implement:
- `static defineSchema()` → schema object
- Constructor: calls `_initializeSource` (apply defaults, cast types), `validate`, `_initialize`
- `_source` — raw stored data (what would be in DB)
- Top-level initialized properties — the prepared view
- `static migrateData(source)` — runs before initialization
- `prepareDerivedData()` — called after `_initialize`
- `toObject()` — returns `_source` contents

### 3. Updated FakeActor for TypeDataModel (Phase 1)

Current `FakeActor` is flag-based. Once TypeDataModel exists:
- `actor.system` should be a `TypeDataModel` instance (not a raw object)
- `actor.update({ "system.x": val })` should write into `actor.system._source` and re-initialize
- `actor.flags` stays for now (until migration complete)

### 4. Expanded game global
- `game.settings.register()`, `.get()`, `.set()`
- `game.packs.get(name)` → returns pack with `.getIndex()`, `.getDocument(id)`, `.index`
- `game.actors` collection
- `game.items` collection

### 5. Other globals
- `ChatMessage.getSpeaker()`, `.create()` — stubs sufficient
- `Roll` — needs `.evaluate()` and `.total`; pool roll support (advantage/disadvantage)
- `Dialog` — stub sufficient
- `TextEditor.getDragEventData()` — stub sufficient
- `foundry.utils.deepClone()`, `foundry.utils.setProperty()` — real implementations needed

---

## Build Order for Fake Library

1. `foundry.data.fields` — foundation everything else depends on
2. `foundry.abstract.TypeDataModel` — depends on fields
3. Updated `FakeActor` with TypeDataModel-backed `system` — depends on TypeDataModel
4. Expand `game` global in setup.js
5. `ChatMessage`, `Roll`, `Dialog`, `TextEditor` stubs
6. `foundry.utils.deepClone`, `foundry.utils.setProperty` implementations
