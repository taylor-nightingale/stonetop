import { describe, it, expect } from "vitest";
import { ImprovementBoard, ImprovementProgress } from "../../src/model/snapshot/steading/ImprovementProgress.js";
import { SteadingImprovement } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { buildChoiceGroup } from "../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../src/model/snapshot/character/ChoiceGroup.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";

// An improvement as the pack holds it: tracked requirement rows, a requirement expression over them,
// and the effect prose.
function improvement(slug, tracks, requires, name = slug) {
	return new SteadingImprovement(slug, name, {
		slug,
		list: [
			...tracks.map(([rowSlug, max]) => ({
				type: "entry", slug: rowSlug, content: { text: `needs ${rowSlug}` }, track: { max },
			})),
			{ type: "entry", content: { text: "Henceforth, something happens." } },
		],
	}, 0, {
		requires: requires ?? { all: tracks.map(([rowSlug]) => rowSlug) },
		effects: [{ when: { kind: "completed" }, text: "it helps" }],
	});
}

const progressOf = (imp, ticks = {}) =>
	ImprovementProgress.from(imp, buildChoiceGroup(imp.titledChoices, new ChoiceValues({ [imp.slug]: ticks })), ticks);

describe("progress is measured against the requirement, not the boxes", () => {
	// The live bug this model exists to fix. The book prints two ways and asks for one, so counting
	// boxes made Greater Harvest permanently 1 of 2 — it could never complete, and its effect could
	// never fire.
	it("reads Greater Harvest as one of one, and completes it", () => {
		const harvest = improvement("greater-harvest",
			[["double-yield", 1], ["clear-fields", 1]],
			{ any: 1, of: ["double-yield", "clear-fields"] });

		expect(progressOf(harvest).total).toBe(1);
		expect(progressOf(harvest, { "double-yield": 1 }).isComplete).toBe(true);
		expect(progressOf(harvest, { "double-yield": 1 }).meter).toEqual([true]);
	});

	// Ticking both is allowed — nothing here enforces — but it must not read as 2 of 1.
	it("caps a meter at what the requirement asked for", () => {
		const harvest = improvement("greater-harvest",
			[["double-yield", 1], ["clear-fields", 1]],
			{ any: 1, of: ["double-yield", "clear-fields"] });
		const p = progressOf(harvest, { "double-yield": 1, "clear-fields": 1 });
		expect([p.ticked, p.total]).toEqual([1, 1]);
	});

	it("counts every box of an all-of improvement, multi-box rows included", () => {
		const mill = improvement("mill", [["site", 1], ["miller", 2], ["power", 1]]);
		expect(progressOf(mill).total).toBe(4);
		expect(progressOf(mill, { site: 1, miller: 1 }).ticked).toBe(2);
		expect(progressOf(mill, { site: 1, miller: 2, power: 1 }).isComplete).toBe(true);
	});

	// Weapons of War: buy the weapons, or build the means to make them. The meter measures the
	// cheaper branch, so a table is not shown a denominator it may never need.
	it("measures a branch against its cheaper side", () => {
		const weapons = improvement("weapons-of-war",
			[["buy", 1], ["smith", 1], ["ore", 1], ["seasons", 4], ["warrior", 1]],
			{ all: [{ any: 1, of: ["buy", { all: ["smith", "ore", "seasons"] }] }, "warrior"] });

		expect(progressOf(weapons).total).toBe(2);
		expect(progressOf(weapons, { buy: 1, warrior: 1 }).isComplete).toBe(true);
		expect(progressOf(weapons, { smith: 1, ore: 1, seasons: 4, warrior: 1 }).isComplete).toBe(true);
		expect(progressOf(weapons, { smith: 1, ore: 1, warrior: 1 }).isComplete).toBe(false);
	});
});

describe("the state a card reads as", () => {
	const mill = improvement("mill", [["site", 1], ["miller", 2]]);

	it("is untouched with nothing ticked", () => {
		expect(progressOf(mill).state).toBe("untouched");
	});

	it("is in progress once something is", () => {
		expect(progressOf(mill, { site: 1 }).state).toBe("progress");
	});

	it("is complete once the requirement is met", () => {
		expect(progressOf(mill, { site: 1, miller: 2 }).state).toBe("complete");
	});

	// An improvement that requires nothing is not a project waiting to be started.
	it("treats an improvement with no requirement as done", () => {
		const gift = improvement("gift", [], { all: [] });
		expect(progressOf(gift).total).toBe(0);
		expect(progressOf(gift).isComplete).toBe(true);
	});
});

describe("ImprovementBoard", () => {
	const entry = (slug, tracks, ticks, requires) => progressOf(improvement(slug, tracks, requires), ticks);

	// The board is never re-ordered. It used to sort by how close each was to done, which moved a
	// card the moment someone ticked a box on it — the one time they are certain to be looking at it.
	it("keeps the order the steading owns them in", () => {
		const board = new ImprovementBoard([
			entry("untouched", [["a", 7]]),
			entry("complete", [["a", 4]], { a: 4 }),
			entry("started", [["a", 3]], { a: 2 }),
		]);
		expect(board.entries.map(e => e.slug)).toEqual(["untouched", "complete", "started"]);
	});

	// Ticking one changes its state and its meter, and moves nothing.
	it("holds that order however far along each one is", () => {
		const entries = [entry("far", [["a", 10]], { a: 1 }), entry("near", [["a", 4]], { a: 3 })];
		expect(new ImprovementBoard(entries).entries.map(e => e.slug)).toEqual(["far", "near"]);
	});

	it("does not shuffle them alphabetically either", () => {
		const board = new ImprovementBoard([entry("zebra", [["a", 1]]), entry("apple", [["a", 1]])]);
		expect(board.entries.map(e => e.slug)).toEqual(["zebra", "apple"]);
	});

	it("states the counts its chips show", () => {
		const board = new ImprovementBoard([
			entry("a", [["x", 2]], { x: 1 }),
			entry("b", [["x", 2]], { x: 2 }),
			entry("c", [["x", 2]]),
			entry("d", [["x", 2]]),
		]);
		expect([board.inProgressCount, board.completeCount, board.untouchedCount]).toEqual([1, 1, 2]);
		expect(board.isEmpty).toBe(false);
	});

	it("is empty with no owned improvements", () => {
		expect(new ImprovementBoard([]).isEmpty).toBe(true);
	});
});


// A board of twenty rows says nothing about which of them the table is about to need. Three questions
// it can now answer, each cutting across the three states rather than joining them.
describe("what a card wants attention for", () => {
	const seasonal = (slug, when, name = slug) => new SteadingImprovement(slug, name, {
		slug,
		list: [{ type: "entry", slug: "work", content: { text: "needs work" }, track: { max: 1 } },
		       { type: "entry", content: { text: "Henceforth, something happens." } }],
	}, 0, {
		requires: { all: ["work"] },
		effects: [{ when, change: { target: "surplus", amount: 1 }, text: "the steading generates +1 Surplus" }],
	});

	const built   = { work: 1 };
	const autumn  = Seasons.byKey("autumn");
	const winter  = Seasons.byKey("winter");
	const cardFor = (imp, ticks, season) => ImprovementProgress.from(
		imp, buildChoiceGroup(imp.titledChoices, new ChoiceValues({ [imp.slug]: ticks })), ticks, null, season);

	describe("firesThisSeason", () => {
		it("is true where the improvement's own results fire when the wheel is here", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			expect(cardFor(mill, built, autumn).firesThisSeason).toBe(true);
			expect(cardFor(mill, built, winter).firesThisSeason).toBe(false);
		});

		// Both cadences a season carries: what fires when the wheel arrives, and what fires at a
		// moment the season can hold.
		it("counts a moment the season can hold", () => {
			const orchard = seasonal("orchard", { kind: "moment", moment: "autumn-harvest" });
			expect(cardFor(orchard, built, autumn).firesThisSeason).toBe(true);
			expect(cardFor(orchard, built, winter).firesThisSeason).toBe(false);
		});

		// The requirement half matters too: an unbuilt mill is not "firing this autumn" because a
		// built one would be.
		it("is false while the improvement is unbuilt", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			expect(cardFor(mill, {}, autumn).firesThisSeason).toBe(false);
		});

		it("is false where nothing says what season it is", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			expect(cardFor(mill, built, null).firesThisSeason).toBe(false);
		});
	});

	describe("isNearlyDone", () => {
		const twoBox = improvement("wall", [["stone", 1], ["labour", 1]]);

		it("is true one box short and false anywhere else", () => {
			expect(progressOf(twoBox, {}).isNearlyDone).toBe(false);
			expect(progressOf(twoBox, { stone: 1 }).isNearlyDone).toBe(true);
			expect(progressOf(twoBox, { stone: 1, labour: 1 }).isNearlyDone).toBe(false);
		});
	});

	// ONE reason, the strongest — three badges on one row would be a wall of its own.
	describe("attentionKey", () => {
		it("says nothing about a card with nothing to say", () => {
			const wall = improvement("wall", [["stone", 1], ["labour", 1], ["gate", 1]]);
			expect(progressOf(wall, {}).attentionKey).toBeNull();
			expect(progressOf(wall, {}).needsAttention).toBe(false);
		});

		it("leads with what is owed, over what merely fires now", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			const card = ImprovementProgress.from(
				mill, buildChoiceGroup(mill.titledChoices, new ChoiceValues({ mill: built })), built,
				{ isOwed: true }, autumn);
			expect(card.attentionKey).toBe("stonetop.steading.improvements.owed");
		});

		it("says what fires now over what is merely close", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			expect(cardFor(mill, built, autumn).attentionKey)
				.toBe("stonetop.steading.improvements.firesNow");
		});

		it("says how close a card is when there is nothing else to say", () => {
			const wall = improvement("wall", [["stone", 1], ["labour", 1]]);
			expect(progressOf(wall, { stone: 1 }).attentionKey)
				.toBe("stonetop.steading.improvements.nearlyDone");
		});
	});

	describe("the board's counts", () => {
		it("counts what is owed and what fires now, across the states", () => {
			const mill = seasonal("mill", { kind: "turn", seasons: ["autumn"] });
			const owed = ImprovementProgress.from(
				mill, buildChoiceGroup(mill.titledChoices, new ChoiceValues({ mill: built })), built,
				{ isOwed: true }, autumn);
			const board = new ImprovementBoard([owed, cardFor(mill, built, winter)]);
			expect([board.owedCount, board.thisSeasonCount]).toEqual([1, 1]);
		});
	});
});
