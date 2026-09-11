import { describe, it, expect } from "vitest";
import { AppliedEffect } from "../../src/model/data/steading/AppliedEffect.js";
import { ImprovementEffect } from "../../src/model/data/steading/ImprovementEffect.js";
import { TurnoverLine } from "../../src/model/snapshot/steading/TurnoverStatement.js";

const lineFor = raw => new TurnoverLine({
	id: "mill:0", source: "Mill", effect: ImprovementEffect.fromRaw(raw),
});

describe("AppliedEffect", () => {
	describe("recording what a line wrote", () => {
		it("records a rating delta", () => {
			const applied = AppliedEffect.fromLine(lineFor({ text: "increase Fortunes by 1", change: { target: "fortunes", amount: 1 } }));
			expect(applied.change).toEqual({ target: "fortunes", amount: 1 });
			expect(applied.entry).toBeNull();
		});

		it("records a list entry", () => {
			const applied = AppliedEffect.fromLine(lineFor({ text: 'add "Mill"', listEntry: { list: "resources", text: "Mill" } }));
			expect(applied.entry).toEqual({ list: "resources", text: "Mill" });
			expect(applied.change).toBeNull();
		});

		// The value it REPLACED, which is the only inverse a set has. Township turning Population to
		// +0 is otherwise a one-way door.
		it("records what a set replaced as well as what it wrote", () => {
			const applied = AppliedEffect.fromLine(
				lineFor({ text: "change Population to +0", set: { target: "population", value: 0 } }),
				{ from: 3 });
			expect(applied.set).toEqual({ target: "population", from: 3, to: 0 });
			expect(applied.change).toBeNull();
			expect(applied.isRevertable).toBe(true);
		});

		it("records a set of Size by its tier word", () => {
			const applied = AppliedEffect.fromLine(
				lineFor({ text: "change Size to town", set: { target: "size", value: "town" } }),
				{ from: "village" });
			expect(applied.set).toEqual({ target: "size", from: "village", to: "town" });
		});

		// 0 and "" are what the two kinds of rating read as when nothing has ever set them, so a caller
		// with nothing to hand over still leaves a revertable record rather than an undefined one.
		it("falls back to the rating's unset value when the caller supplies none", () => {
			expect(AppliedEffect.fromLine(lineFor({ text: "to +0", set: { target: "population", value: 2 } })).set)
				.toEqual({ target: "population", from: 0, to: 2 });
			expect(AppliedEffect.fromLine(lineFor({ text: "to town", set: { target: "size", value: "town" } })).set)
				.toEqual({ target: "size", from: "", to: "town" });
		});

		// A rolled amount is not written by the sheet, so there is nothing to record — and recording
		// the formula would make revert subtract a die.
		it("records nothing for an amount the sheet does not write", () => {
			const applied = AppliedEffect.fromLine(lineFor({ text: "gain +1d4 Surplus", change: { target: "surplus", formula: "1d4" } }));
			expect(applied.change).toBeNull();
			expect(applied.isRevertable).toBe(false);
		});
	});

	describe("round-tripping through storage", () => {
		it("survives toRaw → fromRaw unchanged", () => {
			for (const original of [
				new AppliedEffect({ change: { target: "surplus", amount: -2 } }),
				new AppliedEffect({ entry: { list: "fortifications", text: "Palisade" } }),
				new AppliedEffect({ set: { target: "size", from: "village", to: "town" } }),
				// The two values that are falsy but real: a record whose presence was checked for truth
				// would come back from storage as a set that never happened.
				new AppliedEffect({ set: { target: "population", from: 3, to: 0 } }),
				new AppliedEffect({ set: { target: "size", from: "", to: "hamlet" } }),
				new AppliedEffect({ legacy: true }),
			]) {
				expect(AppliedEffect.fromRaw(original.toRaw())).toEqual(original);
			}
		});

		it("writes no empty keys, so a stored record says only what happened", () => {
			expect(new AppliedEffect({ change: { target: "fortunes", amount: 1 } }).toRaw())
				.toEqual({ change: { target: "fortunes", amount: 1 } });
		});

		it("reads nothing as nothing", () => {
			expect(AppliedEffect.fromRaw(null)).toBeNull();
			expect(AppliedEffect.fromRaw(undefined)).toBeNull();
		});

		// The old storage shape: `improvementsApplied.<slug> = true`. It says something was applied and
		// cannot say what, which is exactly what `legacy` means.
		it("reads the old bare `true` as a legacy apply", () => {
			const applied = AppliedEffect.fromRaw(true);
			expect(applied.legacy).toBe(true);
			expect(applied.isRevertable).toBe(false);
		});

		it("treats a record it cannot parse as legacy rather than as nothing", () => {
			expect(AppliedEffect.fromRaw({ change: { target: "fortunes" } }).isRevertable).toBe(false);
			expect(AppliedEffect.fromRaw({ change: { amount: 1 } }).isRevertable).toBe(false);
		});
	});

	describe("undoing exactly what was written", () => {
		it("subtracts the amount it added, from wherever the rating stands now", () => {
			const applied = new AppliedEffect({ change: { target: "fortunes", amount: 1 } });
			expect(applied.inverseUpdate({ attributes: { fortunes: 5 } })).toEqual({ "system.attributes.fortunes": 4 });
			// The rating moved since — by a hand edit, or by another improvement. Revert still takes
			// away its own 1 rather than restoring a remembered total.
			expect(applied.inverseUpdate({ attributes: { fortunes: 9 } })).toEqual({ "system.attributes.fortunes": 8 });
		});

		it("adds back what a negative delta took away", () => {
			expect(new AppliedEffect({ change: { target: "surplus", amount: -2 } })
				.inverseUpdate({ attributes: { surplus: 3 } })).toEqual({ "system.attributes.surplus": 5 });
		});

		it("treats an absent rating as zero", () => {
			expect(new AppliedEffect({ change: { target: "defenses", amount: 1 } }).inverseUpdate())
				.toEqual({ "system.attributes.defenses": -1 });
		});

		it("puts back the value a set replaced", () => {
			expect(new AppliedEffect({ set: { target: "size", from: "village", to: "town" } })
				.inverseUpdate({ attributes: { size: "town" } })).toEqual({ "system.attributes.size": "village" });
		});

		// The opposite of a delta on purpose. A set asserted a value, so undoing it asserts the previous
		// one — where the rating stands now is not part of the arithmetic, because there is none.
		it("restores a set regardless of where the rating stands now", () => {
			const applied = new AppliedEffect({ set: { target: "population", from: 3, to: 0 } });
			expect(applied.inverseUpdate({ attributes: { population: 0 } })).toEqual({ "system.attributes.population": 3 });
			expect(applied.inverseUpdate({ attributes: { population: 2 } })).toEqual({ "system.attributes.population": 3 });
		});

		// By VALUE: the list is edited by hand between seasons, so an index recorded at apply time
		// would by now point at somebody else's entry.
		it("removes its own list entry and leaves the rest in order", () => {
			const applied = new AppliedEffect({ entry: { list: "resources", text: "Mill" } });
			expect(applied.inverseUpdate({ assets: { resources: ["Quarry", "Mill", "Smithy"] } }))
				.toEqual({ "system.assets.resources": ["Quarry", "Smithy"] });
		});

		it("is content when the entry has already been removed by hand", () => {
			expect(new AppliedEffect({ entry: { list: "resources", text: "Mill" } })
				.inverseUpdate({ assets: { resources: ["Quarry"] } }))
				.toEqual({ "system.assets.resources": ["Quarry"] });
		});

		// The whole reason `legacy` exists: it cannot know what it wrote, so it must not guess.
		it("refuses to undo a legacy apply", () => {
			expect(new AppliedEffect({ legacy: true }).inverseUpdate({ attributes: { fortunes: 5 } })).toEqual({});
		});
	});
});
