import { describe, it, expect } from "vitest";
import { creatureFields, followerFields, migrateCreatureData } from "../../src/data/creature.js";

describe("creatureFields / followerFields composition", () => {
	it("creature fields include slug and reference but not follower bookkeeping", () => {
		const keys = Object.keys(creatureFields());
		expect(keys).toContain("slug");
		expect(keys).toContain("reference");
		expect(keys).toContain("hp");
		expect(keys).toContain("armor");
		expect(keys).toContain("damage");
		expect(keys).toContain("specialQuality");
		expect(keys).not.toContain("loyalty");
		expect(keys).not.toContain("owned");
		expect(keys).not.toContain("choices");
	});

	it("follower fields hold the bookkeeping but not the shared core", () => {
		const keys = Object.keys(followerFields());
		expect(keys).toEqual(expect.arrayContaining(["arcanaSlug", "owned", "loyalty", "choices", "choiceValues", "inventory"]));
		expect(keys).not.toContain("slug");
		expect(keys).not.toContain("hp");
	});

	it("inventory field defaults to { checked, customItems, resources }", () => {
		expect(followerFields().inventory.initialize(undefined)).toEqual({ checked: {}, customItems: [], resources: {} });
	});
});

describe("migrateCreatureData — legacy Crew inventory → inventory.checked", () => {
	const crewSource = () => ({
		choices: [{ slug: "choices", list: [
			{ type: "entry", content: { title: "Inventory" } },
			{ type: "pick", pickCount: 7, options: [
				{ slug: "inv-hatchet", content: { title: "Hatchet, iron (hand, thrown)" } },
				{ slug: "inv-bow",     content: { title: "Bow & iron arrows" } },
				{ slug: "inv-hides",   content: { title: "Thick hides (1 armor)" } },
			] },
		] }],
		choiceValues: { choices: { "inv-hatchet": 1, "inv-hides": 1 } },
	});

	it("maps the taken picks to shared outfit-item slugs", () => {
		const s = crewSource();
		migrateCreatureData(s);
		expect(s.inventory.checked).toEqual({ hatchet: true, "thick-hides": true }); // inv-bow not taken
	});

	it("drops the Inventory entry + the inv-* pick row from choices", () => {
		const s = crewSource();
		migrateCreatureData(s);
		expect(s.choices[0].list).toEqual([]);
	});

	it("does NOT inject inventory when there is no Inventory choice row (migrate-on-diff safe)", () => {
		const s = { name: "Crew", hp: 6 }; // a partial update diff carries no choices
		migrateCreatureData(s);
		expect(s.inventory).toBeUndefined();
	});
});

describe("migrateCreatureData — hp", () => {
	it("folds NPC hp+maxHp numbers into {value, max}", () => {
		const s = { hp: 8, maxHp: 10 };
		migrateCreatureData(s);
		expect(s.hp).toEqual({ value: 8, max: 10 });
		expect(s.maxHp).toBeUndefined();
	});

	it("uses hp for max when only hp number is present", () => {
		const s = { hp: 6 };
		migrateCreatureData(s);
		expect(s.hp).toEqual({ value: 6, max: 6 });
	});

	it("drops min from a legacy {value,min,max} object", () => {
		const s = { hp: { value: 4, min: 0, max: 6 } };
		migrateCreatureData(s);
		expect(s.hp).toEqual({ value: 4, max: 6 });
	});

	it("leaves a {value, max} object effectively unchanged", () => {
		const s = { hp: { value: 3, max: 9 } };
		migrateCreatureData(s);
		expect(s.hp).toEqual({ value: 3, max: 9 });
	});

	it("does NOT inject max on a value-only partial update (migrate-on-diff: stepping HP must not reset max)", () => {
		const s = { hp: { value: 4 } }; // the diff Foundry re-migrates when you step current HP
		migrateCreatureData(s);
		expect(s.hp).toEqual({ value: 4 });   // max absent → SchemaField merge keeps the stored max
	});

	it("does NOT inject value on a max-only partial update", () => {
		const s = { hp: { max: 7 } };
		migrateCreatureData(s);
		expect(s.hp).toEqual({ max: 7 });     // value absent → stored value preserved
	});
});

describe("migrateCreatureData — armor to prose", () => {
	it("stringifies a flat NPC armor number", () => {
		const s = { armor: 2 };
		migrateCreatureData(s);
		expect(s.armor).toBe("2");
	});

	it("flattens a legacy { value, note } armor into one string", () => {
		const s = { armor: { value: 4, note: "(resilience), 0 vs. bronze" } };
		migrateCreatureData(s);
		expect(s.armor).toBe("4 (resilience), 0 vs. bronze");
	});

	it("stringifies a value-only armor object", () => {
		const s = { armor: { value: 0, note: "" } };
		migrateCreatureData(s);
		expect(s.armor).toBe("0");
	});

	it("leaves an armor string untouched", () => {
		const s = { armor: "3 (scales)" };
		migrateCreatureData(s);
		expect(s.armor).toBe("3 (scales)");
	});
});

describe("migrateCreatureData — damage to prose", () => {
	it("leaves an NPC damage string untouched", () => {
		const s = { damage: "spindly fingers d8 (close)" };
		migrateCreatureData(s);
		expect(s.damage).toBe("spindly fingers d8 (close)");
	});

	it("flattens a {value} damage object to the die string", () => {
		const s = { damage: { value: "d4", label: "", tags: "" } };
		migrateCreatureData(s);
		expect(s.damage).toBe("d4");
	});

	it("composes label, die and tags into prose", () => {
		const s = { damage: { value: "d8", label: "pummel", tags: "band" } };
		migrateCreatureData(s);
		expect(s.damage).toBe("pummel d8 (band)");
	});

	it("reads legacy damage.die", () => {
		const s = { damage: { die: "d6", label: "", tags: "" } };
		migrateCreatureData(s);
		expect(s.damage).toBe("d6");
	});

	it("yields empty string for an empty damage object", () => {
		const s = { damage: { value: null, label: "", tags: "" } };
		migrateCreatureData(s);
		expect(s.damage).toBe("");
	});
});

describe("migrateCreatureData — split instinct moves", () => {
	it("splits bullet lines out of the instinct into markdown moves", () => {
		const s = { instinct: "to get distracted\n-Speak with birds\n-Wander off" };
		migrateCreatureData(s);
		expect(s.instinct.selected).toEqual(["to get distracted"]);
		expect(s.moves).toBe("- Speak with birds\n- Wander off");
	});

	it("strips threat-style bullet glyphs (ä, >) and re-bullets as markdown", () => {
		const s = { instinct: "to feed\nä Unfurl\n> Lash out (d6+2)" };
		migrateCreatureData(s);
		expect(s.instinct.selected).toEqual(["to feed"]);
		expect(s.moves).toBe("- Unfurl\n- Lash out (d6+2)");
	});

	it("leaves a single-line instinct alone", () => {
		const s = { instinct: "to protect the gate" };
		migrateCreatureData(s);
		expect(s.instinct.selected).toEqual(["to protect the gate"]);
		expect(s.moves).toBeUndefined();
	});

	it("does not re-split when moves already exists", () => {
		const s = { instinct: "to feed\n-Bite", moves: "" };
		migrateCreatureData(s);
		expect(s.instinct.selected).toEqual(["to feed\n-Bite"]);
		expect(s.moves).toBe("");
	});
});

describe("migrateCreatureData — renames", () => {
	it("renames specialQualities to specialQuality", () => {
		const s = { specialQualities: "Fierce" };
		migrateCreatureData(s);
		expect(s.specialQuality).toBe("Fierce");
		expect(s.specialQualities).toBeUndefined();
	});

	it("does not clobber an existing specialQuality", () => {
		const s = { specialQuality: "Keep", specialQualities: "Drop" };
		migrateCreatureData(s);
		expect(s.specialQuality).toBe("Keep");
	});
});

// Foundry reserves `system.tags` on items and wipes it on every update, so creatures store
// their tags under `tagList`. (Confirmed in-app via Quench: any update to an npc item
// clears system.tags.selected, while a sibling selectionField named `cost` survives.)
describe("migrateCreatureData — tags → tagList", () => {
	it("moves a legacy Selection-shaped `tags` to `tagList` and drops `tags`", () => {
		const s = { tags: { selected: ["group"], options: ["group", "brave"], multi: true, allowCustom: true } };
		migrateCreatureData(s);
		expect(s.tags).toBeUndefined();
		expect(s.tagList.selected).toEqual(["group"]);
		expect(s.tagList.options).toEqual(["group", "brave"]);
	});

	it("converts a legacy free-string `tags` to a tagList Selection", () => {
		const s = { tags: "brave, bold" };
		migrateCreatureData(s);
		expect(s.tags).toBeUndefined();
		expect(s.tagList.selected).toEqual(["brave", "bold"]);
		expect(s.tagList.multi).toBe(true);
	});

	it("leaves an absent tagList absent (the schema field's initial supplies the default)", () => {
		// Migration must NOT inject a default for an absent tagList: Foundry re-runs migrateData on
		// the partial {changed-keys} diff of every update, where tagList is absent, and injecting an
		// empty Selection there would clobber the stored tags on every edit.
		const s = {};
		migrateCreatureData(s);
		expect(s.tagList).toBeUndefined();
	});

	it("does not inject an instinct/cost default for an absent field", () => {
		const s = {};
		migrateCreatureData(s);
		expect(s.instinct).toBeUndefined();
		expect(s.cost).toBeUndefined();
	});

	it("leaves an existing tagList Selection untouched", () => {
		const s = { tagList: { selected: ["x"], options: [], multi: true, allowCustom: true } };
		migrateCreatureData(s);
		expect(s.tagList.selected).toEqual(["x"]);
		expect(s.tags).toBeUndefined();
	});
});
