import { describe, it, expect } from "vitest";
import { ImprovementEffects, ImprovementEffect } from "../../src/model/data/steading/ImprovementEffect.js";
import { RequirementBoxes } from "../../src/model/data/steading/ImprovementRequirement.js";
import { Season } from "../../src/model/data/steading/Seasons.js";

const boxes = (sizes, counts = {}) => new RequirementBoxes(sizes, counts);
const effect = raw => ImprovementEffect.fromRaw(raw);

// The Mill, as the book states it: the requirements buy a rating and a Resources entry once, and the
// mill then generates Surplus at every autumn harvest thereafter.
const MILL = ImprovementEffects.fromRaw([
	{ requires: { all: ["site", "miller"] }, when: { kind: "completed" },
	  change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
	{ requires: { all: ["site", "miller"] }, when: { kind: "completed" },
	  listEntry: { list: "resources", text: "Mill" }, text: 'add "Mill" to the Resources list' },
	{ requires: { all: ["site", "miller"] }, when: { kind: "moment", moment: "autumn-harvest" },
	  change: { target: "surplus", amount: 1 }, text: "the steading generates +1 Surplus" },
]);
const MILL_SIZES = { site: 1, miller: 2 };

describe("what the sheet may apply, and what it only states", () => {
	it("applies a plain rating delta", () => {
		expect(effect({ change: { target: "surplus", amount: 1 }, text: "t" }).isAutomatic).toBe(true);
	});

	it("applies a list entry", () => {
		expect(effect({ listEntry: { list: "resources", text: "Mill" }, text: "t" }).isAutomatic).toBe(true);
	});

	// A die is the table's to roll.
	it("only states an effect the book rolls for", () => {
		expect(effect({ change: { target: "surplus", formula: "1d4" }, text: "t" }).isAdvisory).toBe(true);
	});

	// "if the market is active, and Population is +1 or better" — the sheet cannot know.
	it("only states an effect carrying a condition it cannot evaluate", () => {
		expect(effect({
			change: { target: "surplus", amount: 1 }, condition: "Population is +1 or better", text: "t",
		}).isAdvisory).toBe(true);
	});

	// An adjustment bends an arithmetic the sheet never performs.
	it("only states an adjustment", () => {
		expect(effect({
			adjustment: { step: "consumption", amount: -1 }, text: "consumes 1 less Surplus than normal",
		}).isAdvisory).toBe(true);
	});

	it("only states pure fiction", () => {
		expect(effect({ text: "a threat to the steading makes itself known" }).isAdvisory).toBe(true);
	});

	// The book's sentence is never derived from the numbers; it says things no amount can.
	it("keeps the book's own words beside the arithmetic", () => {
		const e = effect({ change: { target: "surplus", amount: -1 }, text: "the watch consumes 1 Surplus or it disbands" });
		expect(e.text).toBe("the watch consumes 1 Surplus or it disbands");
		expect(e.change.amount).toBe(-1);
	});
});

describe("a result only fires once its requirement holds", () => {
	// The mill generates nothing each autumn until there is a mill.
	it("withholds a seasonal result from an unbuilt improvement", () => {
		const unbuilt = boxes(MILL_SIZES, { site: 1 });
		expect(MILL.firingAt("moment", unbuilt, { moment: "autumn-harvest" })).toEqual([]);
	});

	it("fires it once the requirement is met", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		const firing = MILL.firingAt("moment", built, { moment: "autumn-harvest" });
		expect(firing.map(e => e.text)).toEqual(["the steading generates +1 Surplus"]);
	});

	it("keeps the harvest out of the turn", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		expect(MILL.firingAt("turn", built, { season: new Season("autumn") })).toEqual([]);
	});

	it("gives completion its two results, and only at completion", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		expect(MILL.firingAt("completed", built).map(e => e.text)).toEqual([
			"increase Fortunes by 1", 'add "Mill" to the Resources list',
		]);
	});
});

describe("seasons on a turn trigger", () => {
	const watch = ImprovementEffects.fromRaw([
		{ requires: "leaders", when: { kind: "turn" },
		  change: { target: "surplus", amount: -1 }, text: "the watch consumes 1 Surplus or it disbands" },
	]);
	const herd = ImprovementEffects.fromRaw([
		{ requires: "herd", when: { kind: "turn", seasons: ["winter"] },
		  change: { target: "surplus", amount: -1 }, text: "the herd consumes 1 Surplus per 6 horses" },
	]);

	// Naming no season means every season — "at the start of each season".
	it("fires in every season when none is named", () => {
		const b = boxes({ leaders: 1 }, { leaders: 1 });
		for (const key of ["spring", "summer", "autumn", "winter"]) {
			expect(watch.firingAt("turn", b, { season: new Season(key) })).toHaveLength(1);
		}
	});

	it("fires only in the season it names", () => {
		const b = boxes({ herd: 1 }, { herd: 1 });
		expect(herd.firingAt("turn", b, { season: new Season("winter") })).toHaveLength(1);
		expect(herd.firingAt("turn", b, { season: new Season("summer") })).toHaveLength(0);
	});
});

describe("a lapse is a requirement going false, not a trigger", () => {
	// Expanded Trades: "increase Prosperity by 1. If you cease to meet the requirements, decrease
	// Prosperity by 1." The reversal needs no trigger of its own — the same result simply stops
	// holding when the arbiter leaves.
	const trades = ImprovementEffects.fromRaw([
		{ requires: { all: [{ any: 1, of: ["stream", "mill"] }, { any: 3, of: ["a", "b", "c", "d"] }] },
		  when: { kind: "completed" }, change: { target: "prosperity", amount: 1 },
		  text: "increase Prosperity by 1" },
	]);
	const sizes = { stream: 1, mill: 1, a: 1, b: 1, c: 1, d: 1 };

	it("holds while the requirement is met", () => {
		expect(trades.firingAt("completed", boxes(sizes, { mill: 1, a: 1, b: 1, c: 1 }))).toHaveLength(1);
	});

	it("stops holding when it is not", () => {
		expect(trades.firingAt("completed", boxes(sizes, { mill: 1, a: 1, b: 1 }))).toHaveLength(0);
	});
});

describe("whether the improvement is built", () => {
	it("is false while nothing it promises is true", () => {
		expect(MILL.isBuilt(boxes(MILL_SIZES, { site: 1 }))).toBe(false);
	});

	it("is true once its requirements are met", () => {
		expect(MILL.isBuilt(boxes(MILL_SIZES, { site: 1, miller: 2 }))).toBe(true);
	});

	// Well-Trained Militia: the militia EXISTS as soon as there is a veteran warrior to command it —
	// its summer upkeep says so by requiring only that — even though its "+1 Defenses" waits on two
	// trained tactics. Demanding every result would leave it unbuilt while the table trained one.
	it("is true when any one result holds, not only when all of them do", () => {
		const militia = ImprovementEffects.fromRaw([
			{ requires: "veteran-warrior", when: { kind: "turn", seasons: ["summer"] },
			  change: { target: "surplus", amount: -1 },
			  text: "the militia must spend 1 Surplus practicing or else lose its training in 1 tactic" },
			{ requires: { all: ["veteran-warrior", { any: 2, of: ["archery", "cavalry", "formations"] }] },
			  when: { kind: "completed" }, change: { target: "defenses", amount: 1 },
			  text: "increase Defenses by 1" },
		]);
		const sizes = { "veteran-warrior": 1, archery: 1, cavalry: 1, formations: 1 };

		expect(militia.isBuilt(boxes(sizes, { "veteran-warrior": 1 }))).toBe(true);
		expect(militia.firingAt("completed", boxes(sizes, { "veteran-warrior": 1 }))).toHaveLength(0);
		expect(militia.firingAt("completed", boxes(sizes, { "veteran-warrior": 1, archery: 1, cavalry: 1 })))
			.toHaveLength(1);
	});

	it("is false for an improvement with no results authored", () => {
		expect(ImprovementEffects.fromRaw([]).isBuilt(boxes({}))).toBe(false);
		expect(ImprovementEffects.fromRaw(undefined).isEmpty).toBe(true);
	});
});

describe("reading the authored form", () => {
	it("drops a result with no text — a bare payload says nothing to the table", () => {
		expect(ImprovementEffects.fromRaw([{ change: { target: "surplus", amount: 1 } }]).isEmpty).toBe(true);
	});

	it("ignores a target, list or step it does not know", () => {
		const e = effect({
			change: { target: "morale", amount: 1 },
			listEntry: { list: "pantry", text: "x" },
			adjustment: { step: "weather", amount: 1 },
			text: "t",
		});
		expect([e.change, e.listEntry, e.adjustment]).toEqual([null, null, null]);
	});

	it("defaults an unknown trigger kind to completion", () => {
		expect(effect({ when: { kind: "eclipse" }, text: "t" }).trigger.kind).toBe("completed");
	});
});
