import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// The steading composes a dozen collaborators. They are PRIVATE, and callers get named methods
// instead: `s.moves.incrementMove(...)` couples every caller to how the steading happens to be
// composed today, so changing the composition breaks callers that never asked to know about it.
//
// These pin that, because it is the kind of thing that erodes one convenient reach-through at a time.

const steading = () => new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos());

const COLLABORATORS = [
	"moves", "choices", "seasons", "improvements", "attributes", "debilities",
	"residents", "neighborPeople", "neighborPlaces", "content", "assets", "placesOfInterest",
];

describe("StonetopSteading encapsulation", () => {
	it.each(COLLABORATORS)("does not expose its %s collaborator", name => {
		expect(steading()[name]).toBeUndefined();
	});

	it("exposes only its own named surface", () => {
		const own = Object.getOwnPropertyNames(Object.getPrototypeOf(steading()));
		expect(own).not.toContain("moves");
		expect(own).toContain("setMoveChecked");
		expect(own).toContain("setChoicePickFor");
		expect(own).toContain("clearChoicePickFor");
	});
});

describe("the sheet talks to the steading, not through it", () => {
	const sheet = readFileSync(
		path.resolve(process.cwd(), "src/actors/steading/StonetopSteadingSheet.js"), "utf8");

	// e.g. `s.moves.incrementMove(...)` or `this._stonetopSteading.improvements.revoke(...)`.
	it.each(COLLABORATORS)("never reaches through the steading into %s", name => {
		expect(sheet).not.toMatch(new RegExp(`(?:_stonetopSteading|\\bs)\\.${name}\\.`));
	});
});

describe("the seasons category names itself once", () => {
	const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");

	// Seasons.CATEGORY is the single spelling. Everything else asks the category registry, or asks
	// the seasons themselves — so a second tabbed category needs no edit here.
	it("is spelled in the Seasons model and nowhere else in src", () => {
		const offenders = [
			"src/actors/steading/StonetopSteading.js",
			"src/actors/steading/SteadingMoves.js",
			"src/model/data/steading/SteadingMoveCategories.js",
			"src/model/snapshot/steading/SteadingSnapshot.js",
		].filter(f => /["']seasons["']/.test(read(f)));
		expect(offenders).toEqual([]);
	});

	it("is what the Seasons model exposes", async () => {
		const { Seasons } = await import("../../../src/model/data/steading/Seasons.js");
		expect(Seasons.CATEGORY).toBe("seasons");
	});
});
