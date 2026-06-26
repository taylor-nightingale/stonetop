// The creature-type taxonomy from Stonetop Book I, "Dangers" p.392 ("Monster
// types"). Each type has a circular icon (extracted from that page) used as the
// default art for stat blocks without custom imagery. Shared by the stat-block
// sheet and the bulk importer, so it's a plain ES module with no Foundry deps.

export const CREATURE_TYPE_ICON_DIR = "systems/stonetop/assets/icons/bestiary";

export const CREATURE_TYPES = [
	{ slug: "human-individual", label: "Human (individual)" },
	{ slug: "human-group",      label: "Humans (group)" },
	{ slug: "natural-beast",    label: "Natural / Beast" },
	{ slug: "spirit",           label: "Spirit" },
	{ slug: "construct",        label: "Construct" },
	{ slug: "spirit-construct", label: "Spirit / Construct" },
	{ slug: "fae",              label: "Fae" },
	{ slug: "undead",           label: "Undead" },
	{ slug: "corrupted",        label: "Corrupted / Fomoraij" },
	{ slug: "maker",            label: "Maker" },
	{ slug: "emanation",        label: "Emanation" },
	{ slug: "thing-below",      label: "Thing Below" },
	{ slug: "unknown-origin",   label: "Unknown Origin" },
];

export const CREATURE_TYPE_CHOICES = Object.fromEntries(
	CREATURE_TYPES.map(t => [t.slug, t.label]),
);

/** Absolute path (from the Foundry data root) to a type's icon, or null. */
export function creatureTypeIcon(slug) {
	if (!slug) return null;
	const found = CREATURE_TYPES.find(t => t.slug === slug);
	return found ? `${CREATURE_TYPE_ICON_DIR}/${found.slug}.svg` : null;
}

export function creatureTypeLabel(slug) {
	return CREATURE_TYPE_CHOICES[slug] ?? "";
}

// Font Awesome (solid) glyph per type, for compact UI like the monster→follower
// banner where the circular art icons would be too heavy. Keyed by the same
// slugs as CREATURE_TYPES.
const CREATURE_TYPE_FA = {
	"human-individual": "fa-user",
	"human-group":      "fa-users",
	"natural-beast":    "fa-paw",
	"spirit":           "fa-ghost",
	"construct":        "fa-gear",
	"spirit-construct": "fa-gears",
	"fae":              "fa-hat-wizard",
	"undead":           "fa-skull",
	"corrupted":        "fa-biohazard",
	"maker":            "fa-hammer",
	"emanation":        "fa-bolt",
	"thing-below":      "fa-water",
	"unknown-origin":   "fa-circle-question",
};

/** Font Awesome class for a type, defaulting to a generic monster glyph. */
export function creatureTypeFaIcon(slug) {
	return CREATURE_TYPE_FA[slug] ?? "fa-dragon";
}
