import { describe, expect, it } from "vitest";
import { RollChoice, RollPrompt, RollRule } from "../../src/actors/RollPrompt.js";
import { RollableStat } from "../../src/actors/RollableStat.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";

const str = new RollableStat("str", "Strength", 1, "STR");
const dex = new RollableStat("dex", "Dexterity", 0, "DEX");
const roller = { rollerName: "Maelen", rollerNote: "The Seeker" };

describe("RollPrompt.forStat", () => {
	it("names the roll and the stat it rolls, and asks only for the mode", () => {
		const prompt = RollPrompt.forStat("Defy Danger", str, roller);
		expect(prompt.title).toBe("Defy Danger");
		expect(prompt.stat).toBe(str);
		expect(prompt.choices).toEqual([]);
		expect(prompt.choosesStat).toBe(false);
	});

	it("shows the dice it rolls, +the stat", () => {
		expect(RollPrompt.forStat("Defy Danger", str, roller).formula).toBe("2d6 + 1");
	});

	// A move that rolls a bare 2d6 names no stat.
	it("shows the bare dice when the roll has no stat", () => {
		const prompt = RollPrompt.forStat("Roll", null, roller);
		expect(prompt.stat).toBeNull();
		expect(prompt.formula).toBe("2d6");
	});
});

describe("RollPrompt.forChoice", () => {
	it("offers the stats to choose from, and none chosen", () => {
		const prompt = RollPrompt.forChoice("Defy Danger", [str, dex], roller);
		expect(prompt.choices).toEqual([str, dex]);
		expect(prompt.stat).toBeNull();
		expect(prompt.choosesStat).toBe(true);
	});

	it("shows the bare dice until a stat is chosen", () => {
		expect(RollPrompt.forChoice("Defy Danger", [str, dex], roller).formula).toBe("2d6");
	});
});

describe("RollPrompt — who rolls", () => {
	it("names the roller and their note", () => {
		const prompt = RollPrompt.forStat("Defy Danger", str, roller);
		expect(prompt.rollerName).toBe("Maelen");
		expect(prompt.rollerNote).toBe("The Seeker");
	});

	it("carries no note for a roller without one", () => {
		expect(RollPrompt.forStat("Muster", str, { rollerName: "Stonetop" }).rollerNote).toBeNull();
	});
});

describe("RollPrompt — the dice", () => {
	it("are two six-siders, whatever the mode later makes of them", () => {
		expect(RollPrompt.forStat("Defy Danger", str, roller).dice).toBe("2d6");
	});
});

describe("RollPrompt — reminders and the rule", () => {
	it("carries the move's reminders when there are some", () => {
		const notes = new RollModeNotes([new RollModeNote({ mode: "adv", source: "Township" })]);
		const prompt = RollPrompt.forStat("Muster", str, { ...roller, notes });
		expect(prompt.notes).toBe(notes);
		expect(prompt.hasNotes).toBe(true);
	});

	it("has no notes to draw when there are none, or only an empty list", () => {
		expect(RollPrompt.forStat("Muster", str, roller).hasNotes).toBe(false);
		expect(RollPrompt.forStat("Muster", str, { ...roller, notes: new RollModeNotes([]) }).hasNotes).toBe(false);
	});

	it("carries the rule that explains the modes", () => {
		const rule = new RollRule("advantage-disadvantage", "Advantage/Disadvantage");
		expect(RollPrompt.forStat("Muster", str, { ...roller, rule }).rule).toBe(rule);
		expect(RollPrompt.forStat("Muster", str, roller).rule).toBeNull();
	});
});

describe("RollChoice", () => {
	it("is what was picked: the stat (null when the prompt named it) and the mode", () => {
		const choice = new RollChoice("dex", "adv");
		expect(choice.stat).toBe("dex");
		expect(choice.rollMode).toBe("adv");
	});
});

describe("RollRule", () => {
	it("names the move by slug, and carries its display name for the button", () => {
		const rule = new RollRule("advantage-disadvantage", "Advantage/Disadvantage");
		expect(rule.slug).toBe("advantage-disadvantage");
		expect(rule.name).toBe("Advantage/Disadvantage");
	});
});
