import { describe, it, expect } from "vitest";
import { ArcanumData } from "../../src/data/ArcanumData.js";

describe("ArcanumData defaults", () => {
	it("defaults weight to 1 and major to false", () => {
		const d = new ArcanumData();
		expect(d.weight).toBe(1);
		expect(d.major).toBe(false);
	});

	it("defaults description to empty string", () => {
		expect(new ArcanumData().description).toBe("");
	});

	it("defaults slug and sortOrder to null", () => {
		const d = new ArcanumData();
		expect(d.slug).toBeNull();
		expect(d.sortOrder).toBeNull();
	});

	it("defaults front and back to null", () => {
		const d = new ArcanumData();
		expect(d.front).toBeNull();
		expect(d.back).toBeNull();
	});

	it("defaults choiceValues to empty object", () => {
		expect(new ArcanumData().choiceValues).toEqual({});
	});
});

describe("ArcanumData.migrateData — legacy value stores → choiceValues", () => {
	it("folds unlockValues and backChoiceValues into one choiceValues store (deep-merged by group slug)", () => {
		const out = ArcanumData.migrateData({
			slug: "cracked-flute",
			unlockValues:     { "cracked-flute": { "marks": 2 } },
			backChoiceValues: { "cracked-flute": { "andalau": 1 } },
		});
		expect(out.choiceValues).toEqual({ "cracked-flute": { "marks": 2, "andalau": 1 } });
		expect(out.unlockValues).toBeUndefined();
		expect(out.backChoiceValues).toBeUndefined();
	});

	it("preserves distinct group keys (e.g. consequences authored separately)", () => {
		const out = ArcanumData.migrateData({
			unlockValues:  { "azure": { "marks": 3 } },
			choiceValues:  { "consequences": { "c1": 1 } },
		});
		expect(out.choiceValues).toEqual({ "azure": { "marks": 3 }, "consequences": { "c1": 1 } });
	});

	it("is a no-op when there are no legacy stores (does not clobber a plain choiceValues diff)", () => {
		const out = ArcanumData.migrateData({ choiceValues: { "azure": { "marks": 1 } } });
		expect(out.choiceValues).toEqual({ "azure": { "marks": 1 } });
	});

	it("is a no-op on an unrelated partial diff", () => {
		const out = ArcanumData.migrateData({ flipped: true });
		expect(out).toEqual({ flipped: true });
	});
});

describe("ArcanumData.migrateData — choice-group normalization in front/back", () => {
	it("folds legacy follower wiring in back.choices into a follower grant", () => {
		const out = ArcanumData.migrateData({
			back: { choices: { slug: "mindgem", list: [
				{ type: "entry", slug: "the-mighty-servant", content: {}, track: { max: 1 },
					inlineDisplay: true, followers: ["the-mighty-servant"] },
			] } },
		});
		expect(out.back.choices.list[0].grants)
			.toEqual([{ type: "follower", slug: "the-mighty-servant", locations: ["inline", "tab"] }]);
		expect(out.back.choices.list[0].followers).toBeUndefined();
		expect(out.back.choices.list[0].inlineDisplay).toBeUndefined();
	});

	it("normalizes front.unlock rows the same way", () => {
		const out = ArcanumData.migrateData({
			front: { unlock: { slug: "ring-of-daagon", list: [
				{ type: "entry", slug: "the-ring", content: {}, track: { max: 1 },
					inlineDisplay: true, followers: ["the-ring"] },
			] } },
		});
		expect(out.front.unlock.list[0].grants.map(g => g.slug)).toEqual(["the-ring"]);
	});

	it("leaves a partial diff without front/back untouched (migrate-on-diff safety)", () => {
		const out = ArcanumData.migrateData({ flipped: true });
		expect(out).toEqual({ flipped: true });
	});
});
