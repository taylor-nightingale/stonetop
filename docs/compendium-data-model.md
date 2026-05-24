# Compendium Data Model

All compendium items are FoundryVTT `Item` documents. Module-specific data lives entirely in `flags.stonetop`; PBTA system fields (`system.moveType`, `system.description`, etc.) are used only where the PBTA system itself reads them.

---

## Common Primitives

### `Resource`

```typescript
interface Resource {
  max:      number;
  title:    string | null;   // display label above the track (e.g. "Stock")
  labels:   string[];        // one label per pip, from low to high (e.g. ["low ammo", "all out"])
  // Only in arcana back.resource:
  maxStat?: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA"; // max = actor's stat value
}
```

### `OutfitItem` (inline, not a compendium item)

Used inside `specialPossessions.options[].outfitItems` and `specialPossessions.options[].choices.list[].options[].outfitItems`.

```typescript
interface OutfitItem {
  slug:            string;
  name:            string;
  weight:          number;          // 1 = one diamond in the regular column
  inventoryColumn: "regular" | "small";
  note?:           string | null;   // HTML, shown in parentheses
  resource?:       Resource | null;
}
```

### `ChoiceRow` and `ChoiceHeading` (follower description choices)

Used in `followers[].description[]` only. Each row is either a display heading or a set of selectable options.

```typescript
type ChoiceHeadingRow = {
  heading: string;          // display text (not selectable)
};

type ChoiceOptionRow = {
  inline:  true;
  options: { slug: string; label: string }[];
};

type ChoiceRow = ChoiceHeadingRow | ChoiceOptionRow;
```

### `ChoiceGroup` (arcana unlock / lore / possession choices)

Used in `arcana.front.unlock`, playbook/post-death-insert `lore[]`, and `specialPossessions.options[].choices`. A named group with a flat list of typed items dispatched by `type`.

```typescript
interface ChoiceGroup {
  slug: string;             // identifies this group for state storage
  list: ChoiceListItem[];   // first item is always type "heading"
}

type ChoiceListItem =
  | { type: "heading"; title?: string | null; description?: string | null; note?: string | null }
  // Non-interactive label. `title` as section heading, `description` as body, `note` in parentheses.

  | { type: "track"; slug: string; description: string; max: number }
  // Trackable checkbox track. `max` checkboxes; checked count persisted per (group slug, item slug).
  // Used in arcana unlock and lore.

  | { type: "text"; slug: string; description: string }
  // Free-text input. Value persisted per (group slug, item slug). Used in lore only.

  | { type: "pick"; pickCount: number; options: PickOption[]; inline?: boolean }
  // Pick-mode row. pickCount=1 → radio (exclusive); pickCount>1 → multi-select checkboxes.
  // Used in possession choices.

type PickOption = {
  slug:         string;
  label:        string;
  outfitItems?: OutfitItem[];   // items added to inventory when this option is chosen
};
```

---

## Arcana (`packs/src/arcana/`)

FoundryVTT item type: `equipment`, `system.equipmentType = "arcana"`.

```typescript
interface MinorArcanum {
  slug: string;

  front: {
    title:       string;
    item:        ArcanaItem | null;
    description: string;   // HTML
    unlock: ChoiceGroup;   // slug = the arcanum's own slug
  };

  back: {
    title:       string;
    item:        ArcanaItem | null;
    description: string;    // HTML
    resource:    Resource | null;
    move:        ArcanaMove | null;
  };
}

interface ArcanaItem {
  name:            string;
  weight:          number | null;
  note:            string | null;  // HTML
  inventoryColumn: "regular" | "small" | null;
  resource?:       Resource;       // only present when item has a resource track
}

interface ArcanaMove {
  name:        string;
  rollType:    string | null;
  description: string;   // HTML
}
```

---

## Outfit Items (`packs/src/outfit-items/`)

FoundryVTT item type: `equipment`, `system.equipmentType = "outfit"`.

```typescript
interface OutfitItemRecord {
  slug:            string;
  inventoryColumn: "regular" | "small";
  sortOrder:       number;       // controls display order within its column/group
  weight?:         number;       // omit for small items (weight = 0 / not applicable)
  note?:           string;       // HTML, shown in parentheses
  breakBefore?:    boolean;      // insert a separator above this item
  twoCol?:         boolean;      // render in a two-column grid with adjacent items
  smallGrid?:      boolean;      // render in the small-item grid at the bottom of the column
  resource?:       Resource;
}
```

---

## Playbooks (`packs/src/playbooks/`)

FoundryVTT item type: `class`.

```typescript
interface Playbook {
  hp:     number;
  damage: string;   // e.g. "d8"

  moves: string[];  // slugs of playbook moves that are always granted

  backgrounds: Background[];
  instincts:   Instinct[];
  appearance:  AppearanceRow[];  // one row per display line; each row has inline options with slugs
  origin:      OriginRegion[];

  specialPossessions: SpecialPossessions | null;

  statsNote: string;  // displayed beneath the stats block

  lore: ChoiceGroup[] | null;
}

interface Background {
  slug:        string;
  label:       string;
  description: string;  // HTML
}

interface Instinct {
  word:        string;
  description: string;
}

interface AppearanceRow {
  inline:  true;               // always true; options render on one horizontal line
  options: { slug: string; label: string }[];
}

interface OriginRegion {
  region: string;
  names:  string[];
}
```

### `SpecialPossessions`

```typescript
interface SpecialPossessions {
  pickCount:   number;
  pickNote:    string;        // shown next to the section heading
  preselected: string[];      // slugs always granted (not counted against pickCount)
  options:     PossessionOption[];
}

interface PossessionOption {
  slug:        string;
  label:       string;        // HTML
  description: string;        // HTML
  outfitItems?: OutfitItem[]; // items always added to inventory when this possession is selected
  resource?:   Resource;      // tracked resource on the possession itself
  usesBonus?:  UsesBonus;     // scales resource.max with level / owned moves
  choices?:    ChoiceGroup;   // see ChoiceGroup above; type "pick" rows only
}

interface UsesBonus {
  evenLevelBonus?: number;    // added once per 2 levels (level 2, 4, 6, …)
  moveBonus?: {
    moveName:    string;
    perInstance: number;      // added once per owned move of this name
  }[];
}
```

---

## Moves

FoundryVTT item type: `move`. All move types share the same `system` shape; `moveType` and `playbook` distinguish them.

Packs: `basic-moves/`, `special-moves/`, `playbook-moves/<playbook>/`, `post-death-moves/<insert>/`

```typescript
interface Move {
  system: {
    moveType:     "basic" | "special" | "playbook" | "post-death";
    playbook?:    string;        // playbook display name or post-death insert slug; omitted for basic/special
    description:  string;        // HTML
    rollType:     string | null; // stat slug (e.g. "int") or null for no roll; omitted on basic moves
    moveResults?: {
      success?: { label: string; value: string };
      partial?: { label: string; value: string };
      failure?: { label: string; value: string };
    };
  };
}
```

---

## Post-Death Inserts (`packs/src/post-death-inserts/`)

FoundryVTT item type: `class`.

```typescript
interface PostDeathInsert {
  instincts: Instinct[];   // same shape as Playbook.instincts
  lore:      ChoiceGroup[];  // same shape as Playbook.lore
}
```

---

## Followers (`packs/src/followers/`)

FoundryVTT item type: `equipment`, `system.equipmentType = "follower"`.

Followers are referenced by slug in actor flags (same pattern as arcana) — they are **not** embedded documents. When a follower is dropped onto the sheet its slug is appended to `actor.flags.stonetop.followers.owned`.

```typescript
interface Follower {
  slug:     string;
  note:     string | null;    // trait keywords shown under the name, e.g. "Bird-wise, innocent"
  hp:       { max: number };
  armor:    number;
  damage:   string | null;    // e.g. "bronze knife d4 (hand)"
  instinct: FollowerInstinct | null;
  cost:     string | null;    // display text, e.g. "knowledge, secret lore; Loyalty"
  loyalty:  { max: number };
  description: FollowerDescriptionRow[];
}
```

### Instinct (three formats — distinguished by shape)

```typescript
// Static: one main text plus a bullet list of sub-options (display-only)
type StaticInstinct  = { text: string; options: string[] };

// Pick-one: choose one from a short list
type ChoicesInstinct = { choices: { slug: string; label: string }[] };

// Custom: free-text entry
type CustomInstinct  = null;

type FollowerInstinct = StaticInstinct | ChoicesInstinct | CustomInstinct;
```

### Description rows

Uses the `ChoiceRow` model. Each row is either a display heading or a set of inline selectable options.

```typescript
type FollowerDescriptionRow =
  | { heading: string }                                      // display-only heading
  | { inline: true; options: { slug: string; label: string }[] };  // choose one from this line
```

### Actor flags storage

```typescript
actor.flags.stonetop.followers = {
  owned: string[],          // follower slugs, in the order they were added
  state: {
    [slug: string]: {
      hp:              number | null,    // null → use hp.max from pack item
      loyalty:         number | null,    // null → use loyalty.max from pack item
      descriptionSlugs: string[],        // one selected slug per choice row (by rowIdx)
      instinctSlug:    string | null,    // for choices-type instincts
      instinctCustom:  string,           // for null/custom instincts
    }
  }
}
```
