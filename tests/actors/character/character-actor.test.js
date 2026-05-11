import { describe, it, expect } from "vitest";
import { StonetopCharacterActor } from "../../../module/actors/character/character-actor.js";

// -- onPlaybookAdded ------------------------------------------------------

describe("onPlaybookAdded", () => {
	const blessedPlaybook = {
		type: "playbook",
		flags: { stonetop: { hp: 18, damage: "d6" } },
	};

	function makeActor() {
		const updates = [];
		return { actor: { update: async (d) => updates.push(d) }, updates };
	}

	it("sets hp.max, hp.value, and damage.value from playbook flags", async () => {
		const { actor, updates } = makeActor();
		await new StonetopCharacterActor(actor).onPlaybookAdded([blessedPlaybook]);
		expect(updates[0]).toEqual({
			"system.attributes.hp.max": 18,
			"system.attributes.hp.value": 18,
			"system.attributes.damage.value": "d6",
		});
	});

	it("does nothing when no playbook is in documents", async () => {
		const { actor, updates } = makeActor();
		await new StonetopCharacterActor(actor).onPlaybookAdded([{ type: "move" }]);
		expect(updates).toHaveLength(0);
	});

	it("does nothing when the playbook has no stonetop flags", async () => {
		const { actor, updates } = makeActor();
		await new StonetopCharacterActor(actor).onPlaybookAdded([{ type: "playbook" }]);
		expect(updates).toHaveLength(0);
	});
});

// -- buildCreation (static) -----------------------------------------------

const BLESSED_FLAGS = {
	backgrounds: [
		{
			slug: "initiate",
			label: "Initiate",
			description: "...",
			choices: {
				label: "Who are they?",
				count: [2, 3],
				options: [
					{ slug: "enfys", label: "Enfys, your acolyte" },
					{ slug: "afon", label: "Afon, strange and Fae-touched" },
					{ slug: "gwendyl", label: "Gwendyl, your mentor" },
					{ slug: "olwin", label: "Olwin, your anointed lover" },
					{ slug: "seren", label: "Seren the Eldest" },
				],
			},
		},
		{ slug: "raised-by-wolves", label: "Raised by Wolves", description: "..." },
		{ slug: "vessel", label: "Vessel", description: "..." },
	],
	instincts: [
		{ word: "Delight", description: "To find beauty, in even the ugliest things." },
		{ word: "Detachment", description: "To remain unmoved, to be cold as winter." },
		{ word: "Nurture", description: "To help others grow, learn, or improve." },
		{ word: "Preservation", description: "To protect the natural world." },
		{ word: "Reverence", description: "To honor the spirits and give them their due." },
	],
	appearance: [
		["fresh-faced", "hale & hearty", "gray & wizened"],
		["imperious voice", "raspy voice", "soothing voice"],
		["curvy", "strapping", "rail-thin", "solid", "willowy"],
		["ceremonial robes", "furs, leather", "work clothes"],
	],
};

describe("buildCreation", () => {
	it("returns null when flags are absent (no playbook)", () => {
		expect(StonetopCharacterActor.buildCreation(null)).toBeNull();
		expect(StonetopCharacterActor.buildCreation(undefined)).toBeNull();
	});

	describe("with no saved selections", () => {
		const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, {});

		it("maps all backgrounds, none selected", () => {
			expect(result.backgrounds).toHaveLength(3);
			expect(result.backgrounds.every(b => !b.selected)).toBe(true);
		});

		it("maps all instincts with word and description", () => {
			expect(result.instincts).toHaveLength(5);
			expect(result.instincts[0]).toEqual({
				word: "Delight",
				description: "To find beauty, in even the ugliest things.",
			});
		});

		it("maps all appearance lines with correct lineIdx", () => {
			expect(result.appearance).toHaveLength(4);
			result.appearance.forEach((line, i) => {
				expect(line.lineIdx).toBe(i);
				expect(line.options.every(o => !o.selected)).toBe(true);
			});
		});

		it("maps correct number of options per appearance line", () => {
			expect(result.appearance[0].options).toHaveLength(3);
			expect(result.appearance[2].options).toHaveLength(5);
		});
	});

	describe("with saved selections", () => {
		const saved = {
			background: "vessel",
			appearance: { 0: "gray & wizened", 2: "willowy" },
		};
		const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, saved);

		it("marks the saved background as selected", () => {
			const vessel = result.backgrounds.find(b => b.slug === "vessel");
			expect(vessel.selected).toBe(true);
			expect(result.backgrounds.filter(b => b.selected)).toHaveLength(1);
		});

		it("maps instinct with word and description (no selection state)", () => {
			const nurture = result.instincts.find(i => i.word === "Nurture");
			expect(nurture.description).toBe("To help others grow, learn, or improve.");
		});

		it("marks selected appearance options by line index", () => {
			const line0 = result.appearance[0];
			expect(line0.options.find(o => o.value === "gray & wizened").selected).toBe(true);
			expect(line0.options.filter(o => o.selected)).toHaveLength(1);
		});

		it("leaves unselected appearance lines with no selection", () => {
			const line1 = result.appearance[1];
			expect(line1.options.every(o => !o.selected)).toBe(true);
		});
	});

	describe("background sub-choices (Initiate)", () => {
		it("includes choices on backgrounds that have them", () => {
			const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, {});
			const initiate = result.backgrounds.find(b => b.slug === "initiate");
			expect(initiate.choices).toBeDefined();
			expect(initiate.choices.options).toHaveLength(5);
		});

		it("formats countLabel from count array", () => {
			const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, {});
			const initiate = result.backgrounds.find(b => b.slug === "initiate");
			expect(initiate.choices.countLabel).toBe("2 or 3");
		});

		it("marks saved background sub-choices as selected", () => {
			const saved = {
				background: "initiate",
				backgroundChoices: { enfys: true, gwendyl: true },
			};
			const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, saved);
			const initiate = result.backgrounds.find(b => b.slug === "initiate");
			expect(initiate.choices.options.find(o => o.slug === "enfys").selected).toBe(true);
			expect(initiate.choices.options.find(o => o.slug === "gwendyl").selected).toBe(true);
			expect(initiate.choices.options.find(o => o.slug === "afon").selected).toBe(false);
		});

		it("omits choices on backgrounds that have none", () => {
			const result = StonetopCharacterActor.buildCreation(BLESSED_FLAGS, {});
			const vessel = result.backgrounds.find(b => b.slug === "vessel");
			expect(vessel.choices).toBeUndefined();
		});
	});
});
