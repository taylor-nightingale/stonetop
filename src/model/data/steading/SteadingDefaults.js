import { RatingDefinition } from "./RatingDefinition.js";

// Every ±N rating runs the same range, named once so the five of them can't drift apart.
const BONUSES = [-1, 0, 1, 2, 3];

const SIZE_TIERS = ["hamlet", "village", "town", "city"];

const DEFENSE_TIERS = ["feeble", "mediocre", "strong", "formidable", "legendary"];

// The two ratings the book arches, extracted from the steading playbook page by
// scripts/import/pdf/steading-art.js into the gitignored art store. Written out in full rather than
// built from the slug: the shipped art manifest is scanned out of the source, so a path assembled at
// runtime is a path the installer never learns to recognize.
// TRADE DRESS, so these ship with the system rather than living in the gitignored art store: the
// same call the four season glyphs get. They are the book's own device for its two crowned ratings —
// small, structural, and meaningless outside this sheet — where the plates beside them (the harvest
// spread, the residents) are illustrations and stay copyrighted.
//
// Committed also means they are always there: no install step, nothing to 404, and the rail reads
// the same in a world whose owner has never opened the art installer.
const FORTUNES_ARCH = "systems/stonetop/assets/content/steading/fortunes.png";
const SURPLUS_ARCH  = "systems/stonetop/assets/content/steading/surplus.png";

export const SteadingDefaults = {
	fortunes: new RatingDefinition("fortunes", {
		titleKey: "stonetop.steading.attr.fortunes",
		shortTitleKey: "stonetop.steading.attrShort.fortunes",
		badge:    FORTUNES_ARCH,
		bonuses:  BONUSES,
	}),
	surplus: new RatingDefinition("surplus", {
		// Surplus is a raw count, not a ±N rating: it floors at nothing in store and names no ceiling.
		titleKey: "stonetop.steading.attr.surplus",
		shortTitleKey: "stonetop.steading.attrShort.surplus",
		badge:    SURPLUS_ARCH,
		min:      0,
	}),

	attributes: {
		// Size is a named tier, not a number — `values` are the strings a steading stores, and each
		// carries the book's population band beside its name.
		size: new RatingDefinition("size", {
			titleKey: "stonetop.steading.attr.size",
		shortTitleKey: "stonetop.steading.attrShort.size",
			values:   SIZE_TIERS,
			tierKeys: SIZE_TIERS.map(tier => `stonetop.steading.tier.size.${tier}`),
			bandKeys: SIZE_TIERS.map(tier => `stonetop.steading.band.${tier}`),
		}),
		population: new RatingDefinition("population", {
			titleKey: "stonetop.steading.attr.population",
		shortTitleKey: "stonetop.steading.attrShort.population",
			bonuses:  BONUSES,
		}),
		prosperity: new RatingDefinition("prosperity", {
			titleKey: "stonetop.steading.attr.prosperity",
		shortTitleKey: "stonetop.steading.attrShort.prosperity",
			bonuses:  BONUSES,
		}),
		defenses: new RatingDefinition("defenses", {
			titleKey: "stonetop.steading.attr.defenses",
		shortTitleKey: "stonetop.steading.attrShort.defenses",
			bonuses:  BONUSES,
			tierKeys: DEFENSE_TIERS.map(tier => `stonetop.steading.tier.defenses.${tier}`),
		}),
	},

	/**
	 * One rating by slug, wherever this object files it.
	 *
	 * The book crowns Fortunes and Surplus and rules the other four plainly, and the shape here keeps
	 * that split because the sheet draws it. A caller that only wants "the rating called `population`"
	 * should not have to know which half it lives in — which is what every caller used to do by hand.
	 *
	 * Guarded by the type rather than by a list of names, so `rating("debilities")` is null instead of
	 * an array pretending to be a rating.
	 */
	rating(slug) {
		const found = this.attributes[slug] ?? this[slug];
		return found instanceof RatingDefinition ? found : null;
	},

	// `hindersMoves` lists the move slugs an active debility rolls at disadvantage. The book scopes
	// *diminished* to three named moves rather than to a rating, so a bare Population roll — or a
	// future move that happens to roll +Population — is untouched.
	debilities: [
		{ slug: "diminished", hindersMoves: ["deploy", "muster", "pull-together"] },
		{ slug: "lacking",    hindersMoves: [] },
		{ slug: "malcontent", hindersMoves: [] },
	],
};
