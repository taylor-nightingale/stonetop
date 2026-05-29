import { describe, it, expect } from "vitest";
import { CharacterAppearance } from "../../../module/actors/character/CharacterAppearance.js";
import { StonetopFlags } from "../../../module/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";

function makeAppearance(stored = {}) {
	const actor = new FakeFlags();
	for (const [key, value] of Object.entries(stored)) {
		actor.setFlagNonAsync("stonetop", `appearance.${key}`, value);
	}
	return new CharacterAppearance(new StonetopFlags(actor, "appearance"));
}

const APPEARANCE_DATA = {
	slug: "appearance",
	list: [
		{ type: "pick", pickCount: 1, inline: true, options: [
			{ slug: "fresh-faced",      text: "fresh-faced" },
			{ slug: "hale-and-hearty",  text: "hale & hearty" },
			{ slug: "gray-and-wizened", text: "gray & wizened" },
		]},
		{ type: "pick", pickCount: 1, inline: true, options: [
			{ slug: "imperious-voice", text: "imperious voice" },
			{ slug: "raspy-voice",     text: "raspy voice" },
			{ slug: "soothing-voice",  text: "soothing voice" },
		]},
	],
};

// -- selectOption -------------------------------------------------------------

describe("CharacterAppearance — selectOption", () => {
	it("stores the chosen slug in values under the appearance group", async () => {
		const ap = makeAppearance();
		await ap.selectOption("raspy-voice", "imperious-voice,raspy-voice,soothing-voice");
		expect(ap._controller._flags.getFlag("values").appearance["raspy-voice"]).toBe(1);
	});

	it("zeroes sibling slugs when selecting an option", async () => {
		const ap = makeAppearance();
		await ap.selectOption("raspy-voice", "imperious-voice,raspy-voice,soothing-voice");
		expect(ap._controller._flags.getFlag("values").appearance["imperious-voice"]).toBe(0);
		expect(ap._controller._flags.getFlag("values").appearance["soothing-voice"]).toBe(0);
	});
});

// -- buildSnapshot ------------------------------------------------------------

describe("CharacterAppearance.buildSnapshot", () => {
	it("returns an array of rows", () => {
		expect(Array.isArray(makeAppearance().buildSnapshot(APPEARANCE_DATA))).toBe(true);
	});

	it("includes one row per list entry", () => {
		expect(makeAppearance().buildSnapshot(APPEARANCE_DATA)).toHaveLength(2);
	});

	it("each row has the correct rowKey", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].rowKey).toBe("appearance-row-0");
		expect(snap[1].rowKey).toBe("appearance-row-1");
	});

	it("each row is inline", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].inline).toBe(true);
		expect(snap[1].inline).toBe(true);
	});

	it("each row option has slug and text", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options[0].slug).toBe("fresh-faced");
		expect(snap[0].options[0].text).toBe("fresh-faced");
		expect(snap[0].options[2].slug).toBe("gray-and-wizened");
	});

	it("saved option is marked checked", () => {
		const snap = makeAppearance({ values: { appearance: { "gray-and-wizened": 1 } } }).buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.find(o => o.slug === "gray-and-wizened").checked).toBe(true);
	});

	it("unsaved options are not checked", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.every(o => !o.checked)).toBe(true);
	});

	it("selections on different rows are independent", () => {
		const snap = makeAppearance({ values: { appearance: { "fresh-faced": 1, "soothing-voice": 1 } } }).buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.find(o => o.slug === "fresh-faced").checked).toBe(true);
		expect(snap[1].options.find(o => o.slug === "soothing-voice").checked).toBe(true);
		expect(snap[0].options.find(o => o.slug === "hale-and-hearty").checked).toBe(false);
	});

	it("returns empty array when groupData is null", () => {
		expect(makeAppearance().buildSnapshot(null)).toHaveLength(0);
	});
});
