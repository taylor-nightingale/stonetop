import { describe, it, expect, vi } from "vitest";
import { CharacterLore } from "../../../module/actors/character/CharacterLore.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

describe("CharacterLore", () => {
	it("counts returns empty object when no flag saved", () => {
		expect(new CharacterLore(makeFlags()).counts).toEqual({});
	});

	it("counts returns saved counts object", () => {
		const lore = new CharacterLore(makeFlags({ counts: { "earth:opt-a": 1 } }));
		expect(lore.counts).toEqual({ "earth:opt-a": 1 });
	});

	it("getCount returns 0 when no count saved for that key", () => {
		expect(new CharacterLore(makeFlags()).getCount("earth", "opt-a")).toBe(0);
	});

	it("getCount returns the stored count for the given slugs", () => {
		const lore = new CharacterLore(makeFlags({ counts: { "earth:opt-a": 2 } }));
		expect(lore.getCount("earth", "opt-a")).toBe(2);
	});

	it("getCount returns 0 for a different key even when other keys exist", () => {
		const lore = new CharacterLore(makeFlags({ counts: { "earth:opt-a": 1 } }));
		expect(lore.getCount("earth", "opt-b")).toBe(0);
	});

	it("setCount stores via composite key", async () => {
		const flags = makeFlags();
		await new CharacterLore(flags).setCount("earth", "opt-a", 1);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { "earth:opt-a": 1 });
	});

	it("setCount merges new count into existing counts", async () => {
		const store = { counts: { "earth:opt-a": 1 } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setCount("earth", "opt-b", 1);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { "earth:opt-a": 1, "earth:opt-b": 1 });
	});

	it("setCount overwrites an existing key", async () => {
		const store = { counts: { "earth:opt-a": 1 } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setCount("earth", "opt-a", 0);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { "earth:opt-a": 0 });
	});
});

describe("CharacterLore — text values", () => {
	it("texts returns empty object when no flag saved", () => {
		expect(new CharacterLore(makeFlags()).texts).toEqual({});
	});

	it("texts returns saved texts object", () => {
		const lore = new CharacterLore(makeFlags({ texts: { "earth:q-one": "answer" } }));
		expect(lore.texts).toEqual({ "earth:q-one": "answer" });
	});

	it("getText returns empty string when no value saved for that key", () => {
		expect(new CharacterLore(makeFlags()).getText("earth", "q-one")).toBe("");
	});

	it("getText returns the stored string for the given slugs", () => {
		const lore = new CharacterLore(makeFlags({ texts: { "earth:q-one": "some answer" } }));
		expect(lore.getText("earth", "q-one")).toBe("some answer");
	});

	it("setText stores via composite key", async () => {
		const flags = makeFlags();
		await new CharacterLore(flags).setText("earth", "q-one", "my answer");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { "earth:q-one": "my answer" });
	});

	it("setText merges new text into existing texts", async () => {
		const store = { texts: { "earth:q-one": "first" } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setText("earth", "q-two", "second");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { "earth:q-one": "first", "earth:q-two": "second" });
	});

	it("setText overwrites an existing key", async () => {
		const store = { texts: { "earth:q-one": "old" } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setText("earth", "q-one", "new");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { "earth:q-one": "new" });
	});
});
