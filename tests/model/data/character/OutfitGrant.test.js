import { describe, it, expect } from "vitest";
import { OutfitGrant } from "../../../../src/model/data/character/OutfitGrant.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";

const sword  = { slug: "sword",  name: "Sword, iron", weight: 1, inventoryColumn: "regular" };
const spear  = { slug: "spear",  name: "Long spear",  weight: 2, inventoryColumn: "regular" };
const shield = { slug: "shield", name: "Shield",      weight: 2, inventoryColumn: "regular" };

// A possession-shaped container: a pick row whose options each carry gear.
const WEAPONS = {
	slug: "weapons-of-war",
	choices: {
		slug: "weapons-of-war",
		list: [{ type: "pick", pickCount: 3, options: [
			{ slug: "sword", text: "Sword", outfitItems: [sword] },
			{ slug: "spear", text: "Spear", outfitItems: [spear] },
		]}],
	},
};

// An entry row (not a pick) can carry gear too — the shape a custom item would most likely use.
const ENTRY_GEAR = {
	choices: {
		slug: "kit",
		list: [{ type: "entry", slug: "rope", track: { max: 1 }, outfitItems: [shield] }],
	},
};

const values = (raw) => new ChoiceValues(raw);

describe("OutfitGrant.choiceGranted", () => {
	it("collects gear from a ticked pick option", () => {
		const got = OutfitGrant.choiceGranted(WEAPONS, values({ "weapons-of-war": { sword: 1 } }));
		expect(got.map(i => i.slug)).toEqual(["sword"]);
	});

	it("ignores options that are not ticked", () => {
		const got = OutfitGrant.choiceGranted(WEAPONS, values({ "weapons-of-war": { sword: 0 } }));
		expect(got).toEqual([]);
	});

	it("collects every ticked option, not just the first", () => {
		const got = OutfitGrant.choiceGranted(WEAPONS, values({ "weapons-of-war": { sword: 1, spear: 1 } }));
		expect(got.map(i => i.slug).sort()).toEqual(["spear", "sword"]);
	});

	it("collects gear from a ticked entry row", () => {
		const got = OutfitGrant.choiceGranted(ENTRY_GEAR, values({ kit: { rope: 1 } }));
		expect(got.map(i => i.slug)).toEqual(["shield"]);
	});

	it("reads each group's values under that group's OWN slug", () => {
		// Stored under the wrong namespace — the group's slug is what counts.
		const got = OutfitGrant.choiceGranted(WEAPONS, values({ "some-other-namespace": { sword: 1 } }));
		expect(got).toEqual([]);
	});

	it("grants nothing when there are no stored values at all", () => {
		expect(OutfitGrant.choiceGranted(WEAPONS, values({}))).toEqual([]);
	});
});

describe("OutfitGrant.forContainer", () => {
	it("combines base gear with choice-granted gear under one source", () => {
		const grant = OutfitGrant.forContainer(
			"possession:weapons-of-war", [shield], WEAPONS, values({ "weapons-of-war": { sword: 1 } }),
		);
		expect(grant.source).toBe("possession:weapons-of-war");
		expect(grant.items.map(i => i.system.slug)).toEqual(["shield", "sword"]);
	});

	it("stamps every item with the container's source", () => {
		const grant = OutfitGrant.forContainer(
			"possession:weapons-of-war", [shield], WEAPONS, values({ "weapons-of-war": { sword: 1 } }),
		);
		expect(grant.items.every(i => i.system.source === "possession:weapons-of-war")).toBe(true);
		expect(grant.items.every(i => i.type === "outfitItem")).toBe(true);
	});

	it("is empty when the container grants nothing", () => {
		const grant = OutfitGrant.forContainer("possession:x", [], WEAPONS, values({}));
		expect(grant.items).toEqual([]);
	});

	it("empty() names the source so it can be cleared", () => {
		expect(OutfitGrant.empty("arcana:ring").source).toBe("arcana:ring");
		expect(OutfitGrant.empty("arcana:ring").items).toEqual([]);
	});
});
