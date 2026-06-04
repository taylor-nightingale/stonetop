import { describe, it, expect } from "vitest";
import { CharacterData } from "../../src/data/CharacterData.js";

describe("CharacterData defaults", () => {
	it("defaults hp to 0/0", () => {
		const d = new CharacterData();
		expect(d.attributes.hp.value).toBe(0);
		expect(d.attributes.hp.max).toBe(0);
	});

	it("defaults level to 1", () => {
		expect(new CharacterData().attributes.level).toBe(1);
	});

	it("defaults xp.value to 0", () => {
		expect(new CharacterData().attributes.xp.value).toBe(0);
	});

	it("defaults armor to 0", () => {
		expect(new CharacterData().attributes.armor).toBe(0);
	});

	it("defaults damage.value to null", () => {
		expect(new CharacterData().attributes.damage.value).toBeNull();
	});

	it("defaults playbookSlug to empty string", () => {
		expect(new CharacterData().playbookSlug).toBe("");
	});

	it("defaults moves to empty array", () => {
		expect(new CharacterData().moves).toEqual([]);
	});

	it("defaults arcana to empty state", () => {
		const d = new CharacterData();
		expect(d.arcana.owned).toEqual([]);
		expect(d.arcana.flipped).toEqual([]);
		expect(d.arcana.unlock).toEqual({});
		expect(d.arcana.backChoices).toEqual({});
	});

	it("defaults choices, resources, and moveResources sections", () => {
		const d = new CharacterData();
		expect(d.choices.values).toEqual({});
		expect(d.choices.groupDefs).toEqual({});
		expect(d.postDeathChoices.values).toEqual({});
		expect(d.resources.counts).toEqual({});
		expect(d.moveResources.counts).toEqual({});
	});

	it("defaults background, instinct, origin, lore, postDeath sections", () => {
		const d = new CharacterData();
		expect(d.background.selected).toBe("");
		expect(d.instinct.custom).toBe("");
		expect(d.origin.selected).toBe("");
		expect(d.lore.values).toEqual({});
		expect(d.postDeath.insert).toBeNull();
		expect(d.postDeathInstinct.custom).toBe("");
		expect(d.postDeathLore.values).toEqual({});
	});

	it("defaults followers to empty state", () => {
		const d = new CharacterData();
		expect(d.followers.owned).toEqual([]);
		expect(d.followers.state).toEqual({});
	});

	it("defaults inventory to zeroed state", () => {
		const d = new CharacterData();
		expect(d.inventory.checked).toEqual({});
		expect(d.inventory.loadLevel).toBeNull();
		expect(d.inventory.regularPool).toBe(0);
		expect(d.inventory.smallPool).toBe(0);
		expect(d.inventory.otherItems).toBe("");
	});

	it("defaults possessions to empty state", () => {
		const d = new CharacterData();
		expect(d.possessions.selected).toEqual([]);
		expect(d.possessions.uses).toEqual({});
		expect(d.possessions.pickValues).toEqual({});
		expect(d.possessions.choiceUses).toEqual({});
	});

	it("defaults all stats to 0", () => {
		const d = new CharacterData();
		for (const stat of ["str", "dex", "con", "int", "wis", "cha"]) {
			expect(d.stats[stat].value).toBe(0);
		}
	});

	it("defaults all debilities to false", () => {
		const d = new CharacterData();
		const { weakened, dazed, miserable } = d.attributes.debilities.options;
		expect(weakened.value).toBe(false);
		expect(dazed.value).toBe(false);
		expect(miserable.value).toBe(false);
	});

	it("defaults description and notes to empty string", () => {
		const d = new CharacterData();
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
	});
});

describe("CharacterData with initial data", () => {
	it("accepts a playbookSlug", () => {
		expect(new CharacterData({ playbookSlug: "the-fox" }).playbookSlug).toBe("the-fox");
	});

	it("accepts moves categories", () => {
		const d = new CharacterData({ moves: [{ key: "basic", moves: [] }] });
		expect(d.moves).toHaveLength(1);
		expect(d.moves[0].key).toBe("basic");
	});

	it("accepts hp value and max", () => {
		const d = new CharacterData({ attributes: { hp: { value: 12, max: 16 } } });
		expect(d.attributes.hp.value).toBe(12);
		expect(d.attributes.hp.max).toBe(16);
	});

	it("accepts level and preserves other defaults", () => {
		const d = new CharacterData({ attributes: { level: 3 } });
		expect(d.attributes.level).toBe(3);
		expect(d.attributes.hp.value).toBe(0);
		expect(d.attributes.armor).toBe(0);
	});

	it("accepts damage.value string", () => {
		const d = new CharacterData({ attributes: { damage: { value: "d8" } } });
		expect(d.attributes.damage.value).toBe("d8");
	});

	it("accepts stat values", () => {
		const d = new CharacterData({ stats: { str: { value: 2 }, dex: { value: -1 } } });
		expect(d.stats.str.value).toBe(2);
		expect(d.stats.dex.value).toBe(-1);
	});

	it("accepts a debility as true", () => {
		const d = new CharacterData({ attributes: { debilities: { options: { weakened: { value: true } } } } });
		expect(d.attributes.debilities.options.weakened.value).toBe(true);
		expect(d.attributes.debilities.options.dazed.value).toBe(false);
	});
});

describe("CharacterData _source", () => {
	it("mirrors initialized values in _source", () => {
		const d = new CharacterData({ attributes: { hp: { value: 5, max: 10 } } });
		expect(d._source.attributes.hp.value).toBe(5);
		expect(d._source.attributes.hp.max).toBe(10);
	});

	it("toObject() returns a plain copy of _source", () => {
		const d = new CharacterData({ attributes: { level: 2 } });
		const obj = d.toObject();
		expect(obj.attributes.level).toBe(2);
		obj.attributes.level = 99;
		expect(d._source.attributes.level).toBe(2);
	});
});
