// Plain-language meanings for the recurring monster tags used on stat blocks —
// the organization, size, nature, and behavior terms from Book I "Dangers"
// (pp.392-398). Surfaced as hover tooltips on the stat-block header tag line.
//
// Only the recurring, meaningful tags live here; the long tail of one-off
// flavor tags (e.g. "grumpy", "drunkard") intentionally has no entry and simply
// renders as plain text. Shared as a Foundry-free ES module so it can be unit
// tested and reused by the importer.

export const MONSTER_TAGS = {
	// ── Organization (every monster has one; drives HP & damage) ──────────────
	solitary:   "Fights or hunts by itself. A solitary creature is tougher than its kin — roughly 12 HP and d10 damage on its own.",
	group:      "Travels and fights in small groups of 2–5. Each member has about 6 HP and deals d8 damage.",
	horde:      "Swarms in large groups of 6 or more. Each member is weak — about 3 HP and d6 damage — but dangerous through sheer numbers.",

	// ── Size (fictional scale; modifies HP and damage) ────────────────────────
	tiny:       "Cat-sized or smaller. Frail (−2 HP) and short-reaching, but hard to hit.",
	small:      "About the size of a human child.",
	large:      "As big as a horse or cart. Sturdier than a person (+4 HP).",
	huge:       "Elephant-sized or bigger. Tremendously durable (+8 HP) and hits hard, often from a distance.",

	// ── Nature (what kind of thing it fundamentally is) ───────────────────────
	construct:  "A made thing — animated but not truly alive. Often immune to effects that target living bodies.",
	spirit:     "A being of the Spirit World, wholly or partly immaterial. May be hard to harm by ordinary means.",
	undead:     "Animate dead: once-living, now sustained by some unnatural force. Unmoved by what afflicts the living.",
	corrupted:  "Twisted and defiled by the Things Below or similar foul power.",
	fae:        "A creature of Faerie, bound by ancient pacts and strange rules.",
	primordial: "An elemental, primal force from the world's deep origins.",
	emanation:  "A manifestation or projection of a greater power, not a discrete body of its own.",

	// ── Behavior & traits (Book I p.395 grounds the first set) ────────────────
	hoarder:     "Amasses trinkets and treasure.",
	cautious:    "Avoids fights and flees early.",
	cunning:     "Clever, calculating intelligence.",
	devious:     "Tricky, scheming intelligence — favors deception and misdirection.",
	terrifying:  "Has a disturbing or terrible presence; facing it can require steeling yourself.",
	stealthy:    "Sneaks, surprises, and ambushes.",
	magical:     "Uses spells or magic.",
	organized:   "Works well in groups, with coordination and tactics.",
	hardy:       "Tough and resilient; shrugs off hardship and punishment.",
	amorphous:   "Has no fixed form; hard to harm by conventional means and able to squeeze through gaps.",
	fearless:    "Knows no fear — won't flee, falter, or be cowed.",
	implacable:  "Relentless and unstoppable; cannot be reasoned with or deterred.",
	fierce:      "Ferocious and aggressive in a fight.",
	clever:      "Quick-witted and resourceful.",
	beautiful:   "Strikingly beautiful, in a way that draws others in or disarms them.",
	tireless:    "Never wearies; can press on without rest.",
	amphibious:  "Equally at home on land and in water.",
	aquatic:     "Lives in the water; swims swiftly and breathes beneath the surface.",
	athletic:    "Powerful and agile — climbs, leaps, and runs well.",
	aggressive:  "Quick to attack and press the fight.",
	violent:     "Prone to sudden, brutal violence.",
	vicious:     "Cruel and savage; fights to maim and kill.",
	gluttonous:  "Driven by relentless hunger; consumes without restraint.",
	disciplined: "Trained and self-controlled; holds formation and follows orders.",
};

/**
 * Look up the description for a single raw tag string (case/space-insensitive),
 * or null if it isn't a known monster tag.
 */
export function findMonsterTag(rawText) {
	const text = String(rawText ?? "").trim().toLowerCase();
	return MONSTER_TAGS[text] ?? null;
}
