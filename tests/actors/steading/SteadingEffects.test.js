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

function build({ owned = ["mill"], ticks = {}, attributes = {}, excluded = {}, applied = {} } = {}) {
	const repo = new FakeSteadingImprovementRepository();
	repo._improvements.push(MILL(), WATCH());
	const actor = new FakeActorBuilder().withSystem({
		improvements: owned,
		improvementValues: ticks,
		attributes: { fortunes: 0, surplus: 0, population: 0, prosperity: 0, defenses: 0, ...attributes },
		assets: { resources: [], fortifications: [], items: [] },
		turnoverExcluded: excluded,
		improvementsApplied: applied,
	}).build();
	return { actor, effects: new SteadingEffects(actor, new SteadingImprovements(actor, repo)), repo };
}

const BUILT_MILL = { mill: { site: 1, miller: 1 } };

describe("the completion statement", () => {
	it("is empty while the improvement is unbuilt", () => {
		const { effects, repo } = build({ ticks: { mill: { site: 1 } } });
		expect(effects.completionFor(repo._improvements[0]).isEmpty).toBe(true);
	});

	it("lists what finishing it does", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL });
		const s = effects.completionFor(repo._improvements[0]);
		expect(s.automatic.map(l => l.delta?.amount ?? l.listEntry.text)).toEqual(["+1", "Mill"]);
		// Named through a key, not written out — the raw `fortunes` used to print in every language.
		expect(s.automatic[0].delta.subjectKey).toBe("stonetop.steading.attr.fortunes");
	});

	// A result with nothing to apply is still shown — with its source, and no checkbox.
	it("separates what it can apply from what it only states", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL });
		const s = effects.completionFor(repo._improvements[0]);
		expect(s.automatic).toHaveLength(2);
		expect(s.advisory.map(l => l.text.raw)).toEqual(["each of supplies has 1 extra use"]);
	});

	// The harvest is not completion — it fires during autumn, every autumn.
	it("leaves the harvest out of completion", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL });
		expect(effects.completionFor(repo._improvements[0]).lines.map(l => l.text.raw))
			.not.toContain("the steading generates +1 Surplus");
	});

	it("says what the ratings become", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		expect(effects.completionFor(repo._improvements[0]).totals)
			.toEqual([expect.objectContaining({ target: "fortunes", from: 2, to: 3 })]);
	});
});

describe("opting a line out", () => {
	it("drops it from the totals without removing it from the statement", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL, excluded: { "mill:0": true } });
		const s = effects.completionFor(repo._improvements[0]);
		expect(s.lines).toHaveLength(3);
		expect(s.totals).toEqual([]);
		expect(s.lines.find(l => l.id === "mill:0").included).toBe(false);
	});

	it("is recorded, and can be put back", async () => {
		const { actor, effects } = build({ ticks: BUILT_MILL });
		await effects.setIncluded("mill:0", false);
		expect(actor.system.turnoverExcluded["mill:0"]).toBe(true);
		await effects.setIncluded("mill:0", true);
		expect(actor.system.turnoverExcluded["mill:0"]).toBe(false);
	});
});

describe("applying", () => {
	it("writes the rating and the list entry", async () => {
		const { actor, effects, repo } = build({ ticks: BUILT_MILL, attributes: { fortunes: 2 } });
		await effects.applyCompletion(repo._improvements[0]);
		expect(actor.system.attributes.fortunes).toBe(3);
		expect(actor.system.assets.resources).toEqual(["Mill"]);
	});

	it("never applies an advisory line", async () => {
		const { actor, effects, repo } = build({ ticks: BUILT_MILL });
		await effects.applyCompletion(repo._improvements[0]);
		// The "extra use" line has no payload at all; nothing but the two automatic ones moved.
		expect(actor.system.attributes.surplus).toBe(0);
	});

	it("leaves out a line the table opted out of", async () => {
		const { actor, effects, repo } = build({
			ticks: BUILT_MILL, attributes: { fortunes: 2 }, excluded: { "mill:0": true },
		});
		await effects.applyCompletion(repo._improvements[0]);
		expect(actor.system.attributes.fortunes).toBe(2);
		expect(actor.system.assets.resources).toEqual(["Mill"]);
	});

	// An improvement is finished once; its +1 Fortunes is not owed again next spring.
	it("records that the completion is applied", async () => {
		const { actor, effects, repo } = build({ ticks: BUILT_MILL });
		expect(effects.isCompletionApplied("mill")).toBe(false);
		await effects.applyCompletion(repo._improvements[0]);
		expect(effects.isCompletionApplied("mill")).toBe(true);
	});

	// Six people share this sheet; a re-apply must not double the entry.
	it("does not write a list entry twice", async () => {
		const { actor, effects, repo } = build({ ticks: BUILT_MILL });
		await effects.applyCompletion(repo._improvements[0]);
		await effects.applyCompletion(repo._improvements[0]);
		expect(actor.system.assets.resources).toEqual(["Mill"]);
	});

	it("writes nothing at all when every line is opted out", async () => {
		const { actor, effects, repo } = build({
			ticks: BUILT_MILL, excluded: { "mill:0": true, "mill:1": true },
		});
		const wrote = await effects.apply(effects.completionFor(repo._improvements[0]));
		expect(wrote).toBe(false);
		expect(actor.system.assets.resources).toEqual([]);
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
		const { actor, effects, repo } = build({
			owned: ["standing-watch"], ticks: { "standing-watch": { leaders: 1 } },
		});
		const s = effects.completionFor(repo._improvements[1]);
		expect(s.grantedMoveSlugs).toEqual(["heroic-reputation"]);
		expect(s.automatic.map(l => l.grantsMove)).toEqual([null]);
		await effects.apply(s);
		expect(actor.system.attributes.fortunes).toBe(0);
	});

	it("names nothing where no result confers a move", () => {
		const { effects, repo } = build({ ticks: BUILT_MILL });
		expect(effects.completionFor(repo._improvements[0]).grantedMoveSlugs).toEqual([]);
	});
});
