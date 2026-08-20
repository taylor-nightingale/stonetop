import { OutfitSection, OutfitItemSnapshotBuilder } from "./InventorySnapshot.js";
import { rich } from "../RichText.js";

// Group outfit items into render sections for one inventory column ("regular" | "small").
// Repo (pack/world) items are grouped by their folder-derived `group`, preserving encounter order;
// embedded items (custom/arcana/possession) trail as a single null-named section. `mapItem` turns a
// raw outfit item into its snapshot (it carries the checked/resource/custom decisions of the caller).
// Shared by the character inventory and the follower inventory so both group identically.
export function buildOutfitSections(repoItems, embeddedItems, column, mapItem) {
	const colRepo     = repoItems.filter(i => i.inventoryColumn === column);
	const colEmbedded = (embeddedItems ?? []).filter(i => i.inventoryColumn === column);

	const groupMap = new Map();
	for (const item of colRepo) {
		const g = item.group;
		if (!groupMap.has(g)) groupMap.set(g, []);
		groupMap.get(g).push(mapItem(item));
	}

	const sections = [...groupMap.entries()].map(([name, items]) => new OutfitSection(name, items));

	if (colEmbedded.length > 0) {
		sections.push(new OutfitSection(null, colEmbedded.map(mapItem)));
	}

	return sections;
}

// Build the render sections for one outfit column, mapping each raw outfit item to an
// OutfitItemSnapshot. Shared by the character inventory (custom items = embedded `outfitItem`
// documents; resources from the character ResourceController) and the follower inventory (custom
// items = inline; resources follower-scoped). `customItems` carry `ownedId` (→ isCustom + deletable);
// repo items don't. `resourceFn(item)` returns the item's resource snapshot (or null).
export function buildOutfitColumn(repoItems, customItems, checkedMap, column, resourceFn = () => null) {
	const mapItem = (oi) => toOutfitItemSnapshot(oi, checkedMap[oi.slug] ?? false, resourceFn(oi));
	return buildOutfitSections(repoItems, customItems, column, mapItem);
}

// One OutfitItem → its render snapshot. The single mapping used everywhere an outfit row is drawn:
// the character inventory, the follower inventory, and the outfit-item sheet's own preview — so all
// three render identically through outfit-item-row.hbs.
export function toOutfitItemSnapshot(oi, checked, resource) {
	return new OutfitItemSnapshotBuilder()
		.withSlug(oi.slug)
		.withName(oi.name)
		.withTags(rich(oi.tags))
		.withNote(rich(oi.note))
		.withWeight(oi.weight)
		.withChecked(checked)
		.withResource(resource)
		.withIsCustom(oi.ownedId != null)
		.withOwnedId(oi.ownedId ?? null)
		.withTwoCol(oi.twoCol ?? false)
		.build();
}

// The most ◇ the Outfit move lets a character mark: heavy tops out at 9. Advisory, like the band —
// the sheet reports being over it, nothing enforces it. Followers default their own capacity to it.
export const MAX_OUTFIT_MARKS = 9;

// Informational load band from total checked weight. Guidance only — never a cap (see the
// guide-don't-enforce principle): the UI highlights the band but lets you carry more.
// Thresholds: ≤3 Light, 4–6 Normal, 7+ Heavy.
export function loadBand(totalWeight) {
	if (totalWeight <= 3) return "light";
	if (totalWeight <= 6) return "normal";
	return "heavy";
}
