import { OutfitSection, OutfitItemSnapshotBuilder } from "./InventorySnapshot.js";

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
	const mapItem = (oi) => new OutfitItemSnapshotBuilder()
		.withSlug(oi.slug)
		.withName(oi.name)
		.withTags(oi.tags)
		.withNote(oi.note)
		.withWeight(oi.weight)
		.withChecked(checkedMap[oi.slug] ?? false)
		.withResource(resourceFn(oi))
		.withIsCustom(oi.ownedId != null)
		.withOwnedId(oi.ownedId ?? null)
		.withTwoCol(oi.twoCol ?? false)
		.build();
	return buildOutfitSections(repoItems, customItems, column, mapItem);
}

// Informational load band from total checked weight. Guidance only — never a cap (see the
// guide-don't-enforce principle): the UI highlights the band but lets you carry more.
// Thresholds: ≤3 Light, 4–6 Normal, 7+ Heavy.
export function loadBand(totalWeight) {
	if (totalWeight <= 3) return "light";
	if (totalWeight <= 6) return "normal";
	return "heavy";
}
