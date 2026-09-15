import { rich } from "../RichText.js";
import { SeasonProcedure } from "../../data/steading/SeasonProcedure.js";
import { buildSeasonSteps } from "./SeasonStepSnapshot.js";

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
			: game.i18n.format("stonetop.steading.startingValue", { value: formatRatingValue(def.slug, starting) });

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
		// still stored — a steadfast's starting ratings are part of its definition — and simply not
		// shown.
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
//
// Exported because every select over a NAMED rating needs it, not just this sheet's own Size: the
// neighbouring places each carry the book's tier word too, and a steadfast that has not chosen one
// would read as "hamlet" without it.
export function withUnsetOption(options) {
	if (options.some(o => o.selected)) return options;
	return [{ value: "", label: game.i18n.localize("stonetop.steading.tier.unset"), band: "", selected: true }, ...options];
}

// A minus sign, not a hyphen — this is arithmetic being read aloud, not a dash.
function formatDelta(delta) {
	return delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`;
}

// Surplus is a raw count and Size a tier name; the ±N ratings are signed (including +0), matching
// the roll-display convention (ActorRolling.js).
export function formatRatingValue(slug, value) {
	if (slug === "size" || slug === "surplus") return `${value}`;
	return `${value >= 0 ? "+" : ""}${value}`;
}

/**
 * One of the three content-policy lists, as the Content tab states it: the book's heading for it,
 * the gloss printed under that heading, and the entries the table has written.
 *
 * Localized from the slug, the way a debility is — the English lived in SteadingContent.js, which
 * made three headings on a shipped tab untranslatable. Only two of the three carry a note (the book
 * prints none under Special Handling), so an absent key means no note rather than an empty one.
 */
export class ContentSection {
	constructor(slug, items = []) {
		this.slug  = slug;
		this.label = rich(game.i18n.localize(`stonetop.steading.content.sections.${slug}.label`));
		this.note  = rich(localizeIfPresent(`stonetop.steading.content.sections.${slug}.note`));
		this.items = items;
	}
}

const localizeIfPresent = key => (game.i18n.has(key) ? game.i18n.localize(key) : "");



export class SeasonsSnapshot {
	// `moves` is the ordinary MoveCategorySnapshot — the seasonal glyphs ride on each move's own
	// icon, so this tab renders through the same move-group as the Moves tab.
	constructor({ moves = null, pick = null, plate = null, turnover = null, applied = {}, outcome = null }) {
		this.moves = moves;
		// The choice THIS season hands the table — a SeasonPick, or null for a season that hands
		// none. Built from the current season's own move, so winter offers losses rather than being
		// handed the gains list, and summer offers two.
		this.pick = pick;
		// Where the wheel stands, and the checklist assembled from what this steading has built.
		this.turnover = turnover;
		// The harvest plate from the book's Seasons Change spread — a copyrighted illustration, so
		// null until the art installer has actually produced it. Referencing it regardless would 404
		// on every render for everyone who hasn't installed (or who only owns Book II).
		this.plate = plate;

		// The Seasons Change move of the season the steading is IN, and the procedure it prescribes.
		//
		// The current season's, not the incoming one's. The tab used to render the INCOMING season's
		// steps — you roll a season's move to enter it — while every piece of state beside them (the
		// gain in force, the turnover checklist, the adjustments) belonged to the season the steading
		// was already in. So the numbered list and the things it produced were never the same season.
		//
		// Built once, as OWN properties rather than getters, because a step carries the move's words
		// as a RichText and enrichRichTextTree walks own enumerable keys — a getter is invisible to
		// it, so the text would never be enriched and every roll and @UUID in a step would render as
		// source. Building once also stops the template getting a fresh procedure on each mention.
		this.currentMove = this.moveFor(this.turnover?.season?.moveSlug);

		// Each step with everything this steading brings to it: the dice it actually rolls after the
		// improvements that bend them, what it actually pays, what it has already done to Surplus,
		// and the choice it calls for. The partial used to reach back up to the root for the last
		// two, which is the shape of the object that was missing.
		const built = buildSeasonSteps({
			procedure: SeasonProcedure.from(this.currentMove),
			statement: this.turnover?.statement ?? null,
			applied,
			pick,
			// The moments this season's move numbers are steps like any other — what fires at the
			// harvest is rolled and paid at the harvest, not in a panel below the list.
			moments: this.turnover?.moments ?? [],
			// Winter's dice are the steading's Size's — 1d2 in a hamlet, 2d6 in a town.
			size:    this.turnover?.size ?? null,
			// Which of the move's three results the table is living with, so the step that rolls
			// them lights the row the dice landed on.
			outcome,
		});
		this.steps = built.steps;
		// The bends no step of this season claimed — the Golden Sapling's generation in a season that
		// generates nothing. Stated in the general list rather than dropped.
		this.adjustments = built.adjustments;
		// The moments no step numbers — the gathering at the inn, the aurochs hunt in a spring whose
		// move does not name it. These keep a panel of their own, with their own Apply; the harvest
		// does not, because the step that rolls it is where it is paid.
		this.unclaimedMoments = built.unclaimedMoments;
	}

	/** The seasons category's move for a slug, or null — the tab's one lookup. */
	moveFor(moveSlug) {
		return (this.moves?.moves ?? []).find(m => m.slug === moveSlug) ?? null;
	}

}

/**
 * The choice a season hands the table: the step that offers it, and the rendered group.
 *
 * A pair with a name, because the two are read together and neither is much use alone — the group is
 * what the table ticks, and the STEP is what says which list it is and how many the season offers.
 */
export class SeasonPick {
	constructor(step, group) {
		this.step  = step;    // a PickStep
		this.group = group;   // the built choice group
	}

	get labelKey() { return this.step.labelKey; }
	get count()    { return this.step.count; }
}

export class SteadingSnapshot {
	constructor({
								fortunes, surplus, attributes, debilities,
								placesOfInterest, notes, folk, folkSuggestions, neighborPlaces,
								content, assets, improvements, resourcesPlate, residentsPlate,
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
		// The whisky jugs under the Resources list, and null in a world whose owner has never run the
		// art installer — the template asks before it draws.
		this.resourcesPlate = resourcesPlate ?? null;
		// The four figures closing the Folk roster, on the same terms as the whisky jugs above.
		this.residentsPlate = residentsPlate ?? null;
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

	/**
	 * The seasonal category — the four Seasons Change moves — as the rail renders it.
	 *
	 * Off the Seasons snapshot rather than `moves`, which lists only the categories that never
	 * claimed a tab: the seasons category is built by the tab that owns it, and this is the one
	 * other surface that draws it. Asked of the snapshot for the same reason homefront is — which
	 * category the rail's second group is, is a fact about the steading and not about the markup.
	 */
	get seasonalMoves() {
		return this.seasons?.moves ?? null;
	}
}

export function splitIntoColumns(items, columnCount) {
	const rowsPerColumn = Math.ceil(items.length / columnCount) || 1;
	return Array.from({ length: columnCount }, (_, i) =>
		items.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn)
	);
}
