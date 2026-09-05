import { describe, it, expect } from "vitest";
import { Season, Seasons } from "../../src/model/data/steading/Seasons.js";
import { SteadingMoveCategories } from "../../src/model/data/steading/SteadingMoveCategories.js";

describe("Season", () => {
	it("names the Seasons Change move it belongs to", () => {
		expect(new Season("spring").moveSlug).toBe("seasons-change-spring");
	});

	it("names itself through a translation key, never an English string", () => {
		expect(new Season("autumn").labelKey).toBe("stonetop.steading.seasons.names.autumn");
	});

	it("advances to the season the book prints next", () => {
		expect(new Season("spring").next.key).toBe("summer");
		expect(new Season("autumn").next.key).toBe("winter");
	});

	it("wraps winter round to spring", () => {
		expect(new Season("winter").next.key).toBe("spring");
	});

	// The year turns on that wrap and nowhere else, so the turnover asks the season rather than
	// comparing keys itself.
	it("ends the year on winter alone", () => {
		expect(Seasons.all().filter(s => s.endsYear).map(s => s.key)).toEqual(["winter"]);
	});
});

describe("Seasons", () => {
	it("runs spring to winter, the order the book prints them", () => {
		expect(Seasons.all().map(s => s.key)).toEqual(["spring", "summer", "autumn", "winter"]);
	});

	it("finds the season a move slug belongs to", () => {
		expect(Seasons.forMoveSlug("seasons-change-autumn").key).toBe("autumn");
	});

	it("has no season for a move that isn't seasonal", () => {
		expect(Seasons.forMoveSlug("bolster")).toBeNull();
	});

	it("resolves a stored key to its season", () => {
		expect(Seasons.byKey("winter").key).toBe("winter");
	});

	// Rendering and advancing both need A season; neither has a branch for "none", so an unreadable
	// stored value lands on the default rather than crashing four partials down.
	it("falls back to the default for a key it doesn't know", () => {
		expect(Seasons.byKey("harvestide").key).toBe(Seasons.DEFAULT);
		expect(Seasons.byKey(undefined).key).toBe("winter");
	});

	// Winter, so a new steading's first act is letting spring break forth — the book's own opening
	// move. Starting in spring would make spring the one season the table never rolled.
	it("starts a steading in winter, so spring is the first season it rolls", () => {
		expect(Seasons.DEFAULT).toBe("winter");
		expect(Seasons.byKey(Seasons.DEFAULT).next.key).toBe("spring");
	});

	// One source: the move category sorts by these slugs, so a season renamed here can't leave the
	// category quietly sorting that move to the back.
	it("supplies the seasons move category's reading order", () => {
		expect(SteadingMoveCategories.byKey("seasons").order).toEqual(Seasons.moveSlugs());
	});
});
