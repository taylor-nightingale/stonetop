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

Used inside `specialPossessions.options[].outfitItems` and `specialPossessions.options[].choices[].options[].outfitItems`.

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

### `ChoiceRow` and `ChoiceHeading`

`choices` is always a flat array of rows. Each row is either a heading separator or a set of selectable options.

```typescript
type ChoiceHeadingRow = {
  heading: string;          // display text (not selectable)
  note?:   string | null;   // shown in parentheses after heading
};

type ChoiceOptionRow = {
  pickCount: number;        // how many options may be selected; 1 = radio buttons, >1 = checkboxes
  options: {
    slug:         string;
    label:        string;           // HTML
    outfitItems?: OutfitItem[];     // items added to inventory when this option is chosen
  }[];
};

type ChoiceRow = ChoiceHeadingRow | ChoiceOptionRow;
```

---

## Arcana (`packs/src/arcana/`)

FoundryVTT item type: `move`, `system.moveType = "arcanum"`.

```typescript
interface MinorArcanum {
  slug: string;

  front: {
    title:       string;
    item:        ArcanaItem | null;
    description: string;   // HTML
    unlock: {
      description:  string;   // HTML lead-in for the unlock section
      requirements: UnlockRequirement[];
    };
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

type UnlockRequirement =
  | { type: "text";   description: string }         // display-only HTML paragraph
  | { type: "option"; slug: string; description: string; max?: number };  // trackable checkbox; max defaults to 1

interface ArcanaMove {
  name:        string;
  rollType:    string | null;
  description: string;   // HTML
}
```

---

## Outfit Items (`packs/src/outfit-items/`)

FoundryVTT item type: `equipment`, `system.equipmentType = "inventory"`.

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
  appearance:  string[][];  // outer array = rows; inner array = options per row
  origin:      OriginRegion[];

  specialPossessions: SpecialPossessions | null;

  statsNote: string;  // displayed beneath the stats block

  lore: LoreEntry[] | null;
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
  choices?:    ChoiceRow[];   // see ChoiceRow above
}

interface UsesBonus {
  evenLevelBonus?: number;    // added once per 2 levels (level 2, 4, 6, …)
  moveBonus?: {
    moveName:    string;
    perInstance: number;      // added once per owned move of this name
  }[];
}
```

### `LoreEntry`

```typescript
interface LoreEntry {
  slug:        string;
  title:       string;
  description: string;        // HTML, shown above the options
  options:     LoreOption[];
}

type LoreOption =
  | { slug: string; description: string; max: number }        // checkbox track; type = "checkbox"
  | { slug: string; description: string; type: "text" }       // free-text input
  | { slug: string; description: string }                     // display-only heading; no max, no type
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
  lore:      LoreEntry[];  // same shape as Playbook.lore
}
```
