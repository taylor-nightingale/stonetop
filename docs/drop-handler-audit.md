# Drop Handler Audit and Fix Plan

**Date**: 2026-06-05
**Triggered by**: Arcanum cards rendering blank (title and description empty on both front and back)

---

## Intended Architecture

Per `architecture-migration.md`, the correct pattern for drag-and-drop item embedding is:

1. `_onDropItemCreate` calls `super._onDropItemCreate(itemData)` — Foundry embeds the item from the pack as-is, preserving all `system.*` fields as plain objects
2. Foundry fires `_onCreateDescendantDocuments(documents)` on the actor when the embedding completes
3. We react to that hook to run side effects (select playbook, add possessions, embed linked followers, sync outfit items, etc.)

This pattern is already implemented for **playbook** and **insert** items.

---

## Audit: Current State

### Handled via `super._onDropItemCreate` + `_onCreateDescendantDocuments` ✓

| Item type | Drop result | Side effect hook |
|---|---|---|
| `playbook` | Foundry embeds as-is | `_onCreateDescendantDocuments` → selectPlaybook, addPossessionsFromPlaybook |
| `insert` | Foundry embeds as-is | `_onCreateDescendantDocuments` → onInsertDropped |
| possessions, outfit items, other | Foundry embeds as-is | none needed |

### Intercepted in `onDropItems` — NOT using the correct pattern ✗

| Item type | Current behaviour | Problem |
|---|---|---|
| `arcanum` | Extracts slug → `addArcanum(slug)` → fetches Arcanum from repo → stores `arcanum.front` (ArcanumFront instance), `arcanum.back` (ArcanumBack instance) via `createEmbeddedDocuments` | Foundry serializes class instances as `{}` → embedded item has `front: {}, back: {}` → card renders blank |
| `npc` (follower) | Extracts slug → `addFollower(slug)` → fetches Follower from repo → stores via `_followerToSystemFields()` (plain object) | Re-fetch is unnecessary; data is already in the dropped item. Works correctly because `_followerToSystemFields` produces plain objects |
| `move` | Extracts item → `onDropMove(item)` — uses item data directly | Correct; move drop has special increment-vs-create logic that must stay |

---

## Root Cause (Arcana)

**Confirmed in LevelDB**: embedded wolf-pelt arcanum stored as:
```json
{"system":{"slug":"wolf-pelt","front":{},"back":{},"flipped":true,...}}
```

**Code path that causes this**:
```
_onDropItemCreate(itemData)
  → onDropItems(items)
  → this.addArcanum(slug)                          // only slug passed — data discarded
  → this._arcana.addArcanum(slug)
  → arcanaRepo.findBySlugs([slug])                 // re-fetches from pack
  → new Arcanum({ ...doc.system, name, img })      // wraps in class instances
  → createEmbeddedDocuments("Item", [{
      system: {
        front: arcanum.front,  // ArcanumFront instance → {}
        back:  arcanum.back,   // ArcanumBack instance  → {}
      }
    }])
```

The dropped item already contains correct `system.front` and `system.back` as plain objects. They are discarded and replaced with class instances that don't serialize correctly.

---

## Fix Plan

### 1. Remove arcanum and follower handling from `onDropItems`

`StonetopCharacter.onDropItems` should no longer intercept `arcanum` or `npc` types. Pass them through to `super._onDropItemCreate`.

Before:
```js
for (const item of arcana) {
    const slug = item.system?.slug;
    if (slug) { await this.addArcanum(slug); anyAdded = true; }
}
for (const item of followers) {
    const slug = item.system?.slug;
    if (slug) { await this._followers.addFollower(slug); anyAdded = true; }
}
```

After: move to `others` — let `super._onDropItemCreate` embed them.

Duplicate prevention for arcana (can't embed twice) must move to `_onDropItemCreate` in the sheet:
```js
const arcana = items.filter(i => i.type === "arcanum"
    && !this._stonetopCharacter.ownedArcanaSlugs.has(i.system?.slug));
```

Follower duplicate-prevention (upgrade `owned=false → owned=true`): handled in `_onCreateDescendantDocuments`.

### 2. Add arcanum and follower handlers in `_onCreateDescendantDocuments`

In `StonetopCharacter._onCreateDescendantDocuments(documents)`:

```js
for (const item of documents.filter(d => d.type === "arcanum")) {
    await this._arcana.onArcanumCreated(item);
}
for (const item of documents.filter(d => d.type === "npc")) {
    await this._followers.onFollowerCreated(item);
}
```

**`CharacterArcana.onArcanumCreated(item)`** — new method:
- Uses `item.system.front`, `item.system.back` (plain objects, stored correctly by Foundry)
- Calls `embedLinkedFollowers` for any linked follower slugs in `back.choices.list`
- Calls `_syncEmbeddedItemWith(slug, { front: item.system.front, back: item.system.back })`

**`CharacterFollowers.onFollowerCreated(item)`** — new method:
- If an `npc` item with the same slug already exists with `owned=false` (pre-embedded linked follower): update it to `owned=true`, delete the just-created duplicate
- Otherwise: set `owned=true` on the new item via `updateEmbeddedDocuments`

### 3. Fix `FoundryArcanaRepository.findBySlug` to return plain data

`addArcanum(slug)` is still called from migrations (`migrateArcana`). For that path, ensure the repo returns plain objects not class instances:

```js
function _toRaw(doc) {
    return { slug: doc.system.slug, major: doc.system.major ?? false,
             name: doc.name, img: doc.img ?? null,
             front: doc.system.front ?? null, back: doc.system.back ?? null };
}
```

Remove the `new Arcanum(...)` wrapping from `findBySlug`. Update `FakeArcanaRepository` and its tests accordingly.

### 4. Data repair migration

Add `migrateArcanumPackData(actor, arcanaRepo)` to `migrateCharacter.js`:

- Finds embedded arcanum items where `front` is `{}` (or empty)
- Re-fetches raw data from the pack by slug
- Updates `system.front` and `system.back` to the correct plain objects

This repairs arcanum items that were embedded with the broken code.

---

## Files to Change

| File | Change |
|---|---|
| `src/actors/character/StonetopCharacter.js` | Remove arcana/follower loops from `onDropItems`; add `onArcanumCreated`/`onFollowerCreated` calls in `_onCreateDescendantDocuments`; expose `ownedArcanaSlugs` getter |
| `src/actors/character/StonetopCharacterSheet.js` | Add arcana dedup check before `super._onDropItemCreate`; pass arcana+followers to super |
| `src/actors/character/CharacterArcana.js` | New `onArcanumCreated(item)` method; remove now-unused `addArcanum(slug)` from non-migration paths |
| `src/actors/character/CharacterFollowers.js` | New `onFollowerCreated(item)` method |
| `src/actors/character/repositories/FoundryArcanaRepository.js` | Return plain data objects; remove `Arcanum` wrapping |
| `tests/fakes/FakeArcanaRepository.js` | Match plain data return |
| `tests/actors/character/repositories/FoundryArcanaRepository.test.js` | Update assertions (no longer `instanceof Arcanum`) |
| `src/migration/migrateCharacter.js` | Add `migrateArcanumPackData` |
| `tests/migration/migrateArcanumPackData.test.js` | New test file |
| `tests/actors/character/CharacterArcana.test.js` | Add tests for `onArcanumCreated` |
| `tests/actors/character/CharacterFollowers.test.js` | Add tests for `onFollowerCreated` |

---

## What Stays the Same

- **Moves**: `onDropMove(item)` stays — move drop has custom increment/create logic
- **Playbook, Insert**: already on the correct pattern — no change
- **`addArcanum(slug)`**: kept for migration use only, but repo fix ensures it no longer stores class instances
- **`addFollower(slug)`**: kept for pre-embedding linked followers (`embedLinkedFollowers`)

---

## Verification

```
npm test
```

Then in Foundry: drag an arcanum from the compendium onto a character. The card should render with correct title and description on both front and back.
