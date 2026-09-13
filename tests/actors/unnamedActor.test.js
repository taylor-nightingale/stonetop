import { describe, it, expect, afterEach } from "vitest";
import { isUnnamedActor } from "../../src/actors/unnamedActor.js";

// Foundry substitutes the localized type label when the create dialog's name box is left blank, and
// numbers it when that label is taken — so "Steading" / "Steading (2)" mean "nobody named this".
const actor = name => ({ type: "steading", name });

afterEach(() => { delete CONFIG.Actor; });

function withTypeLabel(label) {
	CONFIG.Actor = { typeLabels: { steading: label } };
}

describe("isUnnamedActor", () => {
	it("treats an empty or whitespace name as unnamed", () => {
		withTypeLabel("Steading");
		expect(isUnnamedActor(actor(""))).toBe(true);
		expect(isUnnamedActor(actor("   "))).toBe(true);
		expect(isUnnamedActor(actor(undefined))).toBe(true);
	});

	it("treats Foundry's default name for the type as unnamed", () => {
		withTypeLabel("Steading");
		expect(isUnnamedActor(actor("Steading"))).toBe(true);
		expect(isUnnamedActor(actor("  Steading  "))).toBe(true);
	});

	it("treats the numbered default name as unnamed", () => {
		withTypeLabel("Steading");
		expect(isUnnamedActor(actor("Steading (2)"))).toBe(true);
		expect(isUnnamedActor(actor("Steading (17)"))).toBe(true);
	});

	it("treats a chosen name as named", () => {
		withTypeLabel("Steading");
		expect(isUnnamedActor(actor("Havenrock"))).toBe(false);
		expect(isUnnamedActor(actor("Stonetop"))).toBe(false);
		expect(isUnnamedActor(actor("Steadings"))).toBe(false);
		expect(isUnnamedActor(actor("The Steading"))).toBe(false);
		expect(isUnnamedActor(actor("Steading (unfinished)"))).toBe(false);
	});

	it("falls back to the type's localization key when CONFIG has no label yet", () => {
		// fakeI18n.localize returns the key unchanged, which is what an unlocalized Foundry would show.
		expect(isUnnamedActor(actor("TYPES.Actor.steading"))).toBe(true);
		expect(isUnnamedActor(actor("Havenrock"))).toBe(false);
	});
});
