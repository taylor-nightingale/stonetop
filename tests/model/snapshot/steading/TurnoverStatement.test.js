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

describe("TurnoverStatement.adjustmentGroups", () => {
	const grouped = () => new TurnoverStatement([
		bends("Stone Wall", "consumption", "consumes 1 less than normal"),
		bends("Golden Sapling", "generation", "generates 1 extra"),
		bends("Additional Housing", "consumption", "count Population as 1 lower"),
	]).adjustmentGroups;

	it("gathers them under the step each one bends", () => {
		expect(grouped().map(g => [g.step, g.lines.map(l => l.source)])).toEqual([
			["consumption", ["Stone Wall", "Additional Housing"]],
			["generation", ["Golden Sapling"]],
		]);
	});

	// The heading is what states when they apply, so no row has to.
	it("names each group by the step, for a heading", () => {
		expect(grouped()[0].labelKey).toBe("stonetop.steading.effects.step.consumption");
	});

	// A heading over nothing would read as a step this steading does differently when it does not.
	it("makes no group for a step nothing bends", () => {
		const groups = new TurnoverStatement([bends("Stone Wall", "consumption", "1 less")])
			.adjustmentGroups;
		expect(groups.map(g => g.step)).toEqual(["consumption"]);
	});

	it("makes no groups at all for a season nothing bends", () => {
		expect(new TurnoverStatement([pays("Mill", 1, "+1")]).adjustmentGroups).toEqual([]);
	});
});
