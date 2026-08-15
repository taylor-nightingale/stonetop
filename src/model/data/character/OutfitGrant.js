import { EmbeddedOutfitItemBuilder } from "./EmbeddedOutfitItem.js";
import { ChoiceGroupDefs } from "../ChoiceGroupDefs.js";
import { ChoiceValues } from "../../snapshot/character/ChoiceGroup.js";

/**
 * Everything one container (a possession, an arcanum, a custom item) grants to the character's outfit
 * right now, under a single source. Recomputed from scratch rather than tracked incrementally, so
 * applying it is idempotent: the same call works for a choice being ticked, for the container being
 * selected, and for a card being flipped.
 */
export class OutfitGrant {
	constructor(source, items = []) {
		this.source = source;
		this.items  = items;
	}

	static empty(source) { return new OutfitGrant(source, []); }

	/**
	 * A container's full grant: the base gear the host supplies (a possession's own `outfitItems`, an
	 * arcanum's flip-dependent card item) plus everything its ticked choices grant. The choice half is
	 * generic — every group on the item is discovered structurally, so gear hung off a choice row on
	 * any item type, including one a user authored, is collected without new code.
	 */
	static forContainer(source, baseItems, system, values) {
		return new OutfitGrant(source, [
			...baseItems.map(oi => embeddedOutfitItem(oi)),
			...this.choiceGranted(system, values).map(oi => embeddedOutfitItem(oi)),
		]);
	}

	/** The raw outfit-item definitions every ticked row/option on `system` grants. */
	static choiceGranted(system, values) {
		const cv    = values instanceof ChoiceValues ? values : new ChoiceValues(values ?? {});
		const items = [];
		for (const group of ChoiceGroupDefs.findAll(system)) {
			for (const row of group.rows) {
				if (cv.getCount(group.slug, row.slug) > 0) items.push(...(row.outfitItems ?? []));
				for (const option of row.options ?? []) {
					if (cv.getCount(group.slug, option.slug) > 0) items.push(...(option.outfitItems ?? []));
				}
			}
		}
		return items;
	}
}

/** Wrap a flat outfit-item definition as an embedded `outfitItem` Item payload. Provenance is not part
 *  of the payload: the granted-item store stamps it when the gear is written. */
export function embeddedOutfitItem(data) {
	return new EmbeddedOutfitItemBuilder()
		.withSlug(data.slug)
		.withName(data.name)
		.withWeight(data.weight ?? 1)
		.withTags(data.tags ?? "")
		.withNote(data.note ?? null)
		.withInventoryColumn(data.inventoryColumn ?? "regular")
		.withResource(data.resource ?? null)
		.withTwoCol(data.twoCol ?? false)
		.build();
}
