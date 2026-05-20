import { describe, it, expect, vi } from "vitest";
import { CharacterPostDeath } from "../../../module/actors/character/CharacterPostDeath.js";
import { CharacterInstincts } from "../../../module/actors/character/CharacterInstincts.js";
import { CharacterLore } from "../../../module/actors/character/CharacterLore.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

describe("CharacterPostDeath", () => {
	it("activeSlug returns null when unset", () => {
		const pd = new CharacterPostDeath(makeFlags(), new CharacterInstincts(makeFlags()), new CharacterLore(makeFlags()));
		expect(pd.activeSlug).toBeNull();
	});

	it("setActiveSlug stores slug and activeSlug returns it", async () => {
		const flags = makeFlags();
		const pd = new CharacterPostDeath(flags, new CharacterInstincts(makeFlags()), new CharacterLore(makeFlags()));
		await pd.setActiveSlug("revenant");
		expect(flags.setFlag).toHaveBeenCalledWith("slug", "revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("instinct returns the CharacterInstincts instance", () => {
		const instinct = new CharacterInstincts(makeFlags());
		const pd = new CharacterPostDeath(makeFlags(), instinct, new CharacterLore(makeFlags()));
		expect(pd.instinct).toBe(instinct);
	});

	it("lore returns the CharacterLore instance", () => {
		const lore = new CharacterLore(makeFlags());
		const pd = new CharacterPostDeath(makeFlags(), new CharacterInstincts(makeFlags()), lore);
		expect(pd.lore).toBe(lore);
	});
});
