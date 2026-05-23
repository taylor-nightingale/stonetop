import { describe, it, expect, vi } from "vitest";
import { CharacterInstincts } from "../../../module/actors/character/CharacterInstincts.js";
import { InstinctSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

function makeFlags(selected = "") {
	const store = { selected };
	return {
		getFlag: key => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeInstinct(selected = "") {
	return new CharacterInstincts(makeFlags(selected));
}

const INSTINCT_DATA = [
	{ word: "Delight",    description: "To find beauty, in even the ugliest things." },
	{ word: "Detachment", description: "To remain unmoved, to be cold as winter." },
];

describe("CharacterInstincts — existing behaviour", () => {
	it("selectedValue returns empty string when no saved selection", () => {
		expect(makeInstinct().selectedValue).toBe("");
	});

	it("selectedValue returns the stored value", () => {
		expect(makeInstinct("Delight — To find beauty, in even the ugliest things.").selectedValue)
			.toBe("Delight — To find beauty, in even the ugliest things.");
	});

	it("select stores the value via setFlag", async () => {
		const flags = makeFlags();
		const inst = new CharacterInstincts(flags);
		await inst.select("Nurture — To help others grow.");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", "Nurture — To help others grow.");
	});
});

describe("CharacterInstincts.buildSnapshot", () => {
	it("returns an InstinctSection", () => {
		expect(makeInstinct().buildSnapshot(INSTINCT_DATA)).toBeInstanceOf(InstinctSection);
	});

	it("includes one option per entry in instinctsData", () => {
		expect(makeInstinct().buildSnapshot(INSTINCT_DATA).options).toHaveLength(2);
	});

	it("option has word, description, and composite value", () => {
		const snap = makeInstinct().buildSnapshot(INSTINCT_DATA);
		expect(snap.options[0].word).toBe("Delight");
		expect(snap.options[0].description).toBe("To find beauty, in even the ugliest things.");
		expect(snap.options[0].value).toBe("Delight — To find beauty, in even the ugliest things.");
	});

	it("option matching selectedValue is marked selected", () => {
		const value = "Delight — To find beauty, in even the ugliest things.";
		const snap = makeInstinct(value).buildSnapshot(INSTINCT_DATA);
		expect(snap.options[0].selected).toBe(true);
		expect(snap.options[1].selected).toBe(false);
	});

	it("no option is selected when nothing saved", () => {
		expect(makeInstinct("").buildSnapshot(INSTINCT_DATA).options.every(o => !o.selected)).toBe(true);
	});

	it("selected is the saved value", () => {
		const value = "Delight — To find beauty, in even the ugliest things.";
		expect(makeInstinct(value).buildSnapshot(INSTINCT_DATA).selected).toBe(value);
	});

	it("selected is null when nothing saved", () => {
		expect(makeInstinct("").buildSnapshot(INSTINCT_DATA).selected).toBeNull();
	});

	it("returns empty options when instinctsData is absent", () => {
		expect(makeInstinct().buildSnapshot(undefined).options).toHaveLength(0);
	});
});
