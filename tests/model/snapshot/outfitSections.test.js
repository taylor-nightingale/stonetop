import { describe, it, expect } from "vitest";
import { buildOutfitSections, buildOutfitColumn, loadBand } from "../../../src/model/snapshot/character/outfitSections.js";

const item = (slug, column = "regular", group = "Weapons") => ({ slug, name: slug, inventoryColumn: column, group });
const idMap = i => ({ slug: i.slug, group: i.group }); // trivial mapItem

describe("buildOutfitSections", () => {
	it("groups repo items by folder group, only for the given column, preserving order", () => {
		const repo = [
			item("hatchet", "regular", "Weapons"),
			item("shield", "regular", "Armor"),
			item("spear", "regular", "Weapons"),
			item("torch", "small", "Sundries"),
		];
		const sections = buildOutfitSections(repo, [], "regular", idMap);
		expect(sections.map(s => s.name)).toEqual(["Weapons", "Armor"]); // small column excluded
		expect(sections[0].items.map(i => i.slug)).toEqual(["hatchet", "spear"]);
		expect(sections[1].items.map(i => i.slug)).toEqual(["shield"]);
	});

	it("trails embedded items as a single null-named section", () => {
		const sections = buildOutfitSections(
			[item("hatchet")], [item("homemade", "regular", "x")], "regular", idMap);
		expect(sections.at(-1).name).toBeNull();
		expect(sections.at(-1).items.map(i => i.slug)).toEqual(["homemade"]);
	});

	it("handles no embedded items", () => {
		expect(buildOutfitSections([item("hatchet")], [], "regular", idMap)).toHaveLength(1);
		expect(buildOutfitSections([item("hatchet")], null, "regular", idMap)).toHaveLength(1);
	});
});

describe("buildOutfitColumn", () => {
	const repo = [
		{ slug: "hatchet", name: "Hatchet", weight: 1, tags: "hand", note: "x", inventoryColumn: "regular", group: "Weapons", twoCol: false },
		{ slug: "bow", name: "Bow", weight: 1, inventoryColumn: "regular", group: "Weapons", resource: { max: 2 } },
	];
	const custom = [
		{ slug: "lucky-coin", name: "Lucky coin", weight: 1, inventoryColumn: "regular", twoCol: true, ownedId: "lucky-coin" },
	];

	it("maps repo + custom items into snapshots with checked flags, custom flag, resources, twoCol", () => {
		const resourceFn = oi => oi.resource ? { max: oi.resource.max } : null;
		const sections = buildOutfitColumn(repo, custom, { hatchet: true }, "regular", resourceFn);
		const items = sections.flatMap(s => s.items);
		const hatchet = items.find(i => i.slug === "hatchet");
		const bow     = items.find(i => i.slug === "bow");
		const coin    = items.find(i => i.slug === "lucky-coin");
		expect(hatchet.checked).toBe(true);
		expect(hatchet.isCustom).toBe(false);
		expect(bow.checked).toBe(false);
		expect(bow.resource).toEqual({ max: 2 });   // resourceFn applied
		expect(coin.isCustom).toBe(true);            // custom item (has ownedId)
		expect(coin.ownedId).toBe("lucky-coin");
		expect(coin.twoCol).toBe(true);
	});

	it("defaults resource to null when no resourceFn is given", () => {
		const [section] = buildOutfitColumn(repo, [], {}, "regular");
		expect(section.items[0].resource).toBeNull();
	});
});

describe("loadBand", () => {
	it("maps total weight to a band at the boundaries (≤3 light / 4–6 normal / 7+ heavy)", () => {
		expect(loadBand(0)).toBe("light");
		expect(loadBand(3)).toBe("light");
		expect(loadBand(4)).toBe("normal");
		expect(loadBand(6)).toBe("normal");
		expect(loadBand(7)).toBe("heavy");
		expect(loadBand(99)).toBe("heavy"); // no cap — guidance only
	});
});
