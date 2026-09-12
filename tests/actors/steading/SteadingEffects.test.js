import { describe, it, expect } from "vitest";
import { SteadingEffects } from "../../../src/actors/steading/SteadingEffects.js";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { Season } from "../../../src/model/data/steading/Seasons.js";

// The Mill, as the pack holds it: two requirement rows, and results that pay out once it is built.
const MILL = () => new SteadingImprovement("mill", "Mill", {
	slug: "mill",
	list: [
		{ type: "entry", slug: "site",   content: { text: "a site" },   track: { max: 1 } },
		{ type: "entry", slug: "miller", content: { text: "a miller" }, track: { max: 1 } },
	],
}, 0, {
	requires: { all: ["site", "miller"] },
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
		{ when: { kind: "completed" }, listEntry: { list: "resources", text: "Mill" }, text: 'add "Mill" to the Resources list' },
		{ when: { kind: "moment", moment: "autumn-harvest" }, change: { target: "surplus", amount: 1 },
		  text: "the steading generates +1 Surplus" },
		{ when: { kind: "completed" }, text: "each of supplies has 1 extra use" },
	],
});

// Township, as the pack holds it: the one improvement that ASSERTS two ratings on completion rather
// than moving them, and the only one that touches Size at all.
const TOWNSHIP = () => new SteadingImprovement("township", "Township", {
	slug: "township",
	list: [{ type: "entry", slug: "government", content: { text: "a formal government" }, track: { max: 1 } }],
}, 0, {
	requires: "government",
	effects: [
		{ when: { kind: "completed" }, set: { target: "size", value: "town" }, text: "change Size to town" },
		{ when: { kind: "completed" }, set: { target: "population", value: 0 }, text: "change Population to +0" },
	],
});

// Standing Watch: an upkeep every season, and a fortifications entry on completion.
const WATCH = () => new SteadingImprovement("standing-watch", "Standing Watch", {
	slug: "standing-watch",
	list: [{ type: "entry", slug: "leaders", content: { text: "the leaders" }, track: { max: 1 } }],
}, 0, {
	requires: "leaders",
	effects: [
		{ when: { kind: "completed" }, listEntry: { list: "fortifications", text: "Standing watch" },
		  text: 'add "standing watch" to the Fortifications list' },
		{ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
		  text: "the watch consumes 1 Surplus or it disbands" },
		{ when: { kind: "completed" }, grantsMove: "heroic-reputation",
		  text: "gain the move: when you first meet someone from beyond Stonetop, roll +Fortunes" },
	],
});

// Raincatching, as the pack holds it: a summer payout waiting on the season's own roll landing on a
// 7+ — the 10+ row and the 7-9 row both.
const RAINCATCHING = () => new SteadingImprovement("raincatching", "Raincatching", {
	slug: "raincatching",
	list: [{ type: "entry", slug: "conduits", content: { text: "roofs and conduits" }, track: { max: 1 } }],
}, 0, {
	requires: "conduits",
	effects: [
		{ when: { kind: "turn", seasons: ["summer"] }, change: { target: "surplus", amount: 1 },
		  outcome: "7+", text: "the steading generates 1 Surplus" },
	],
});

// A homebrew improvement pairing the roll with a clause the sheet cannot judge. The dice answer the
// outcome and say nothing about whether the market was active, so it stays the table's.
const MARKET = () => new SteadingImprovement("market", "Market", {
	slug: "market",
	list: [{ type: "entry", slug: "stalls", content: { text: "the stalls" }, track: { max: 1 } }],
}, 0, {
	requires: "stalls",
	effects: [
		{ when: { kind: "turn", seasons: ["summer"] }, change: { target: "surplus", amount: 1 },
		  outcome: "7+", condition: true, text: "the market generates 1 Surplus, if it is active" },
	],
});

function build({ owned = ["mill"], ticks = {}, attributes = {}, applied = {}, turnover = {} } = {}) {
	const repo = new FakeSteadingImprovementRepository();
	repo._improvements.push(MILL(), WATCH(), TOWNSHIP(), RAINCATCHING(), MARKET());
	const actor = new FakeActorBuilder().withSystem({
		improvements: owned,
		improvementValues: ticks,
		attributes: { fortunes: 0, surplus: 0, population: 0, prosperity: 0, defenses: 0, ...attributes },
		assets: { resources: [], fortifications: [], items: [] },
		improvementsApplied: applied,
		turnoverApplied: turnover,
	}).build();
	return { actor, effects: new SteadingEffects(actor, new SteadingImprovements(actor, repo)), repo };
}

const BUILT_MILL = { mill: { site: 1, miller: 1 } };
const mill      = ({ repo }) => repo._improvements[0];
const watch     = ({ repo }) => repo._improvements[1];
const township  = ({ repo }) => repo._improvements[2];

describe("the payoff of one improvement", () => {
	// The card is the only place the payoff is stated now — the prose that used to say it was stripped
	// out of the pack — so an UNBUILT improvement still has to say what it will do. That is what
	// separates this from statementFor, which only ever collects what actually fires.
	it("states what an unbuilt improvement will do, and marks it unearned", () => {
		const ctx = build({ ticks: { mill: { site: 1 } } });
		const payoff = ctx.effects.payoffFor(mill(ctx));
		expect(payoff.completion.lines.map(l => l.text.raw)).toEqual([
			"increase Fortunes by 1", 'add "Mill" to the Resources list', "each of supplies has 1 extra use",
		]);
		expect(payoff.completion.lines.every(l => l.earned)).toBe(false);
		// Unearned lines get no control, so there is nothing to press and nothing to total.
		expect(payoff.completion.automatic).toEqual([]);
		expect(payoff.completion.totals).toEqual([]);
		expect(payoff.isOwed).toBe(false);
	});

	it("lists what finishing it does, once it is finished", () => {
		const ctx = build({ ticks: BUILT_MILL });
		const s = ctx.effects.payoffFor(mill(ctx)).completion;
		expect(s.automatic.map(l => l.delta?.amount ?? l.listEntry.text)).toEqual(["+1", "Mill"]);
		// Named through a key, not written out — the raw `fortunes` used to print in every language.
		expect(s.automatic[0].delta.subjectKey).toBe("stonetop.steading.attr.fortunes");
	});

	// A result with nothing to apply is still shown — with its source, and no control.
	it("separates what it can apply from what it only states", () => {
		const ctx = build({ ticks: BUILT_MILL });
		const s = ctx.effects.payoffFor(mill(ctx)).completion;
		expect(s.automatic).toHaveLength(2);
		expect(s.advisory.map(l => l.text.raw)).toEqual(["each of supplies has 1 extra use"]);
	});

	it("says what the ratings become", () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		expect(ctx.effects.payoffFor(mill(ctx)).completion.totals)
			.toEqual([expect.objectContaining({ target: "fortunes", from: 2, to: 3 })]);
	});

	/**
	 * The harvest is not completion — it fires during autumn, EVERY autumn. It belongs in the
	 * Henceforth half, and that half is `stated`: seven turn/moment results across the pack are plain
	 * arithmetic, and a control for them on the card would pay them early and then again in the season
	 * that owns them.
	 */
	describe("the Henceforth half", () => {
		it("carries the results that fire later, away from the completion ones", () => {
			const ctx = build({ ticks: BUILT_MILL });
			const payoff = ctx.effects.payoffFor(mill(ctx));
			expect(payoff.henceforth.lines.map(l => l.text.raw)).toEqual(["the steading generates +1 Surplus"]);
			expect(payoff.completion.lines.map(l => l.text.raw)).not.toContain("the steading generates +1 Surplus");
		});

		it("offers no control over them, even though the sheet could write them", () => {
			const ctx = build({ ticks: BUILT_MILL });
			const { henceforth } = ctx.effects.payoffFor(mill(ctx));
			// The line itself IS automatic — this is the statement declining to be the one that writes it.
			expect(henceforth.lines[0].isAutomatic).toBe(true);
			expect(henceforth.automatic).toEqual([]);
			expect(henceforth.pending).toEqual([]);
			expect(henceforth.totals).toEqual([]);
			expect(henceforth.willChangeAnything).toBe(false);
		});

		it("still states a result whose requirement does not hold yet", () => {
			const ctx = build({ ticks: {} });
			expect(ctx.effects.payoffFor(mill(ctx)).henceforth.lines).toHaveLength(1);
		});
	});
});

describe("applying one line at a time", () => {
	it("writes only the line pressed, and records what it wrote", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		expect(await ctx.effects.applyLine("mill:0")).toBe(true);
		expect(ctx.actor.system.attributes.fortunes).toBe(3);
		// The other completion line was not pressed, so it did not happen.
		expect(ctx.actor.system.assets.resources).toEqual([]);
		expect(ctx.actor.system.improvementsApplied["mill:0"]).toEqual({ change: { target: "fortunes", amount: 1 } });
	});

	it("writes a list entry, and records it by value", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		await ctx.effects.applyLine("mill:1");
		expect(ctx.actor.system.assets.resources).toEqual(["Mill"]);
		expect(ctx.actor.system.improvementsApplied["mill:1"]).toEqual({ entry: { list: "resources", text: "Mill" } });
	});

	// Six people share this sheet; the second press must not pay it twice.
	it("refuses to apply the same line again", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		await ctx.effects.applyLine("mill:0");
		expect(await ctx.effects.applyLine("mill:0")).toBe(false);
		expect(ctx.actor.system.attributes.fortunes).toBe(3);
	});

	it("refuses a line whose requirement does not hold", async () => {
		const ctx = build({ ticks: { mill: { site: 1 } } });
		expect(await ctx.effects.applyLine("mill:0")).toBe(false);
		expect(ctx.actor.system.attributes.fortunes).toBe(0);
	});

	it("refuses an advisory line, which has nothing to write", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		expect(await ctx.effects.applyLine("mill:3")).toBe(false);
	});

	it("says nothing to an id that addresses no result", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		for (const id of ["mill:99", "nonsuch:0", "mill", "", null]) {
			expect(await ctx.effects.applyLine(id), String(id)).toBe(false);
		}
	});

	// A completion is owed once ever; a harvest is owed again next autumn. Two stores, and filing a
	// harvest in the durable one would pay the Mill once and never again.
	it("files a completion durably and a seasonal result in the season's own record", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		await ctx.effects.applyLine("mill:0");
		await ctx.effects.applyLine("mill:2");
		expect(Object.keys(ctx.actor.system.improvementsApplied)).toEqual(["mill:0"]);
		expect(Object.keys(ctx.actor.system.turnoverApplied)).toEqual(["mill:2"]);
	});
});

describe("taking a line back", () => {
	it("subtracts exactly what it added, and clears the record", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		await ctx.effects.applyLine("mill:0");
		expect(await ctx.effects.revertLine("mill:0")).toBe(true);
		expect(ctx.actor.system.attributes.fortunes).toBe(2);
		expect(ctx.actor.system.improvementsApplied["mill:0"]).toBeUndefined();
	});

	it("removes the list entry it added and leaves the rest", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		ctx.actor.system.assets.resources = ["Quarry"];
		await ctx.effects.applyLine("mill:1");
		expect(ctx.actor.system.assets.resources).toEqual(["Quarry", "Mill"]);
		await ctx.effects.revertLine("mill:1");
		expect(ctx.actor.system.assets.resources).toEqual(["Quarry"]);
	});

	// Reverting takes away its OWN 1, wherever the rating stands now — it does not restore a
	// remembered total, because the rating moves for other reasons between apply and revert.
	it("subtracts its own delta from wherever the rating now stands", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		await ctx.effects.applyLine("mill:0");
		ctx.actor.system.attributes.fortunes = 7;
		await ctx.effects.revertLine("mill:0");
		expect(ctx.actor.system.attributes.fortunes).toBe(6);
	});

	it("refuses to revert a line that was never applied", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		expect(await ctx.effects.revertLine("mill:0")).toBe(false);
	});

	// The old storage said THAT a completion happened and not WHAT it wrote. Inventing an inverse for
	// one would be a guess that looks like a fact.
	it("refuses to revert a legacy apply, and leaves it applied", async () => {
		const ctx = build({ ticks: BUILT_MILL, applied: { "mill:0": { legacy: true } } });
		expect(await ctx.effects.revertLine("mill:0")).toBe(false);
		expect(ctx.actor.system.improvementsApplied["mill:0"]).toEqual({ legacy: true });
		expect((await ctx.effects.lineById("mill:0")).isApplied).toBe(true);
	});

	it("re-offers a reverted line", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		await ctx.effects.applyLine("mill:0");
		await ctx.effects.revertLine("mill:0");
		expect((await ctx.effects.lineById("mill:0")).isPending).toBe(true);
	});
});

describe("applying a whole statement", () => {
	it("writes every pending line in ONE update", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		const before = ctx.actor.update.mock?.calls?.length ?? 0;
		expect(await ctx.effects.apply(ctx.effects.payoffFor(mill(ctx)).completion)).toBe(true);
		expect(ctx.actor.system.attributes.fortunes).toBe(3);
		expect(ctx.actor.system.assets.resources).toEqual(["Mill"]);
		if (ctx.actor.update.mock) expect(ctx.actor.update.mock.calls.length - before).toBe(1);
	});

	it("skips the lines already applied and writes the rest", async () => {
		const ctx = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		await ctx.effects.applyLine("mill:0");
		await ctx.effects.apply(ctx.effects.payoffFor(mill(ctx)).completion);
		expect(ctx.actor.system.attributes.fortunes).toBe(3);
		expect(ctx.actor.system.assets.resources).toEqual(["Mill"]);
	});

	it("writes nothing when there is nothing left to write", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		await ctx.effects.apply(ctx.effects.payoffFor(mill(ctx)).completion);
		expect(await ctx.effects.apply(ctx.effects.payoffFor(mill(ctx)).completion)).toBe(false);
		expect(ctx.actor.system.assets.resources).toEqual(["Mill"]);
	});

	it("never applies an advisory line", async () => {
		const ctx = build({ ticks: BUILT_MILL });
		await ctx.effects.apply(ctx.effects.payoffFor(mill(ctx)).completion);
		// The "extra use" line has no payload at all; nothing but the two automatic ones moved.
		expect(ctx.actor.system.attributes.surplus).toBe(0);
	});
});

// Pressing Apply on the row the dice landed on asked the table to answer a question the dice had
// just answered in front of them. The roll knows where it landed, so it pays what landing there owes.
describe("the results the season's own roll lands on", () => {
	const BUILT_RAIN = { raincatching: { conduits: 1 } };
	const summer     = effects => effects.statementFor("turn", { season: new Season("summer") });

	it("writes the line the roll landed on", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		expect(await effects.applyOutcome(await summer(effects), "success")).toBe(true);
		expect(actor.system.attributes.surplus).toBe(1);
	});

	// A 7+ is the 10+ row and the 7-9 row both.
	it("writes it on a partial as readily as on a full success", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		await effects.applyOutcome(await summer(effects), "partial");
		expect(actor.system.attributes.surplus).toBe(1);
	});

	it("writes nothing on a roll the clause does not cover", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		expect(await effects.applyOutcome(await summer(effects), "failure")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(0);
	});

	// The box invites the table to roll the season as many times as it asks for.
	it("pays a second 7+ nothing", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		await effects.applyOutcome(await summer(effects), "success");
		expect(await effects.applyOutcome(await summer(effects), "partial")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(1);
	});

	// Never taken back: what a later roll misses is the table's to revert or to keep.
	it("leaves what it wrote standing when a later roll misses", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		await effects.applyOutcome(await summer(effects), "success");
		await effects.applyOutcome(await summer(effects), "failure");
		expect(actor.system.attributes.surplus).toBe(1);
		expect(actor.system.turnoverApplied["raincatching:0"]).toBeTruthy();
	});

	it("records it as a season-scoped line, revertable from its row", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: BUILT_RAIN });
		await effects.applyOutcome(await summer(effects), "success");
		expect(actor.system.turnoverApplied["raincatching:0"].change)
			.toEqual({ target: "surplus", amount: 1 });
		expect(await effects.revertLine("raincatching:0")).toBe(true);
		expect(actor.system.attributes.surplus).toBe(0);
	});

	it("leaves a clause the sheet cannot judge to the table", async () => {
		const { actor, effects } = build({ owned: ["market"], ticks: { market: { stalls: 1 } } });
		expect(await effects.applyOutcome(await summer(effects), "success")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(0);
	});

	// An unbuilt cistern generates nothing, whatever the dice say.
	it("writes nothing for an improvement that is not built", async () => {
		const { actor, effects } = build({ owned: ["raincatching"], ticks: {} });
		expect(await effects.applyOutcome(await summer(effects), "success")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(0);
	});
});

describe("the statement for a trigger", () => {
	it("gathers results across every built improvement", async () => {
		const { effects } = build({
			owned: ["mill", "standing-watch"],
			ticks: { ...BUILT_MILL, "standing-watch": { leaders: 1 } },
		});
		const s = await effects.statementFor("turn", { season: new Season("spring") });
		expect(s.lines.map(l => l.source)).toEqual(["Standing Watch"]);
		expect(s.totals).toEqual([expect.objectContaining({ target: "surplus", delta: -1 })]);
	});

	// A mill generates nothing each autumn until there is a mill.
	it("says nothing for an improvement that is not built", async () => {
		const { effects } = build({
			owned: ["mill", "standing-watch"], ticks: { "standing-watch": { leaders: 0 } },
		});
		expect((await effects.statementFor("turn", { season: new Season("spring") })).isEmpty).toBe(true);
	});

	it("finds a moment's results", async () => {
		const { effects } = build({ ticks: BUILT_MILL });
		const s = await effects.statementFor("moment", { moment: "autumn-harvest" });
		expect(s.totals).toEqual([expect.objectContaining({ target: "surplus", delta: 1 })]);
	});
});

describe("the moves a statement's results confer", () => {
	// A move is rolled, and what it does depends on the roll — so it is never an applied line. What
	// the sheet offers instead is the one thing the book's sentence cannot: something to roll.
	it("names them by slug, and never applies one", async () => {
		const ctx = build({ owned: ["standing-watch"], ticks: { "standing-watch": { leaders: 1 } } });
		const s = ctx.effects.payoffFor(watch(ctx)).completion;
		expect(s.grantedMoveSlugs).toEqual(["heroic-reputation"]);
		expect(s.automatic.map(l => l.grantsMove)).toEqual([null]);
		await ctx.effects.apply(s);
		expect(ctx.actor.system.attributes.fortunes).toBe(0);
	});

	it("names nothing where no result confers a move", () => {
		const ctx = build({ ticks: BUILT_MILL });
		expect(ctx.effects.payoffFor(mill(ctx)).completion.grantedMoveSlugs).toEqual([]);
	});
});

// Township's completion used to be one sentence with no payload, so the card offered nothing to press
// on the improvement that changes the most about a steading.
describe("a result that sets a rating rather than moving it", () => {
	const BUILT = { township: { government: 1 } };

	it("writes the tier and the number, and records both", async () => {
		const ctx = build({ owned: ["township"], ticks: BUILT, attributes: { population: 3, size: "village" } });
		const payoff = ctx.effects.payoffFor(township(ctx));
		expect(payoff.completion.pending.length).toBe(2);

		await ctx.effects.apply(payoff.completion);
		expect(ctx.actor.system.attributes.size).toBe("town");
		expect(ctx.actor.system.attributes.population).toBe(0);
		expect(ctx.actor.system.improvementsApplied["township:1"].set)
			.toEqual({ target: "population", from: 3, to: 0 });
	});

	// The whole reason a set records `from`: Population went to +0 from somewhere, and only the record
	// knows where.
	it("puts back the values it replaced", async () => {
		const ctx = build({ owned: ["township"], ticks: BUILT, attributes: { population: 3, size: "village" } });
		await ctx.effects.apply(ctx.effects.payoffFor(township(ctx)).completion);

		await ctx.effects.revertLine("township:1");
		expect(ctx.actor.system.attributes.population).toBe(3);
		await ctx.effects.revertLine("township:0");
		expect(ctx.actor.system.attributes.size).toBe("village");
	});

	// Each line independently, because each was applied independently.
	it("reverts one line without disturbing the other", async () => {
		const ctx = build({ owned: ["township"], ticks: BUILT, attributes: { population: 3, size: "village" } });
		await ctx.effects.apply(ctx.effects.payoffFor(township(ctx)).completion);

		await ctx.effects.revertLine("township:0");
		expect(ctx.actor.system.attributes.size).toBe("village");
		expect(ctx.actor.system.attributes.population).toBe(0);
	});

	// A steading that never chose a Size stores "" for it, and that is what a revert has to put back —
	// not a tier the table never picked.
	it("records an unset rating as unset", async () => {
		const ctx = build({ owned: ["township"], ticks: BUILT, attributes: { size: "" } });
		await ctx.effects.applyLine("township:0");
		expect(ctx.actor.system.improvementsApplied["township:0"].set)
			.toEqual({ target: "size", from: "", to: "town" });
		await ctx.effects.revertLine("township:0");
		expect(ctx.actor.system.attributes.size).toBe("");
	});

	// Unbuilt, it is a promise. The card states it; nothing writes it.
	it("writes nothing while the requirement does not hold", async () => {
		const ctx = build({ owned: ["township"], attributes: { population: 3, size: "village" } });
		expect(await ctx.effects.applyLine("township:0")).toBe(false);
		expect(ctx.actor.system.attributes.size).toBe("village");
	});
});
