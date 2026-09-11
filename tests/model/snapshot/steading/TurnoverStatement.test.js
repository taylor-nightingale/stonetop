import { describe, it, expect } from "vitest";
import { TurnoverLine, TurnoverStatement } from "../../../../src/model/snapshot/steading/TurnoverStatement.js";
import { ImprovementEffect } from "../../../../src/model/data/steading/ImprovementEffect.js";

// A result that BENDS a step of the season — "consumes 1 less Surplus than normal", "consider
// Population to be 1 lower" — is not the same kind of thing as one that adds to it. Five improvements
// bend winter's consumption, and every one used to sit in the same undifferentiated list as the
// results that simply pay out, nowhere near the place Surplus is actually consumed.

const effect = raw => ImprovementEffect.fromRaw(raw, {});

const line = (source, raw) =>
	new TurnoverLine({ id: `${source}:0`, source, effect: effect(raw) });

const bends = (source, step, text) =>
	line(source, { when: { kind: "turn", seasons: ["winter"] }, adjustment: { step }, text });

const pays = (source, amount, text) =>
	line(source, { when: { kind: "turn" }, change: { target: "surplus", amount }, text });

describe("TurnoverStatement.adjustments", () => {
	it("finds the results that bend a step", () => {
		const statement = new TurnoverStatement([
			pays("Standing Watch", -1, "consumes 1 Surplus"),
			bends("Stone Wall", "consumption", "consumes 1 less than normal"),
		]);
		expect(statement.adjustments.map(l => l.source)).toEqual(["Stone Wall"]);
	});

	it("finds none where nothing bends anything", () => {
		expect(new TurnoverStatement([pays("Mill", 1, "+1 Surplus")]).adjustments).toEqual([]);
	});

	// Never applied and never counted: an adjustment changes an arithmetic the sheet does not do.
	it("keeps an adjustment out of what Apply would write", () => {
		const statement = new TurnoverStatement([bends("Stone Wall", "consumption", "1 less")]);
		expect(statement.pending).toEqual([]);
		expect(statement.willChangeAnything).toBe(false);
	});
});

// Four kinds of result the season's own BOX shows somewhere of its own — against the step they bend,
// inside the result rows of the roll they wait on, in the upkeep the steading owes, and in the step
// that generates what they pay. The general list has to leave those out, or a result is stated twice.
describe("what the season's steps show for themselves", () => {
	const upkeep = pays("Standing Watch", -1, "consumes 1 Surplus, or it disbands");
	const gain   = pays("Mill", 1, "generates +1 Surplus");
	const wall   = bends("Stone Wall", "consumption", "consumes 1 less than normal");
	const stream = line("Harnessing the Stream", {
		when: { kind: "turn", seasons: ["spring"] }, change: { target: "surplus", amount: 1 },
		condition: true, outcome: "7+", text: "generates 1 Surplus",
	});

	// A bill the steading pays for what it built, not anything Seasons Change says.
	it("knows the steading's own bills from what the season pays out", () => {
		const statement = new TurnoverStatement([upkeep, gain, wall]);
		expect(statement.upkeep.map(l => l.source)).toEqual(["Standing Watch"]);
	});

	it("knows what waits on the season's own roll", () => {
		expect(new TurnoverStatement([stream, gain]).outcomeGated.map(l => l.source))
			.toEqual(["Harnessing the Stream"]);
	});

	// What the steading generates is the season's generation, so it goes to the step that generates.
	it("knows what the steading generates this season", () => {
		expect(new TurnoverStatement([upkeep, gain, wall, stream]).gains.map(l => l.source))
			.toEqual(["Mill"]);
	});

	// Both halves filtered the same way, so a line moved to a step leaves whichever list it was in.
	it("leaves all four out of the general list", () => {
		const statement = new TurnoverStatement([upkeep, gain, wall, stream]);
		expect(statement.owed.map(l => l.source)).toEqual([]);
		expect(statement.advisoryOwed.map(l => l.source)).toEqual([]);
	});

	/**
	 * A gain is left out of what "Apply the season" writes, unlike the upkeep beside it. Both moved to
	 * a section of the box — but the upkeep's rows keep their own per-line records, while a gain is
	 * paid by the generation step, whose record is the step's. Counted here as well, the season's
	 * Apply would pay a Surplus the step had already paid.
	 */
	it("never lets the season's own Apply pay a gain twice", () => {
		const statement = new TurnoverStatement([upkeep, gain], { surplus: 4 });
		expect(statement.automatic.map(l => l.source)).toEqual(["Standing Watch"]);
		expect(statement.totals.map(t => [t.target, t.delta])).toEqual([["surplus", -1]]);
	});

	// Moved, not dropped: the section it moved to is still this season's, so the season's own Apply
	// still writes it and the totals still count it.
	it("still writes the upkeep when the season is applied", () => {
		const statement = new TurnoverStatement([upkeep, wall], { surplus: 4 });
		expect(statement.pending.map(l => l.source)).toEqual(["Standing Watch"]);
		expect(statement.totals.map(t => [t.target, t.delta, t.to])).toEqual([["surplus", -1, 3]]);
	});
});

// Township asserts two ratings on completion. The footer still has to read "3 → 0", because before →
// after is what makes a batch reviewable before anybody commits to it.
describe("TurnoverStatement.totals — a rating set rather than moved", () => {
	const sets = (source, target, value) =>
		line(source, { set: { target, value }, text: `change ${target}` });

	it("states a set as the before and after it produces", () => {
		const statement = new TurnoverStatement([sets("Township", "population", 0)], { population: 3 });
		expect(statement.totals.map(t => [t.target, t.from, t.to])).toEqual([["population", 3, 0]]);
	});

	// A tier word is not arithmetic; "hamlet → town" is not something to add up, and the line's own
	// words already say it.
	it("leaves Size out of the arithmetic", () => {
		const statement = new TurnoverStatement([sets("Township", "size", "town")], { size: "village" });
		expect(statement.totals).toEqual([]);
		// Still applied, though — it is only the FOOTER that has nothing to say about it.
		expect(statement.pending.length).toBe(1);
	});

	// A set that changes nothing is not a change, the same rule a +0 delta already answers to.
	it("says nothing for a set to the value already held", () => {
		expect(new TurnoverStatement([sets("Township", "population", 3)], { population: 3 }).totals).toEqual([]);
	});
});
