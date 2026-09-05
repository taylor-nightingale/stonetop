import { rich } from "../RichText.js";

/**
 * One rating as a ledger tile draws it — the number stated outright, the word the book gives that
 * number, how far it has travelled from its starting baseline, and what a debility is costing it.
 *
 * One class for all six ratings. A numeric rating renders a stepper bounded by `min`/`max`; a named
 * one (Size) renders `options`. Everything else is shared, so the tile partial never branches on
 * which rating it was handed.
 */
export class RatingSnapshot {
	constructor(def, { current, starting = null, adjustment = null, items = [] } = {}) {
		this.slug      = def.slug;
		this.title     = def.title;
		this.shortTitle = def.shortTitle;
		// The book's arch, for the two ratings it crowns; null for the four it rules plainly.
		this.badge     = def.badge;
		// The stored value — a bonus (−1…+3), a raw count, or Size's tier string.
		this.current   = current;
		this.tierLabel = def.tierLabel(current);
		this.band      = def.band(current);
		this.isNumeric = def.isNumeric;
		this.min       = def.min;
		this.max       = def.max;
		// Stated separately because a bound of 0 is a real bound, and `{{#if min}}` would drop it.
		this.hasMin    = def.min !== null;
		this.hasMax    = def.max !== null;
		// The values a named rating picks between; empty for the numeric ones, which step instead.
		// A select with nothing matching would silently display its first option — so a steadfast
		// that has not chosen a Size yet would read as a hamlet. Offer "unset" instead, and say so.
		this.options   = def.isNumeric ? [] : withUnsetOption(def.selectOptions(current));
		// The lists backing a rating — resources (Prosperity) or fortifications (Defenses).
		this.items     = items;

		// "was +0", and only once the rating has actually moved off the baseline a steadfast set —
		// a hint that restates the current value is noise.
		this.startingNote = (starting == null || starting === current)
			? ""
			: game.i18n.format("stonetop.steading.startingValue", { value: formatStartingValue(def.slug, starting) });

		// "→ 0 lacking" — the number you actually roll, and what made it that. A bare "−1" printed
		// beside the stored value reads as a second value rather than as arithmetic on the first.
		this.adjustment = adjustment
			? game.i18n.format("stonetop.steading.adjustedBy", {
				effective: formatDelta(current + adjustment.delta),
				debility:  game.i18n.localize(`stonetop.steading.debilities.${adjustment.debility}.name`),
			})
			: "";

		// A rating gets ONE note beside its value, so the things it might say are ranked: what a
		// debility is doing to it right now beats the book's own gloss on the number, which beats a
		// population band.
		//
		// `startingNote` is deliberately NOT in this ranking. "was +0" is the least useful of the
		// four and the most frequent, so it put a third element on nearly every rating and made the
		// value itself ambiguous — `1  −1 lacking  was +0` reads as three numbers. The baseline is
		// still carried on the snapshot for the chronicle to use; it simply is not shown here.
		[this.note, this.noteKind] =
			this.adjustment ? [this.adjustment, "adjustment"] :
			this.band       ? [this.band, "band"] :
			this.tierLabel  ? [this.tierLabel, "tier"] :
			["", ""];
	}
}

/** A debility, as the header line states it: its name, what causes it, and what it does. */
export class DebilitySnapshot {
	constructor(slug, active) {
		this.slug   = slug;
		this.name   = game.i18n.localize(`stonetop.steading.debilities.${slug}.name`);
		this.cause  = game.i18n.localize(`stonetop.steading.debilities.${slug}.cause`);
		this.effect = game.i18n.localize(`stonetop.steading.debilities.${slug}.effect`);
		this.active = active;
	}
}

// A blank leading option, ticked, when the stored value matches none of them — the honest rendering
// of "not chosen yet", which a bare select cannot express on its own.
function withUnsetOption(options) {
	if (options.some(o => o.selected)) return options;
	return [{ value: "", label: game.i18n.localize("stonetop.steading.tier.unset"), band: "", selected: true }, ...options];
}

// A minus sign, not a hyphen — this is arithmetic being read aloud, not a dash.
function formatDelta(delta) {
	return delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`;
}

// Surplus is a raw count and Size a tier name; the ±N ratings are signed (including +0), matching
// the roll-display convention (ActorRolling.js).
export function formatStartingValue(slug, value) {
	if (slug === "size" || slug === "surplus") return `${value}`;
	return `${value >= 0 ? "+" : ""}${value}`;
}

export class ContentSection {
	constructor(slug, label, note, text, items = []) {
		this.slug = slug;
		this.label = rich(label);
		this.note = rich(note);
		this.text = text;          // edit-only (rendered into a textarea) — stays a raw string
		this.items = items;
	}
}



export class SeasonsSnapshot {
	// `moves` is the ordinary MoveCategorySnapshot — the seasonal glyphs ride on each move's own
	// icon, so this tab renders through the same move-group as the Moves tab.
	constructor({ moves = null, gains = null, plate = null, turnover = null }) {
		this.moves = moves;
		this.gains = gains;
		// Where the wheel stands, and the checklist assembled from what this steading has built.
		this.turnover = turnover;
		// The harvest plate from the book's Seasons Change spread — a copyrighted illustration, so
		// null until the art installer has actually produced it. Referencing it regardless would 404
		// on every render for everyone who hasn't installed (or who only owns Book II).
		this.plate = plate;
	}

	/**
	 * The Seasons Change move that turns the season — the NEXT season's, because that is the one you
	 * roll when the season changes TO it. Rolling it is what advancing the wheel means, which is why
	 * the tab shows this one move beside the advance control and the other three apart from it.
	 *
	 * Asked of the snapshot rather than filtered in the template: "which of these four do we roll
	 * now" is a fact about the seasons, and a Handlebars comparison would put it in markup where
	 * nothing tests it.
	 */
	get nextMove() {
		return (this.moves?.moves ?? []).find(m => m.slug === this.turnover?.next?.moveSlug) ?? null;
	}

	/** The other three: reference, until their own season comes round. */
	get otherMoves() {
		const next = this.turnover?.next?.moveSlug;
		return (this.moves?.moves ?? []).filter(m => m.slug !== next);
	}

}

export class SteadingSnapshot {
	constructor({
								fortunes, surplus, attributes, debilities,
								placesOfInterest, notes, folk, folkSuggestions, neighborPlaces,
								contentDescription, content, assets, improvements, resourcesPlate,
								moves, seasons, season, year, fortunesReset, rollMode, rollModes,
								grantedMoves,
							}) {
		this.fortunes = fortunes;
		this.surplus = surplus;
		this.attributes = attributes;
		this.debilities = debilities;
		this.placesOfInterest = placesOfInterest;
		this.notes = notes;
		// One roster — residents and neighbours together, the Home column carrying the difference.
		this.folk = folk;
		// The name and trait lists the Folk tab keeps WHOLE. Never filtered: reading down them is how
		// an NPC gets made, which is why the roster's search box cannot reach them.
		this.folkSuggestions = folkSuggestions;
		this.neighborPlaces = neighborPlaces;
		this.contentDescription = contentDescription;
		this.content = content;
		this.assets = assets;
		// The Season tab's project board (an ImprovementBoard), not a bare list — it knows its own
		// order and the counts its chips state.
		this.improvements = improvements;
		// Where the wheel stands. Displayed wherever the ratings are — the ledger line states it as
		// text and the season band takes its tint from it — and advanced only on the Season tab.
		this.season = season;
		this.year   = year;
		// What "reset Fortunes" will actually set — +1, or +0 while the steading is malcontent. The
		// button states the number rather than implying one.
		this.fortunesReset = fortunesReset ?? 1;
		// Decoration under the Resources list, and null in a world whose owner has never run the art
		// installer — the template asks before it draws.
		this.resourcesPlate = resourcesPlate ?? null;
		this.moves    = moves    ?? [];
		this.seasons  = seasons  ?? null;
		// Moves an improvement CONFERS, keyed by slug. Not the steading's moves: they are read on the
		// improvement that granted them and again at the moment they fire, and each of those places
		// holds only a slug. See GrantedMoves.
		this.grantedMoves = grantedMoves ?? {};
		this.rollMode = rollMode ?? "normal";
		// The same three options the character sheet and the stat-pick dialog draw, in the same order —
		// the steading's hand-rolled copy had already drifted from them.
		this.rollModes = rollModes ?? [];
	}

	/**
	 * The homefront category — the steading's own moves — as the Play tab renders it.
	 *
	 * Asked of the snapshot rather than filtered in the template: which category is "the steading's
	 * moves" is a fact about the steading, and a Handlebars `{{#if (eq key "homefront")}}` would put
	 * that fact in the markup, where nothing tests it.
	 */
	get homefrontMoves() {
		return this.moves.find(category => category.key === "homefront") ?? null;
	}
}

export function splitIntoColumns(items, columnCount) {
	const rowsPerColumn = Math.ceil(items.length / columnCount) || 1;
	return Array.from({ length: columnCount }, (_, i) =>
		items.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn)
	);
}
