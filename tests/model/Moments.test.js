import { describe, it, expect } from "vitest";
import { Moment, Moments } from "../../src/model/data/steading/Moments.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";
import { EffectTrigger } from "../../src/model/data/steading/ImprovementEffect.js";

/**
 * A moment is a named occasion INSIDE a season — one the sheet cannot see coming, which the table
 * declares by applying it. Which seasons it can happen in is the improvements' to say: each result
 * that fires at a moment names its seasons, and nothing in code keeps a list of them.
 */
const at = (moment, seasons, momentName) => EffectTrigger.fromRaw({ kind: "moment", moment, seasons, momentName });
const autumn = Seasons.byKey("autumn");
const spring = Seasons.byKey("spring");

describe("Moments", () => {
	it("gathers the moments results fire at, once each", () => {
		const moments = Moments.fromTriggers([at("autumn-harvest", ["autumn"]), at("autumn-harvest", ["autumn"]), at("aurochs-hunt", ["spring"])]);
		expect(moments.all().map(m => m.key)).toEqual(["autumn-harvest", "aurochs-hunt"]);
	});

	it("ignores every trigger that is not a moment", () => {
		const moments = Moments.fromTriggers([EffectTrigger.fromRaw({ kind: "turn", seasons: ["autumn"] }), EffectTrigger.fromRaw({ kind: "completed" })]);
		expect(moments.all()).toEqual([]);
	});

	// Two improvements at the same moment may name different seasons for it; it can happen in either.
	it("lets a moment happen in every season any of its results names", () => {
		const harvest = Moments.fromTriggers([at("feast", ["autumn"]), at("feast", ["winter"])]).byKey("feast");
		expect(harvest.seasons).toEqual(["autumn", "winter"]);
	});

	it("offers only the moments that can happen in a season", () => {
		const moments = Moments.fromTriggers([at("autumn-harvest", ["autumn"]), at("aurochs-hunt", ["spring"])]);
		expect(moments.inSeason(autumn).map(m => m.key)).toEqual(["autumn-harvest"]);
		expect(moments.inSeason(spring).map(m => m.key)).toEqual(["aurochs-hunt"]);
	});

	it("resolves by key, and says so when it cannot", () => {
		const moments = Moments.fromTriggers([at("aurochs-hunt", ["spring"])]);
		expect(moments.byKey("aurochs-hunt").key).toBe("aurochs-hunt");
		expect(moments.byKey("not-a-moment")).toBeNull();
	});
});

describe("Moment", () => {
	it("knows which seasons it can happen in", () => {
		const harvest = new Moment("autumn-harvest", { seasons: ["autumn"] });
		expect(harvest.occursIn(autumn)).toBe(true);
		expect(harvest.occursIn(spring)).toBe(false);
		expect(harvest.occursIn(null)).toBe(false);
	});

	// The book's moments are named in the language files, by key; one an author names carries its words.
	it("is named by a translation key, or by its author's words", () => {
		expect(new Moment("autumn-harvest").labelKey).toBe("stonetop.steading.seasons.moments.autumn-harvest");
		const festival = new Moment("custom-moment-x", { name: "the spring festival" });
		expect([festival.labelKey, festival.name]).toEqual([null, "the spring festival"]);
	});

	it("stays its author's while it has no name yet", () => {
		expect(new Moment("custom-moment-x", { name: "" }).labelKey).toBeNull();
	});

	it("takes its name from whichever of its results carries one", () => {
		const festival = Moments.fromTriggers([at("custom-moment-x", ["spring"]), at("custom-moment-x", ["spring"], "the spring festival")])
			.byKey("custom-moment-x");
		expect(festival.name).toBe("the spring festival");
	});
});
