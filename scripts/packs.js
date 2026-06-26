// Each entry compiles into one published pack at packs/<name>. `sources` lists
// the packs/src/<dir> trees that compile into it — the journals, bestiary codex,
// locations, and lore are authored by independent generators in their own source
// dirs but ship as a single "Stonetop" JournalEntry compendium. Omit `sources`
// for a 1:1 pack whose source dir matches its name.
export const PACKS = [
	{ name: "stonetop-items",    type: "Item" },
	{
		name: "stonetop-journal",
		type: "JournalEntry",
		sources: ["stonetop-journals", "stonetop-bestiary-journal", "stonetop-locations", "stonetop-lore"],
	},
	{ name: "stonetop-bestiary", type: "Actor" },
	{ name: "wonder-tables",     type: "RollTable" },
	// Taylor's "Wider World and Other Wonders" Book II reference, carried verbatim (his pages +
	// figure art) as a standalone GM-only compendium. NOT merged into stonetop-journal and NOT
	// world-seeded (see SeedCompendiums NON_SEEDED_JOURNAL_PACKS) — it sits alongside the fork's
	// own locations/lore as reference rather than duplicating them in the play world.
	{ name: "wider-world-and-other-wonders", type: "JournalEntry" },
];

// LevelDB key prefix for each pack's primary document type.
export const DOC_KEY_PREFIX = {
	Item:         "items",
	JournalEntry: "journal",
	Actor:        "actors",
	RollTable:    "tables",
};
