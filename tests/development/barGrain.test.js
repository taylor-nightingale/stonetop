import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { bar, BarGrain, resetBarSequence } from "../../scripts/development/redesign-mock/parts.js";
import { rail } from "../../scripts/development/redesign-mock/rail.js";
import { CharacterSnapshot } from "../../scripts/development/redesign-mock/CharacterSnapshot.js";

/**
 * Each ink bar wears into a stone texture at its right end. The two textures ALTERNATE bar by bar in
 * the order the sheet draws them, so neighbours differ; and each bar shows its own stretch of its
 * texture, flipped or not, so no two read as the same patch. The stretch and the flips come from the
 * title, so a bar keeps its look when the sheet redraws.
 */

const TITLES = ["Basic Moves", "Expedition Moves", "Ailments", "Background", "Instinct", "Appearance",
	"Origin & name", "Collection", "Introductions", "Consequences", "Marks", "Terrible Purpose"];

describe("BarGrain", () => {
	it("alternates the two textures by the bar's place in the drawing order", () => {
		expect([0, 1, 2, 3].map(i => BarGrain.of("Instinct", i).heavy)).toEqual([false, true, false, true]);
	});

	it("gives the same title the same stretch and flips, wherever it is drawn", () => {
		const a = BarGrain.of("Background", 0), b = BarGrain.of("Background", 5);
		expect([a.position, a.flipX, a.flipY]).toEqual([b.position, b.flipX, b.flipY]);
	});

	// A percentage position keeps the bar's window inside the image, so it never runs off the end
	// and repeats.
	it("positions the texture as a whole percentage within the image", () => {
		for (const title of TITLES) {
			const { position } = BarGrain.of(title, 0);
			expect(Number.isInteger(position)).toBe(true);
			expect(position).toBeGreaterThanOrEqual(0);
			expect(position).toBeLessThanOrEqual(100);
		}
	});

	it("varies the stretch and the flips across the bars of one sheet", () => {
		const grains = TITLES.map((t, i) => BarGrain.of(t, i));
		expect(new Set(grains.map(g => g.position)).size).toBeGreaterThan(TITLES.length - 3);
		expect(new Set(grains.map(g => `${g.flipX}/${g.flipY}`)).size).toBe(4);
	});

	it("says itself as classes and a position", () => {
		const g = new BarGrain(true, 42, true, false);
		expect(g.classes).toBe("rd-bar--heavy rd-bar--flip-x");
		expect(g.style).toBe("--rd-grain: 42%");
		expect(new BarGrain(false, 7, false, true).classes).toBe("rd-bar--flip-y");
	});
});

describe("bar", () => {
	beforeEach(() => resetBarSequence());

	it("carries its grain, and the next bar drawn takes the other texture", () => {
		const first = bar({ title: "Instinct" });
		const second = bar({ title: "Instinct" });
		expect(first).toContain(`style="${BarGrain.of("Instinct", 0).style}"`);
		expect(first).not.toContain("rd-bar--heavy");
		expect(second).toContain("rd-bar--heavy");
	});

	it("starts the alternation again after a reset, so a redraw looks the same", () => {
		const before = [bar({ title: "A" }), bar({ title: "B" })];
		resetBarSequence();
		expect([bar({ title: "A" }), bar({ title: "B" })]).toEqual(before);
	});
});

// Switching tabs draws a different number of bars before the rail. The rail numbers its own, so its
// textures do not change with the tab.
describe("a surface's bars", () => {
	const S = new CharacterSnapshot(JSON.parse(readFileSync("scripts/development/mockup/maelen.json", "utf8")));

	it("wear the same textures whatever another surface drew first", () => {
		resetBarSequence();
		const alone = rail(S);
		bar({ title: "A tab's bar" });
		bar({ title: "Another" });
		bar({ title: "And a third" });
		expect(rail(S)).toBe(alone);
	});
});
