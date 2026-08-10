import { describe, it, expect } from "vitest";
import { Season, Seasons } from "../../src/model/data/steading/Seasons.js";
import { SteadingMoveCategories } from "../../src/model/data/steading/SteadingMoveCategories.js";

describe("Season", () => {
	it("names the Seasons Change move it belongs to", () => {
		expect(new Season("spring", "Spring").moveSlug).toBe("seasons-change-spring");
	});
});

describe("Seasons", () => {
	it("runs spring to winter, the order the book prints them", () => {
		expect(Seasons.all().map(s => s.key)).toEqual(["spring", "summer", "autumn", "winter"]);
	});

	it("finds the season a move slug belongs to", () => {
		expect(Seasons.forMoveSlug("seasons-change-autumn").label).toBe("Autumn");
	});

	it("has no season for a move that isn't seasonal", () => {
		expect(Seasons.forMoveSlug("bolster")).toBeNull();
	});

	// One source: the move category sorts by these slugs, so a season renamed here can't leave the
	// category quietly sorting that move to the back.
	it("supplies the seasons move category's reading order", () => {
		expect(SteadingMoveCategories.byKey("seasons").order).toEqual(Seasons.moveSlugs());
	});
});
