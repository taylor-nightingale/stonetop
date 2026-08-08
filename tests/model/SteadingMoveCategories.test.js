import { describe, it, expect } from "vitest";
import { SteadingMoveCategory, SteadingMoveCategories } from "../../src/model/data/steading/SteadingMoveCategories.js";

describe("SteadingMoveCategory", () => {
	it("ranks the slugs it names in the order it names them", () => {
		const category = new SteadingMoveCategory("seasons", "Seasons Change", ["a", "b", "c"]);
		expect(category.rank("a")).toBe(0);
		expect(category.rank("c")).toBe(2);
	});

	it("ranks an unnamed slug behind every named one", () => {
		const category = new SteadingMoveCategory("seasons", "Seasons Change", ["a", "b"]);
		expect(category.rank("zzz")).toBeGreaterThan(category.rank("b"));
	});

	// Two unnamed slugs must tie rather than both read as Infinity, or a comparator subtracting
	// their ranks gets NaN instead of 0 and never reaches its alphabetical tiebreak.
	it("ties unnamed slugs with each other", () => {
		const category = new SteadingMoveCategory("seasons", "Seasons Change", ["a"]);
		expect(category.rank("yyy") - category.rank("zzz")).toBe(0);
	});

	it("ranks everything equally when it names no order", () => {
		const category = new SteadingMoveCategory("homefront", "Homefront Moves");
		expect(category.rank("bolster") - category.rank("muster")).toBe(0);
	});
});

describe("SteadingMoveCategories", () => {
	it("lists homefront and seasons, in that reading order", () => {
		expect(SteadingMoveCategories.all().map(c => c.key)).toEqual(["homefront", "seasons"]);
	});

	it("labels each category for the move group heading", () => {
		expect(SteadingMoveCategories.byKey("homefront").label).toBe("Homefront Moves");
		expect(SteadingMoveCategories.byKey("seasons").label).toBe("Seasons Change");
	});

	it("orders the seasons spring to winter rather than alphabetically", () => {
		const seasons = SteadingMoveCategories.byKey("seasons");
		const sorted = ["seasons-change-winter", "seasons-change-autumn", "seasons-change-spring", "seasons-change-summer"]
			.sort((a, b) => seasons.rank(a) - seasons.rank(b));
		expect(sorted).toEqual([
			"seasons-change-spring",
			"seasons-change-summer",
			"seasons-change-autumn",
			"seasons-change-winter",
		]);
	});

	it("returns null for a key that is not a steading category", () => {
		expect(SteadingMoveCategories.byKey("basic")).toBeNull();
	});

	it("falls back to homefront for a move that arrives without a category", () => {
		expect(SteadingMoveCategories.defaultCategory().key).toBe("homefront");
	});
});
