import { describe, it, expect, vi } from "vitest";
import { CharacterBackgrounds } from "../../../module/actors/character/CharacterBackgrounds.js";

function makeFlags(store = {}) {
	return {
		_store: { ...store },
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

describe("CharacterBackgrounds", () => {
	it("selectedSlug returns empty string when no saved selection", () => {
		const bg = new CharacterBackgrounds(makeFlags());
		expect(bg.selectedSlug).toBe("");
	});

	it("selectedSlug returns the stored slug", () => {
		const bg = new CharacterBackgrounds(makeFlags({ selected: "vessel" }));
		expect(bg.selectedSlug).toBe("vessel");
	});

	it("selectBackground stores the slug via setFlag", async () => {
		const flags = makeFlags();
		const bg = new CharacterBackgrounds(flags);
		await bg.selectBackground("initiate");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", "initiate");
	});

	it("choices returns empty object when no choices saved", () => {
		const bg = new CharacterBackgrounds(makeFlags());
		expect(bg.choices).toEqual({});
	});

	it("choices returns saved choices object", () => {
		const bg = new CharacterBackgrounds(makeFlags({ choices: { "hard-upbringing": true } }));
		expect(bg.choices).toEqual({ "hard-upbringing": true });
	});

	it("addChoice merges checked state into saved choices", async () => {
		const store = { choices: { "old-slug": false } };
		const flags = makeFlags(store);
		const bg = new CharacterBackgrounds(flags);
		const choice = { slug: "new-slug", isChecked: true };
		await bg.addChoice(choice);
		expect(flags.setFlag).toHaveBeenCalledWith("choices", { "old-slug": false, "new-slug": true });
	});

	it("addChoice works when no choices previously saved", async () => {
		const flags = makeFlags();
		const bg = new CharacterBackgrounds(flags);
		const choice = { slug: "hard-upbringing", isChecked: false };
		await bg.addChoice(choice);
		expect(flags.setFlag).toHaveBeenCalledWith("choices", { "hard-upbringing": false });
	});
});
