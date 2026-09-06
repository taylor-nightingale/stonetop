import { describe, it, expect } from "vitest";
import { Moment, Moments } from "../../src/model/data/steading/Moments.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";

/**
 * A moment is a named occasion INSIDE a season — one the sheet cannot see coming, which the table
 * declares by applying it. Everything about the registry follows from that one sentence, including
 * the case this file exists to pin down: an occasion that can happen in ANY season is still a
 * moment, not a fourth kind of trigger.
 */
describe("Moments", () => {
	const seasons = Seasons.all();

	it("knows which seasons a moment can occur in", () => {
		const harvest = Moments.byKey("autumn-harvest");
		expect(harvest.occursIn(Seasons.byKey("autumn"))).toBe(true);
		expect(harvest.occursIn(Seasons.byKey("spring"))).toBe(false);
	});

	it("has no opinion about a season it was not given", () => {
		expect(new Moment("nowhere", []).occursIn(Seasons.byKey("spring"))).toBe(false);
		expect(Moments.byKey("autumn-harvest").occursIn(null)).toBe(false);
	});

	it("resolves by key, and says so when it cannot", () => {
		expect(Moments.byKey("aurochs-hunt").key).toBe("aurochs-hunt");
		expect(Moments.byKey("not-a-moment")).toBeNull();
		expect(Moments.has("aurochs-hunt")).toBe(true);
		expect(Moments.has("not-a-moment")).toBe(false);
	});

	it("labels every moment through a translation key", () => {
		for (const moment of Moments.all()) {
			expect(moment.labelKey).toBe(`stonetop.steading.seasons.moments.${moment.key}`);
		}
	});

	/**
	 * The Inn's "once per season, when you expend 1 Surplus and bring folks together at the inn".
	 *
	 * Modelled as a moment rather than as a new `once-per-season` cadence, because it already is one:
	 * a named occasion the table triggers. The only difference from the harvest is that it can happen
	 * in any season — which is what `seasons` is for, so it needs no new machinery at all.
	 */
	describe("an occasion that can happen in any season", () => {
		const inn = Moments.byKey("inn-gathering");

		it("occurs in every season", () => {
			for (const season of seasons) {
				expect(inn.occursIn(season), season.key).toBe(true);
			}
		});

		it("is offered in every season, alongside whatever else that season has", () => {
			for (const season of seasons) {
				expect(Moments.inSeason(season)).toContain(inn);
			}
			expect(Moments.inSeason(Seasons.byKey("autumn"))).toContain(Moments.byKey("autumn-harvest"));
			expect(Moments.inSeason(Seasons.byKey("summer"))).not.toContain(Moments.byKey("autumn-harvest"));
		});
	});

	it("hands out a copy, so a caller cannot edit the registry", () => {
		const all = Moments.all();
		all.push(new Moment("intruder", ["spring"]));
		expect(Moments.has("intruder")).toBe(false);
	});
});
