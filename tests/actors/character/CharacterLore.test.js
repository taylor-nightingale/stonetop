import { describe, it, expect, vi } from "vitest";
import { CharacterLore } from "../../../module/actors/character/CharacterLore.js";
import { LoreSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeLore(counts = {}, texts = {}) {
	return new CharacterLore(makeFlags({ counts, texts }));
}

const LORE_DATA = [
	{
		slug: "earth", title: "The Earth", description: "<p>The earth knows.</p>",
		options: [
			{ slug: "opt-a", description: "Option A" },
			{ slug: "opt-b", description: "Option B", max: 3 },
			{ slug: "opt-text", description: "A text question", type: "text" },
		],
	},
];

describe("CharacterLore", () => {
	it("counts returns empty object when no flag saved", () => {
		expect(new CharacterLore(makeFlags()).counts).toEqual({});
	});

	it("counts returns saved counts object", () => {
		const lore = new CharacterLore(makeFlags({ counts: { earth: { "opt-a": 1 } } }));
		expect(lore.counts).toEqual({ earth: { "opt-a": 1 } });
	});

	it("getCount returns 0 when no count saved for that key", () => {
		expect(new CharacterLore(makeFlags()).getCount("earth", "opt-a")).toBe(0);
	});

	it("getCount returns the stored count for the given slugs", () => {
		const lore = new CharacterLore(makeFlags({ counts: { earth: { "opt-a": 2 } } }));
		expect(lore.getCount("earth", "opt-a")).toBe(2);
	});

	it("getCount returns 0 for a different option even when other options exist", () => {
		const lore = new CharacterLore(makeFlags({ counts: { earth: { "opt-a": 1 } } }));
		expect(lore.getCount("earth", "opt-b")).toBe(0);
	});

	it("setCount stores nested by entry then option slug", async () => {
		const flags = makeFlags();
		await new CharacterLore(flags).setCount("earth", "opt-a", 1);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { earth: { "opt-a": 1 } });
	});

	it("setCount merges new option into existing entry", async () => {
		const store = { counts: { earth: { "opt-a": 1 } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setCount("earth", "opt-b", 1);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { earth: { "opt-a": 1, "opt-b": 1 } });
	});

	it("setCount merges new entry alongside existing entry", async () => {
		const store = { counts: { earth: { "opt-a": 1 } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setCount("sky", "opt-c", 2);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { earth: { "opt-a": 1 }, sky: { "opt-c": 2 } });
	});

	it("setCount overwrites an existing option value", async () => {
		const store = { counts: { earth: { "opt-a": 1 } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setCount("earth", "opt-a", 0);
		expect(flags.setFlag).toHaveBeenCalledWith("counts", { earth: { "opt-a": 0 } });
	});
});

describe("CharacterLore — text values", () => {
	it("texts returns empty object when no flag saved", () => {
		expect(new CharacterLore(makeFlags()).texts).toEqual({});
	});

	it("texts returns saved texts object", () => {
		const lore = new CharacterLore(makeFlags({ texts: { earth: { "q-one": "answer" } } }));
		expect(lore.texts).toEqual({ earth: { "q-one": "answer" } });
	});

	it("getText returns empty string when no value saved for that key", () => {
		expect(new CharacterLore(makeFlags()).getText("earth", "q-one")).toBe("");
	});

	it("getText returns the stored string for the given slugs", () => {
		const lore = new CharacterLore(makeFlags({ texts: { earth: { "q-one": "some answer" } } }));
		expect(lore.getText("earth", "q-one")).toBe("some answer");
	});

	it("setText stores nested by entry then option slug", async () => {
		const flags = makeFlags();
		await new CharacterLore(flags).setText("earth", "q-one", "my answer");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { earth: { "q-one": "my answer" } });
	});

	it("setText merges new option into existing entry", async () => {
		const store = { texts: { earth: { "q-one": "first" } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setText("earth", "q-two", "second");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { earth: { "q-one": "first", "q-two": "second" } });
	});

	it("setText merges new entry alongside existing entry", async () => {
		const store = { texts: { earth: { "q-one": "first" } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setText("sky", "q-two", "second");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { earth: { "q-one": "first" }, sky: { "q-two": "second" } });
	});

	it("setText overwrites an existing option value", async () => {
		const store = { texts: { earth: { "q-one": "old" } } };
		const flags = makeFlags(store);
		await new CharacterLore(flags).setText("earth", "q-one", "new");
		expect(flags.setFlag).toHaveBeenCalledWith("texts", { earth: { "q-one": "new" } });
	});
});

describe("CharacterLore.buildSnapshot", () => {
	it("returns a LoreSection", () => {
		expect(makeLore().buildSnapshot(LORE_DATA)).toBeInstanceOf(LoreSection);
	});

	it("includes one entry per lore entry", () => {
		expect(makeLore().buildSnapshot(LORE_DATA).entries).toHaveLength(1);
	});

	it("entry has slug, title, and description", () => {
		const snap = makeLore().buildSnapshot(LORE_DATA);
		expect(snap.entries[0].slug).toBe("earth");
		expect(snap.entries[0].title).toBe("The Earth");
		expect(snap.entries[0].description).toBe("<p>The earth knows.</p>");
	});

	it("entry includes all options", () => {
		expect(makeLore().buildSnapshot(LORE_DATA).entries[0].options).toHaveLength(3);
	});

	it("checkbox option count comes from getCount", () => {
		const snap = makeLore({ earth: { "opt-a": 1 } }).buildSnapshot(LORE_DATA);
		expect(snap.entries[0].options[0].count).toBe(1);
	});

	it("checkbox option count defaults to 0 when not saved", () => {
		expect(makeLore().buildSnapshot(LORE_DATA).entries[0].options[0].count).toBe(0);
	});

	it("text option textValue comes from getText", () => {
		const snap = makeLore({}, { earth: { "opt-text": "my answer" } }).buildSnapshot(LORE_DATA);
		expect(snap.entries[0].options[2].textValue).toBe("my answer");
	});

	it("text option textValue defaults to empty string when not saved", () => {
		expect(makeLore().buildSnapshot(LORE_DATA).entries[0].options[2].textValue).toBe("");
	});

	it("returns empty entries when loreData is absent", () => {
		expect(makeLore().buildSnapshot(undefined).entries).toHaveLength(0);
	});

	it("returns empty entries when loreData is empty", () => {
		expect(makeLore().buildSnapshot([]).entries).toHaveLength(0);
	});
});
