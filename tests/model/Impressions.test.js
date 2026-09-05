import { describe, it, expect } from "vitest";
import { Impressions } from "../../src/model/data/steading/Impressions.js";
import { Season } from "../../src/model/data/steading/Seasons.js";

const ROWS = [
	{ season: "spring", text: "Petrichor smell on a southerly breeze" },
	{ season: "spring", text: "Hopeful green poking through deadbrown grass and soil" },
	{ season: "winter", text: "Cloaks drawn tight against a bitter wind" },
];

describe("Impressions", () => {
	it("gives the lines for one season, in order", () => {
		expect(Impressions.fromRaw(ROWS).forSeason(new Season("spring"))).toEqual([
			"Petrichor smell on a southerly breeze",
			"Hopeful green poking through deadbrown grass and soil",
		]);
	});

	it("gives nothing for a season it has no lines for", () => {
		expect(Impressions.fromRaw(ROWS).forSeason(new Season("autumn"))).toEqual([]);
	});

	// Most steadfasts print no Impressions section, so an empty set is the common case.
	it("is empty for a steadfast that carries none", () => {
		expect(Impressions.fromRaw(undefined).isEmpty).toBe(true);
		expect(Impressions.fromRaw([]).isEmpty).toBe(true);
	});

	it("drops a row with no text", () => {
		expect(Impressions.fromRaw([{ season: "spring", text: "  " }]).isEmpty).toBe(true);
	});
});

describe("Impressions.pickFor", () => {
	// The chooser is injected, so what the wheel stamps is a testable fact rather than a coin toss.
	it("picks the line the chooser lands on", () => {
		const impressions = Impressions.fromRaw(ROWS);
		expect(impressions.pickFor(new Season("spring"), () => 0)).toBe("Petrichor smell on a southerly breeze");
		expect(impressions.pickFor(new Season("spring"), () => 0.99))
			.toBe("Hopeful green poking through deadbrown grass and soil");
	});

	it("picks from the season asked for, not from all of them", () => {
		expect(Impressions.fromRaw(ROWS).pickFor(new Season("winter"), () => 0))
			.toBe("Cloaks drawn tight against a bitter wind");
	});

	// Null rather than "" so the caller renders nothing at all — a blank quotation mark is worse
	// than no line.
	it("is null when the season has no lines", () => {
		expect(Impressions.fromRaw(ROWS).pickFor(new Season("autumn"), () => 0)).toBeNull();
		expect(Impressions.fromRaw([]).pickFor(new Season("spring"), () => 0)).toBeNull();
	});

	// A chooser returning exactly 1 would index past the end; the pick must stay in range whatever
	// it is handed.
	it("stays in range for a chooser at the very top", () => {
		expect(Impressions.fromRaw(ROWS).pickFor(new Season("spring"), () => 1))
			.toBe("Petrichor smell on a southerly breeze");
	});
});
