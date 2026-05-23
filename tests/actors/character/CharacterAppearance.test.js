import { describe, it, expect, vi } from "vitest";
import { CharacterAppearance } from "../../../module/actors/character/CharacterAppearance.js";
import { AppearanceSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

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
	["fresh-faced", "hale & hearty", "gray & wizened"],
	["imperious voice", "raspy voice", "soothing voice"],
];

describe("CharacterAppearance — existing behaviour", () => {
	it("saved returns empty object when no flag stored", () => {
		expect(makeAppearance().saved).toEqual({});
	});

	it("saved returns the stored selections", () => {
		expect(makeAppearance({ 0: "gray & wizened" }).saved).toEqual({ 0: "gray & wizened" });
	});

	it("select merges new selection into saved state", async () => {
		const flags = makeFlags({ 0: "fresh-faced" });
		const ap = new CharacterAppearance(flags);
		await ap.select(1, "raspy voice");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", { 0: "fresh-faced", 1: "raspy voice" });
	});
});

describe("CharacterAppearance.buildSnapshot", () => {
	it("returns an AppearanceSection", () => {
		expect(makeAppearance().buildSnapshot(APPEARANCE_DATA)).toBeInstanceOf(AppearanceSection);
	});

	it("includes one line per array entry", () => {
		expect(makeAppearance().buildSnapshot(APPEARANCE_DATA).options).toHaveLength(2);
	});

	it("each line has the correct lineIdx", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap.options[0].lineIdx).toBe(0);
		expect(snap.options[1].lineIdx).toBe(1);
	});

	it("each line option has the correct value", () => {
		const snap = makeAppearance().buildSnapshot(APPEARANCE_DATA);
		expect(snap.options[0].options[0].value).toBe("fresh-faced");
		expect(snap.options[0].options[2].value).toBe("gray & wizened");
	});

	it("saved option is marked selected", () => {
		const snap = makeAppearance({ 0: "gray & wizened" }).buildSnapshot(APPEARANCE_DATA);
		expect(snap.options[0].options.find(o => o.value === "gray & wizened").selected).toBe(true);
	});

	it("unsaved options are not selected", () => {
		const snap = makeAppearance({}).buildSnapshot(APPEARANCE_DATA);
		expect(snap.options[0].options.every(o => !o.selected)).toBe(true);
	});

	it("selections on different lines are independent", () => {
		const snap = makeAppearance({ 0: "fresh-faced", 1: "soothing voice" }).buildSnapshot(APPEARANCE_DATA);
		expect(snap.options[0].options.find(o => o.value === "fresh-faced").selected).toBe(true);
		expect(snap.options[1].options.find(o => o.value === "soothing voice").selected).toBe(true);
		expect(snap.options[0].options.find(o => o.value === "hale & hearty").selected).toBe(false);
	});

	it("returns empty options when appearanceData is absent", () => {
		expect(makeAppearance().buildSnapshot(undefined).options).toHaveLength(0);
	});

	it("returns empty options when appearanceData is empty", () => {
		expect(makeAppearance().buildSnapshot([]).options).toHaveLength(0);
	});
});
