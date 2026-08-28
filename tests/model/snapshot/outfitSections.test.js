import { describe, it, expect } from "vitest";
import { OutfitPage, toOutfitItemSnapshot, loadBand } from "../../../src/model/snapshot/character/outfitSections.js";
import { InventoryPage, InventoryColumn, PageSection } from "../../../src/model/data/character/InventoryPage.js";
import { OutfitItemBuilder } from "../../../src/model/data/character/OutfitItem.js";

// OutfitPage is where the two halves meet: the PAGE says what the printed sheet lists, where, in what
// order and how it is set; the CATALOG says what each piece of gear is. Neither knows the other, and
// an item never carries its own position — that was the bug, because position is relational.

const item = (slug, over = {}) => new OutfitItemBuilder()
	.withSlug(slug)
	.withName(over.name ?? slug)
	.withQualifier(over.qualifier ?? "")
	.withWeight(over.weight ?? 1)
	.withInventoryColumn(over.inventoryColumn ?? "regular")
	.withOwnedId(over.ownedId ?? null)
	.build();

const catalog = (...items) => new Map(items.map(i => [i.slug, i]));

const CATALOG = catalog(
	item("supplies"), item("mess-kit"), item("bedroll"),
	item("blanket"), item("change-clothes"), item("rope"), item("shovel"),
	item("awl", { inventoryColumn: "small" }), item("bowstring", { inventoryColumn: "small" }),
);

const PAGE = new InventoryPage([
	new InventoryColumn("regular", [
		new PageSection(["supplies"], { note: "stonetop.inventory.supplies.note" }),
		new PageSection(["mess-kit", "bedroll", ["blanket", "change-clothes"], ["rope", "shovel"]]),
	]),
	new InventoryColumn("small", [
		new PageSection([["awl", "bowstring"]]),
	]),
]);

const slugsOf = (sections) => sections.flatMap(s => s.runs.flatMap(r => r.items.map(i => i.slug)));
const build = (over = {}) => new OutfitPage(over.page ?? PAGE, over.catalog ?? CATALOG, over.localize ?? null);

describe("OutfitPage.forColumn", () => {
	it("renders a column's rows in the order the page prints them", () => {
		expect(slugsOf(build().forColumn("regular")))
			.toEqual(["supplies", "mess-kit", "bedroll", "blanket", "change-clothes", "rope", "shovel"]);
	});

	it("keeps each column to its own rows", () => {
		expect(slugsOf(build().forColumn("small"))).toEqual(["awl", "bowstring"]);
	});

	it("gives a column the page does not have no sections at all", () => {
		expect(build().forColumn("nope")).toEqual([]);
	});

	it("keeps the page's groups apart, so the sheet can rule between them", () => {
		expect(build().forColumn("regular")).toHaveLength(2);
	});

	// Layout is the page's statement, not something re-derived from a flag on each row.
	it("splits a section into a plain run and a two-across grid where the page changes", () => {
		const [, travel] = build().forColumn("regular");
		expect(travel.runs.map(r => [r.isGrid, r.items.map(i => i.slug)])).toEqual([
			[false, ["mess-kit", "bedroll"]],
			[true,  ["blanket", "change-clothes", "rope", "shovel"]],
		]);
	});

	// A slug with nothing behind it means a half-loaded compendium, which must not take the sheet down.
	// The pack guard is what reports the drift.
	it("skips a row the catalog does not hold rather than drawing a blank", () => {
		const page = new InventoryPage([new InventoryColumn("regular", [new PageSection(["supplies", "ghost"])])]);
		expect(slugsOf(build({ page }).forColumn("regular"))).toEqual(["supplies"]);
	});

	it("drops a section entirely when nothing in it resolves", () => {
		const page = new InventoryPage([new InventoryColumn("regular", [
			new PageSection(["ghost"]), new PageSection(["supplies"]),
		])]);
		expect(build({ page }).forColumn("regular")).toHaveLength(1);
	});
});

describe("OutfitPage section notes", () => {
	it("prints the prose the page sets under a group, localized", () => {
		const page = build({ localize: key => `<em>${key}</em>` });
		expect(page.forColumn("regular")[0].note).toBe("<em>stonetop.inventory.supplies.note</em>");
	});

	it("leaves other groups without one", () => {
		expect(build({ localize: k => k }).forColumn("regular")[1].note).toBeNull();
	});

	// The follower panel renders the same page without a localizer: a follower's gear list is a gear
	// list, not a reprint of the character sheet's rules prose.
	it("says nothing where the caller gave no localizer", () => {
		expect(build().forColumn("regular")[0].note).toBeNull();
	});
});

describe("OutfitPage off-page gear", () => {
	const granted = item("sword", { ownedId: "abc" });
	const smallGranted = item("charm", { inventoryColumn: "small", ownedId: "def" });

	it("trails a column with the gear the page does not list", () => {
		expect(slugsOf(build().forColumn("regular", [granted]))).toEqual([
			"supplies", "mess-kit", "bedroll", "blanket", "change-clothes", "rope", "shovel", "sword",
		]);
	});

	it("puts it in its own last section, below the page's own rule", () => {
		const sections = build().forColumn("regular", [granted]);
		expect(sections).toHaveLength(3);
		expect(slugsOf([sections.at(-1)])).toEqual(["sword"]);
	});

	// Off the page, an item still says which column it belongs in — the page places only its own rows.
	it("routes it by its own inventoryColumn", () => {
		expect(slugsOf(build().forColumn("small", [granted, smallGranted]))).toEqual(["awl", "bowstring", "charm"]);
	});

	it("adds no section when there is none", () => {
		expect(build().forColumn("regular", [])).toHaveLength(2);
	});
});

describe("OutfitPage.forColumn narrowing", () => {
	// The follower panel's compact view shows only what the follower actually has.
	const has = (...slugs) => (item) => slugs.includes(item.slug);

	it("keeps only the rows the predicate admits", () => {
		expect(slugsOf(build().forColumn("regular", [], undefined, has("rope", "bedroll"))))
			.toEqual(["bedroll", "rope"]);
	});

	it("drops a section that narrows away to nothing", () => {
		expect(build().forColumn("regular", [], undefined, has("rope"))).toHaveLength(1);
	});

	it("narrows off-page gear the same way", () => {
		const granted = item("sword", { ownedId: "abc" });
		expect(slugsOf(build().forColumn("regular", [granted], undefined, has("rope")))).toEqual(["rope"]);
	});
});

describe("OutfitPage.itemsIn", () => {
	// Load and armor are counted off these, so the page decides which column a row is in.
	it("resolves the gear one column lists, in printed order", () => {
		expect(build().itemsIn("regular").map(i => i.slug))
			.toEqual(["supplies", "mess-kit", "bedroll", "blanket", "change-clothes", "rope", "shovel"]);
	});

	it("resolves every row the page lists, both columns", () => {
		expect(build().items).toHaveLength(9);
	});
});

describe("toOutfitItemSnapshot", () => {
	it("carries the printed name's two halves separately, so the sheet can bold only the item", () => {
		const snap = toOutfitItemSnapshot(item("rope", { name: "Rope", qualifier: "~25 ft" }), false, null);
		expect(snap.name).toBe("Rope");
		expect(snap.qualifier).toBe("~25 ft");
	});

	it("marks a row the character has checked", () => {
		expect(toOutfitItemSnapshot(item("rope"), true, null).checked).toBe(true);
	});

	// Only gear the player added themselves is theirs to delete.
	it("calls an item with an owning id custom, and deletable", () => {
		expect(toOutfitItemSnapshot(item("charm", { ownedId: "x1" }), false, null).isCustom).toBe(true);
		expect(toOutfitItemSnapshot(item("rope"), false, null).isCustom).toBe(false);
	});
});

describe("loadBand", () => {
	it("bands the marked weight the way the Outfit move prints it", () => {
		expect(loadBand(0)).toBe("light");
		expect(loadBand(3)).toBe("light");
		expect(loadBand(4)).toBe("normal");
		expect(loadBand(6)).toBe("normal");
		expect(loadBand(7)).toBe("heavy");
		expect(loadBand(99)).toBe("heavy");
	});
});
