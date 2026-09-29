import { describe, it, expect } from "vitest";
import { BarGrain } from "../../src/utils/BarGrain.js";

// Each ink bar wears into a stone texture at its right end. The two textures alternate bar by bar in
// the order a surface draws them, so neighbours differ; each bar shows its own stretch of its texture,
// flipped or not, taken from its title so it keeps its look across a redraw.

const TITLES = ["Basic Moves", "Expedition Moves", "Ailments", "Background", "Instinct", "Appearance",
	"Origin & name", "Collection", "Introductions", "Consequences", "Marks", "Terrible Purpose"];

describe("BarGrain", () => {
	it("alternates the two textures by the bar's place in its surface's drawing order", () => {
		expect([0, 1, 2, 3].map(i => BarGrain.of("Instinct", i).heavy)).toEqual([false, true, false, true]);
	});

	it("gives the same title the same stretch and flips, wherever it is drawn", () => {
		const a = BarGrain.of("Background", 0), b = BarGrain.of("Background", 5);
		expect([a.position, a.flipX, a.flipY]).toEqual([b.position, b.flipX, b.flipY]);
	});

	// A percentage keeps the bar's window inside the image, so it never runs off the end and repeats.
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
		expect(g.classes).toBe("stonetop-bar--heavy stonetop-bar--flip-x");
		expect(g.style).toBe("--bar-grain: 42%");
		expect(new BarGrain(false, 7, false, true).classes).toBe("stonetop-bar--flip-y");
	});

	// A template reads it through a partial called with hash params, which drops getters.
	it("carries its classes and position as own fields", () => {
		expect(Object.keys(BarGrain.of("Marks", 1))).toEqual(expect.arrayContaining(["classes", "style"]));
	});

	it("treats a missing title as an empty one", () => {
		expect(BarGrain.of(undefined, 0)).toEqual(BarGrain.of("", 0));
	});
});
