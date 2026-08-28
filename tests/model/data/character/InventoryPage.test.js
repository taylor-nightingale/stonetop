import { describe, it, expect } from "vitest";
import { InventoryPage, InventoryColumn, PageSection, PageRun } from "../../../../src/model/data/character/InventoryPage.js";

// The page is what the printed sheet SHOWS: which gear, which column, what order, which groups. It
// exists so that order is array position rather than a rank stored on each item — a rank is
// relational, so it never belonged on the items, and neither did the column or the two-across
// pairing that were living there beside it.

describe("PageSection", () => {
	it("flattens its lines to the slugs it lists, in printed order", () => {
		const section = new PageSection(["mess-kit", "bedroll", ["blanket", "change-clothes"]]);
		expect(section.slugs).toEqual(["mess-kit", "bedroll", "blanket", "change-clothes"]);
	});

	it("carries no note unless the page prints one", () => {
		expect(new PageSection(["supplies"]).note).toBeNull();
	});

	it("keeps the i18n key of the prose the page prints under it", () => {
		const section = new PageSection(["supplies"], { note: "stonetop.inventory.supplies.note" });
		expect(section.note).toBe("stonetop.inventory.supplies.note");
	});

	// Layout is stated by the page, not re-derived by scanning a flag on every item — which is what
	// the old outfitSegments helper had to do, and why a pair could silently split.
	it("groups consecutive two-across lines into one grid run", () => {
		const section = new PageSection([["awl", "bowstring"], ["chalk", "charcoal"]]);
		expect(section.runs).toEqual([new PageRun(true, ["awl", "bowstring", "chalk", "charcoal"])]);
	});

	it("groups consecutive single lines into one plain run", () => {
		const section = new PageSection(["torch", "oil-lamp", "extra-oil"]);
		expect(section.runs).toEqual([new PageRun(false, ["torch", "oil-lamp", "extra-oil"])]);
	});

	// The insert's travel group opens with two rows set full-width and then turns two-across, all
	// inside ONE whitespace-delimited group — so a section has to be able to change layout mid-way
	// without becoming two sections and gaining a divider it never had.
	it("splits a section into runs where the page changes layout", () => {
		const section = new PageSection(["mess-kit", "bedroll", ["blanket", "change-clothes"], ["rope", "shovel"]]);
		expect(section.runs).toEqual([
			new PageRun(false, ["mess-kit", "bedroll"]),
			new PageRun(true, ["blanket", "change-clothes", "rope", "shovel"]),
		]);
	});

	it("has no runs when the page lists nothing", () => {
		expect(new PageSection([]).runs).toEqual([]);
	});
});

describe("InventoryColumn", () => {
	it("flattens its sections to the slugs it lists, in printed order", () => {
		const column = new InventoryColumn("regular", [
			new PageSection(["supplies"]),
			new PageSection(["mess-kit", ["rope", "shovel"]]),
		]);
		expect(column.slugs).toEqual(["supplies", "mess-kit", "rope", "shovel"]);
	});
});

describe("InventoryPage", () => {
	const page = () => new InventoryPage([
		new InventoryColumn("regular", [new PageSection(["supplies", "mess-kit"])]),
		new InventoryColumn("small", [new PageSection([["awl", "bowstring"]])]),
	]);

	it("finds a column by key", () => {
		expect(page().column("small").slugs).toEqual(["awl", "bowstring"]);
	});

	it("returns null for a column it does not have", () => {
		expect(page().column("nope")).toBeNull();
	});

	it("lists every slug it draws, both columns, in printed order", () => {
		expect(page().slugs).toEqual(["supplies", "mess-kit", "awl", "bowstring"]);
	});
});
