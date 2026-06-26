import { describe, it, expect, vi } from "vitest";
import { CharacterPossessions } from "../../../module/actors/character/CharacterPossessions.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

describe("CharacterPossessions — top-level", () => {
	it("selected returns empty Set when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.selected.size).toBe(0);
	});

	it("select adds slug to set", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.select("apiary");
		expect(store.selected).toContain("apiary");
	});

	it("deselect removes slug from set", async () => {
		const store = { selected: ["apiary", "mastiffs"] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.deselect("apiary");
		expect(store.selected).not.toContain("apiary");
		expect(store.selected).toContain("mastiffs");
	});

	it("setUses stores count under slug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setUses("sacred-pouch", 2);
		expect(store.uses).toEqual({ "sacred-pouch": 2 });
	});
});

describe("CharacterPossessions — subChoices", () => {
	it("subChoices returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.subChoices).toEqual({});
	});

	it("addSubChoice stores the choiceSlug in the possession's array", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices).toEqual({ "weapons-of-war": ["sword"] });
	});

	it("addSubChoice is idempotent — calling twice does not duplicate", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toHaveLength(1);
	});

	it("addSubChoice appends to an existing array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "crossbow");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword", "crossbow"]);
	});

	it("removeSubChoice removes the choiceSlug from the array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword", "crossbow"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toEqual(["crossbow"]);
	});

	it("removeSubChoice is safe when slug not in array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeSubChoice("weapons-of-war", "battleaxe");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword"]);
	});

	it("setSubChoices replaces the whole array, dropping deselected picks", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword", "battleaxe"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setSubChoices("weapons-of-war", ["sword", "long-spear"]);
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword", "long-spear"]);
	});

	it("setSubChoices leaves other possessions' picks untouched", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"], "sacred-pouch": ["heirloom"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setSubChoices("weapons-of-war", []);
		expect(store.subChoices).toEqual({ "weapons-of-war": [], "sacred-pouch": ["heirloom"] });
	});
});

describe("CharacterPossessions — custom write-ins", () => {
	it("custom returns empty array when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.custom).toEqual([]);
	});

	it("setCustom assigns custom-N slugs and drops blank labels", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setCustom(["A locket", "   ", "Grandfather's blade"]);
		expect(store.custom).toEqual([
			{ slug: "custom-1", label: "A locket" },
			{ slug: "custom-2", label: "Grandfather's blade" },
		]);
	});

	it("setCustom trims labels", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setCustom(["  A map  "]);
		expect(store.custom).toEqual([{ slug: "custom-1", label: "A map" }]);
	});

	it("setCustom replaces the whole list (idempotent across re-applies)", async () => {
		const store = { custom: [{ slug: "custom-1", label: "Old item" }] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setCustom(["Old item"]);
		expect(store.custom).toEqual([{ slug: "custom-1", label: "Old item" }]);
	});

	it("setCustom with no labels clears the list", async () => {
		const store = { custom: [{ slug: "custom-1", label: "Old item" }] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setCustom([]);
		expect(store.custom).toEqual([]);
	});

	it("removeCustom drops the matching slug", async () => {
		const store = { custom: [{ slug: "custom-1", label: "A" }, { slug: "custom-2", label: "B" }] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeCustom("custom-1");
		expect(store.custom).toEqual([{ slug: "custom-2", label: "B" }]);
	});
});

describe("CharacterPossessions — authored possessions", () => {
	it("authored returns empty array when nothing saved", () => {
		expect(new CharacterPossessions(makeFlags()).authored).toEqual([]);
	});

	it("upsertAuthored adds a new entry with a stable custom-possession slug", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		const slug = await cp.upsertAuthored({ label: "  Sage's Tome ", description: "<p>Wise.</p>" });
		expect(slug).toMatch(/^custom-possession-/);
		expect(store.authored).toEqual([{ slug, label: "Sage's Tome", description: "<p>Wise.</p>", resource: null, outfitItems: [] }]);
	});

	it("upsertAuthored with a slug updates that entry in place (preserving order)", async () => {
		const store = { authored: [
			{ slug: "custom-possession-a", label: "A", description: "", resource: null, outfitItems: [] },
			{ slug: "custom-possession-b", label: "B", description: "", resource: null, outfitItems: [] },
		] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.upsertAuthored({ slug: "custom-possession-a", label: "A (edited)", resource: { title: "Charges", max: 3, labels: [] } });
		expect(store.authored).toEqual([
			{ slug: "custom-possession-a", label: "A (edited)", description: "", resource: { title: "Charges", max: 3, labels: [] }, outfitItems: [] },
			{ slug: "custom-possession-b", label: "B", description: "", resource: null, outfitItems: [] },
		]);
	});

	it("upsertAuthored stores granted outfit items", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		const grants = [{ slug: "cp-item-1", name: "Fine tools", weight: 1, inventoryColumn: "regular" }];
		await cp.upsertAuthored({ label: "Tinker's kit", outfitItems: grants });
		expect(store.authored[0].outfitItems).toEqual(grants);
	});

	it("grantedOutfitItems flattens authored possessions' gear into outfit descriptors", () => {
		const store = { authored: [
			{ slug: "p1", label: "Kit", description: "", resource: null, outfitItems: [
				{ slug: "g1", name: "Tools", weight: 2, inventoryColumn: "regular" },
				{ slug: "g2", name: "Whetstone", weight: 0, inventoryColumn: "small" },
			] },
			{ slug: "p2", label: "Plain", description: "", resource: null, outfitItems: [] },
		] };
		const cp = new CharacterPossessions(makeFlags(store));
		const granted = cp.grantedOutfitItems();
		expect(granted).toEqual([
			{ slug: "g1", name: "Tools", note: null, weight: 2, resource: null, twoCol: false, breakBefore: false, inventoryColumn: "regular" },
			{ slug: "g2", name: "Whetstone", note: null, weight: 0, resource: null, twoCol: false, breakBefore: false, inventoryColumn: "small" },
		]);
	});

	it("grantedOutfitItems returns [] when no authored gear", () => {
		expect(new CharacterPossessions(makeFlags()).grantedOutfitItems()).toEqual([]);
	});

	it("upsertAuthored rejects a blank label without writing", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		expect(await cp.upsertAuthored({ label: "   " })).toBeNull();
		expect(store.authored).toBeUndefined();
	});

	it("removeAuthored drops the matching slug and leaves the onboarding write-ins alone", async () => {
		const store = {
			custom:   [{ slug: "custom-1", label: "Write-in" }],
			authored: [{ slug: "custom-possession-a", label: "A", description: "", resource: null }],
		};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeAuthored("custom-possession-a");
		expect(store.authored).toEqual([]);
		expect(store.custom).toEqual([{ slug: "custom-1", label: "Write-in" }]); // untouched
	});
});

describe("CharacterPossessions — choiceUses", () => {
	it("choiceUses returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.choiceUses).toEqual({});
	});

	it("setChoiceUses stores count under possessionSlug:choiceSlug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setChoiceUses("weapons-of-war", "crossbow", 1);
		expect(store.choiceUses).toEqual({ "weapons-of-war:crossbow": 1 });
	});

	it("setChoiceUses merges with existing choiceUses", async () => {
		const store = { choiceUses: { "weapons-of-war:sword": 0 } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setChoiceUses("weapons-of-war", "crossbow", 2);
		expect(store.choiceUses).toEqual({ "weapons-of-war:sword": 0, "weapons-of-war:crossbow": 2 });
	});
});
