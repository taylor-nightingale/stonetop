import { describe, it, expect, vi } from "vitest";
import { CharacterAppearance } from "../../../module/actors/character/CharacterAppearance.js";

function makeFlags(selected = {}) {
	const store = { selected };
	return {
		getFlag: key => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeAppearance(saved = {}) {
	return new CharacterAppearance(makeFlags(saved));
}

const APPEARANCE_DATA = [
	{ inline: true, options: [
		{ slug: "fresh-faced",   text: "fresh-faced" },
		{ slug: "hale-and-hearty", text: "hale & hearty" },
		{ slug: "gray-and-wizened", text: "gray & wizened" },
	]},
	{ inline: true, options: [
		{ slug: "imperious-voice", text: "imperious voice" },
		{ slug: "raspy-voice",     text: "raspy voice" },
		{ slug: "soothing-voice",  text: "soothing voice" },
	]},
];

describe("CharacterAppearance — existing behaviour", () => {
	it("saved returns empty object when no flag stored", () => {
		expect(makeAppearance().saved).toEqual({});
	});

	it("saved returns the stored selections", () => {
		expect(makeAppearance({ 0: "gray-and-wizened" }).saved).toEqual({ 0: "gray-and-wizened" });
	});

	it("select merges new selection into saved state", async () => {
		const flags = makeFlags({ 0: "fresh-faced" });
		const ap = new CharacterAppearance(flags);
		await ap.select(1, "raspy-voice");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", { 0: "fresh-faced", 1: "raspy-voice" });
	});
});

describe("CharacterAppearance.buildSnapshot", () => {
	it("returns an array", () => {
		expect(Array.isArray(makeAppearance().buildSnapshot(APPEARANCE_DATA))).toBe(true);
	});

	it("includes one row per array entry", () => {
		expect(makeAppearance().buildSnapshot(APPEARANCE_DATA)).toHaveLength(2);
	});

	it("each row has the correct rowKey", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].rowKey).toBe(0);
		expect(snap[1].rowKey).toBe(1);
	});

	it("each row has inline: true", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].inline).toBe(true);
		expect(snap[1].inline).toBe(true);
	});

	it("each row option has slug and label", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options[0].slug).toBe("fresh-faced");
		expect(snap[0].options[0].text).toBe("fresh-faced");
		expect(snap[0].options[2].slug).toBe("gray-and-wizened");
	});

	it("saved option is marked checked", () => {
		const snap = makeAppearance({ 0: "gray-and-wizened" }).buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.find(o => o.slug === "gray-and-wizened").checked).toBe(true);
	});

	it("unsaved options are not checked", () => {
		const snap = makeAppearance({}).buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.every(o => !o.checked)).toBe(true);
	});

	it("selections on different lines are independent", () => {
		const snap = makeAppearance({ 0: "fresh-faced", 1: "soothing-voice" }).buildSnapshot(APPEARANCE_DATA);
		expect(snap[0].options.find(o => o.slug === "fresh-faced").checked).toBe(true);
		expect(snap[1].options.find(o => o.slug === "soothing-voice").checked).toBe(true);
		expect(snap[0].options.find(o => o.slug === "hale-and-hearty").checked).toBe(false);
	});

	it("returns empty array when appearanceData is absent", () => {
		expect(makeAppearance().buildSnapshot(undefined)).toHaveLength(0);
	});

	it("returns empty array when appearanceData is empty", () => {
		expect(makeAppearance().buildSnapshot([])).toHaveLength(0);
	});
});
