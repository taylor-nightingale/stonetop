import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// Locks the committed Stonetop steadfast's authored starting values (packs/src/steadfasts/stonetop.json
// is now the source of truth). Guards against regressions in the values we churned through: index-vs-
// actual numbers, size-as-number, mis-named asset lists.
const stonetop = JSON.parse(readFileSync(new URL("../../packs/src/steadfasts/stonetop.json", import.meta.url)));

describe("generated Stonetop steadfast", () => {
	const a = stonetop.system.attributes;

	it("is a steadfast item slugged stonetop", () => {
		expect(stonetop.type).toBe("steadfast");
		expect(stonetop.system.slug).toBe("stonetop");
	});

	it("starts fortunes at +1 and surplus at 1 (inside attributes)", () => {
		expect(a.fortunes).toBe(1);
		expect(a.surplus).toBe(1);
	});

	it("starts size at the village tier (a string, not a number)", () => {
		expect(a.size).toBe("village");
	});

	it("does not carry authored note strings (notes derive from the starting values)", () => {
		expect(stonetop.system.attributeNotes).toBeUndefined();
	});

	it("starts population/prosperity/defenses at the actual +0 rating", () => {
		expect(a.population).toBe(0);
		expect(a.prosperity).toBe(0);
		expect(a.defenses).toBe(0);
	});

	it("keeps the Prosperity/Defenses source lists under assets.resources/fortifications", () => {
		expect(stonetop.system.assets.resources.length).toBeGreaterThan(0);
		expect(stonetop.system.assets.fortifications.length).toBeGreaterThan(0);
		expect(stonetop.system.assets.resources).toContain("Distilling (whisky)");
	});

	it("grants the core steading improvements", () => {
		expect(stonetop.system.improvements).toContain("market");
		expect(stonetop.system.improvements).toContain("mill");
		expect(stonetop.system.improvements).toContain("well-trained-militia");
	});
});
