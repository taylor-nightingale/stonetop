import { InventoryPage, InventoryColumn, PageSection } from "./InventoryPage.js";

/**
 * Book I's Inventory insert, printed p. 142 — the checklist the character sheet's Outfit tab draws.
 *
 * Read off the printed page (`insertItemLines` in scripts/import/pdf/items.js reads the ◇/□ marks in
 * the vector layer, so column and two-across pairing come from the book itself). Written down here
 * rather than regenerated on every build, because it is meant to be edited by hand: a row moves by
 * moving a line. `scripts/import/build-items.js` re-reads p. 142 and fails if this drifts from it,
 * and `tests/pack/outfit-items-are-the-insert.test.js` checks it against the committed catalog with
 * no PDF at all.
 *
 * Each entry is one printed line: a slug on its own, or a pair the page sets two-across. Sections
 * are the whitespace breaks the page sets between groups. Gear the page does NOT list — a possession's
 * grant, an arcanum's card, an item a player added — is not written here; it trails its column on the
 * sheet, which is where a player looks for what they picked up.
 */
export const INVENTORY_INSERT_PAGE = new InventoryPage([
	new InventoryColumn("regular", [
		new PageSection(
			["supplies", "more-supplies", "even-more-supplies"],
			{ note: "stonetop.inventory.supplies.note" },
		),
		new PageSection([
			"mess-kit",
			"bedroll",
			["blanket", "change-clothes"],
			["rope", "shovel"],
			["sledge", "snow-shoes"],
		]),
		new PageSection(["torch", "oil-lamp", "extra-oil", "firewood"]),
		new PageSection([
			"hatchet", "mallet", "mattock", "maul-iron", "staff",
			"spear", "long-spear", "bow-arrows", "extra-arrows", "javelins",
		]),
		new PageSection(["shield", "thick-hides", "cloak"]),
	]),

	new InventoryColumn("small", [
		new PageSection([
			"knife-dagger", "sling", "rushlight", "tinderbox",
			"needle-thread", "coppers", "whisky",
		]),
		new PageSection([
			["awl", "bowstring"],
			["chalk", "charcoal"],
			["clay-jar", "cloth-rag"],
			["comb", "cup"],
			["extra-socks", "gloves"],
			["little-box", "sack"],
			["sawdust", "tallow"],
			["twine-cord", "waterskin"],
			["whetstone", "whistle"],
		]),
	]),
]);
