/**
 * CharacterSnapshot — the canonical read-only data object returned by
 * `StonetopCharacter.buildSnapshot()`.
 *
 * This file is documentation only. All logic lives on StonetopCharacter.
 * External sheets and systems consume this shape directly — no Foundry APIs
 * or Stonetop internals required after the snapshot is built.
 *
 * @typedef {Object} Resource
 * Unified resource track used everywhere (moves, inventory items, possessions, pools).
 * @property {number} current - checks used
 * @property {number} max     - total capacity
 * @property {string|null} title  - track label (e.g. "Stock", "Ammo"); null = unlabeled
 * @property {string[]} labels    - per-check labels; [] = plain unlabeled checkboxes
 *
 * @example
 * // Move "Rites of the Land"
 * { current: 1, max: 4, title: null, labels: [] }
 * // Inventory "Bow & arrows"
 * { current: 0, max: 2, title: null, labels: ["low ammo", "all out"] }
 * // Possession stock
 * { current: 2, max: 3, title: "Stock", labels: [] }
 * // Outfit regular pool
 * { current: 3, max: 9, title: null, labels: [] }
 */

/**
 * @typedef {Object} CharacterSnapshot
 * @property {string} name - character name
 * @property {PlaybookSnapshot|null} playbook
 * @property {DebilitySnapshot[]} debilities - always 3: weakened, dazed, miserable
 * @property {Object.<string, StatSnapshot>} stats - keys: str dex con int wis cha
 * @property {VitalsSnapshot} vitals
 * @property {MoveCategorySnapshot[]} moves - only categories with ≥1 move included
 * @property {InventorySnapshot} inventory
 * @property {string} rollMode - "normal" | "adv" | "dis"
 */

/**
 * @typedef {Object} PlaybookSnapshot
 * @property {string} slug
 * @property {string} name
 * @property {string|null} img
 * @property {string|null} description
 * @property {string|null} statsNote
 * @property {{ selected: string|null, options: BackgroundOptionSnapshot[] }} background
 * @property {{ selected: string|null, options: { word: string, description: string }[] }} instinct
 * @property {{ saved: Object.<number,string>, options: string[][] }} appearance
 *   options is an array-of-arrays of plain strings; position = line index
 * @property {{ selected: string|null, options: { region: string, names: string[] }[] }} origin
 */

/**
 * @typedef {Object} BackgroundOptionSnapshot
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {string[]} moves - move slugs granted by this background
 * @property {{ label: string, count: number[], options: {slug:string,label:string}[], saved: Object.<string,boolean> }|null} choices
 */

/**
 * @typedef {Object} DebilitySnapshot
 * @property {string} key    - "weakened" | "dazed" | "miserable"
 * @property {string} name   - "Weakened" | "Dazed" | "Miserable"
 * @property {boolean} active
 * @property {string[]} stats - stat keys affected, e.g. ["str","dex"]
 */

/**
 * @typedef {Object} StatSnapshot
 * @property {number} value
 * @property {string} name - e.g. "Strength"
 * @property {string} abbr - e.g. "STR"
 */

/**
 * @typedef {Object} VitalsSnapshot
 * @property {{ value: number, max: number }} hp  - max = playbook.hp; both 0 if no playbook
 * @property {string|null} damage - e.g. "d10"; null if no playbook
 * @property {number} armor
 * @property {number} level
 * @property {{ value: number, max: number }} xp  - max = 6 + level * 2
 */

/**
 * @typedef {Object} MoveCategorySnapshot
 * @property {string} key   - "playbook" | "basic" | "background" | "special" | ...
 * @property {string} title - e.g. "The Heavy Moves", "Basic Moves"
 * @property {string|null} note - e.g. startingMovesNote; null for basic/other
 * @property {MoveSnapshot[]} moves
 */

/**
 * @typedef {Object} MoveSnapshot
 * @property {string} id          - compendium document ID
 * @property {string} name
 * @property {string} description
 * @property {string|null} rollType - stat key | "ask" | "prompt" | null
 * @property {boolean} isStarting
 * @property {{ type: string, slug?: string }} source
 *   type: "playbook" (+ slug) | "basic" | "background" | "special" | ...
 * @property {boolean} owned
 * @property {string[]} ownedIds
 * @property {boolean} locked
 * @property {{ label: string, met: boolean }|null} requirement
 * @property {Resource|null} resource
 * @property {{ max: number, current: number }|null} repeat
 */

/**
 * @typedef {Object} InventorySnapshot
 * @property {OutfitSnapshot} outfit
 * @property {PossessionsSnapshot|null} possessions - null if no playbook or no specialPossessions
 * @property {OtherItemSnapshot[]} other - compendium items dragged onto the sheet
 */

/**
 * @typedef {Object} OutfitSnapshot
 * @property {{ instruction: string, selected: string|null, options: LoadOptionSnapshot[] }} load
 * @property {InventoryItemSnapshot[]} regularItems
 * @property {Resource} regularPool
 * @property {InventoryItemSnapshot[]} smallItems
 * @property {InventoryItemSnapshot[]} smallGridItems
 * @property {Resource} smallPool
 */

/**
 * @typedef {Object} LoadOptionSnapshot
 * @property {string} slug  - "light" | "normal" | "heavy"
 * @property {string} label
 * @property {string} note  - localized description string
 */

/**
 * @typedef {Object} InventoryItemSnapshot
 * @property {string} slug
 * @property {string} name
 * @property {string|null} note
 * @property {number} weight - number of load slots
 * @property {boolean} checked
 * @property {Resource|null} resource
 * @property {boolean} isCustom
 * @property {boolean} twoCol
 * @property {boolean} breakBefore
 */

/**
 * @typedef {Object} PossessionsSnapshot
 * @property {number} pickCount
 * @property {string} pickNote
 * @property {PossessionItemSnapshot[]} items
 */

/**
 * @typedef {Object} PossessionItemSnapshot
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {boolean} disabled
 * @property {boolean} preselected
 * @property {Resource|null} resource
 * @property {Object|null} choices
 * @property {Object|null} choiceGroups
 */

/**
 * @typedef {Object} OtherItemSnapshot
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} moveType
 */
