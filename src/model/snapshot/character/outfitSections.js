import { OutfitSection, OutfitRun, OutfitItemSnapshotBuilder } from "./InventorySnapshot.js";
import { rich } from "../RichText.js";
import { Tags } from "../../data/Tags.js";

/**
 * Renders one inventory page against one actor's gear.
 *
 * Two things meet here and neither knows about the other. The PAGE (InventoryPage) says which gear
 * the printed sheet lists, in which column, in what order, in what groups, and how each line is set.
 * The CATALOG says what each piece of gear IS — its tags, note, weight, resource, armor. Put them
 * together with an actor's marks and you have the sections a column renders.
 *
 * Gear the page does not list — a possession's grant, an arcanum's card, an item a player added —
 * trails its column as one last section, which is where a player looks for what they picked up.
 *
 * Shared by the character inventory and the follower inventory so both read identically.
 */
export class OutfitPage {
	/**
	 * @param {InventoryPage} page
	 * @param {Map<string, OutfitItem>} catalog  slug → the gear the compendium holds
	 * @param {((key: string) => string)|null} localize  given where the page's own prose should show;
	 *        the follower panel leaves it out, so a follower's gear list stays a gear list
	 */
	constructor(page, catalog, localize = null) {
		this._page     = page;
		this._catalog  = catalog;
		this._localize = localize;
	}

	/**
	 * The sections one column renders.
	 *
	 * @param {string} key                 "regular" | "small"
	 * @param {OutfitItem[]} offPageItems  gear this actor has that the page does not list
	 * @param {(item: OutfitItem) => OutfitItemSnapshot} mapItem  carries the caller's checked/resource
	 *        decisions, which differ between a character and a follower
	 * @param {(item: OutfitItem) => boolean} includes  narrows it to the rows an actor actually has
	 * @returns {OutfitSection[]}
	 */
	forColumn(key, offPageItems = [], mapItem = defaultMapItem, includes = () => true) {
		const sections = (this._page.column(key)?.sections ?? [])
			.map(section => this._section(section, mapItem, includes))
			.filter(Boolean);

		const offPage = offPageItems.filter(i => i.inventoryColumn === key && includes(i));
		if (offPage.length) sections.push(new OutfitSection([new OutfitRun(false, offPage.map(mapItem))]));

		return sections;
	}

	/** The gear one column lists, resolved. Load is counted off this rather than off an item field:
	 *  a row's column is wherever the page puts it. */
	itemsIn(key) {
		return this._resolve(this._page.column(key)?.slugs ?? []);
	}

	/** Every row the page lists, resolved, both columns. */
	get items() {
		return this._resolve(this._page.slugs);
	}

	_resolve(slugs) {
		return slugs.map(slug => this._catalog.get(slug)).filter(Boolean);
	}

	/** One page section, resolved — or null when nothing in it survives `includes`. A run that empties
	 *  drops out, and a section whose runs all empty drops out with them. */
	_section(section, mapItem, includes) {
		const runs = section.runs
			.map(run => new OutfitRun(run.twoAcross, this._rows(run.slugs, mapItem, includes)))
			.filter(run => run.items.length);
		if (!runs.length) return null;
		return new OutfitSection(runs, this._note(section));
	}

	/** A run's rows. A slug the catalog does not hold is skipped rather than drawn as a blank row —
	 *  the pack guard is what reports it, and a half-loaded compendium should not break the sheet. */
	_rows(slugs, mapItem, includes) {
		return slugs
			.map(slug => this._catalog.get(slug))
			.filter(item => item && includes(item))
			.map(mapItem);
	}

	_note(section) {
		return section.note && this._localize ? this._localize(section.note) : null;
	}
}

/** One OutfitItem → its render snapshot. The single mapping used everywhere an outfit row is drawn:
 *  the character inventory, the follower inventory, and the outfit-item sheet's own preview — so all
 *  three render identically through outfit-item-row.hbs. */
export function toOutfitItemSnapshot(oi, checked, resource) {
	return new OutfitItemSnapshotBuilder()
		.withSlug(oi.slug)
		.withName(oi.name)
		.withQualifier(oi.qualifier ?? "")
		.withTags(Tags.gear(oi.tags).resolved)
		.withNote(rich(oi.note))
		.withWeight(oi.weight)
		.withChecked(checked)
		.withResource(resource)
		.withIsCustom(oi.ownedId != null)
		.withOwnedId(oi.ownedId ?? null)
		.build();
}

const defaultMapItem = (oi) => toOutfitItemSnapshot(oi, false, null);

/** The most ◇ the Outfit move lets a character mark: heavy tops out at 9. Advisory, like the band —
 *  the sheet reports being over it, nothing enforces it. Followers default their own capacity to it. */
export const MAX_OUTFIT_MARKS = 9;

// Informational load band from total checked weight. Guidance only — never a cap (see the
// guide-don't-enforce principle): the UI highlights the band but lets you carry more.
// Thresholds: ≤3 Light, 4–6 Normal, 7+ Heavy.
export function loadBand(totalWeight) {
	if (totalWeight <= 3) return "light";
	if (totalWeight <= 6) return "normal";
	return "heavy";
}
