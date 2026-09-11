import { describe, it, expect } from "vitest";
import { ImprovementPayoff } from "../../../../src/model/snapshot/steading/ImprovementPayoff.js";
import { AppliedEffect } from "../../../../src/model/data/steading/AppliedEffect.js";
import { SteadingImprovement } from "../../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { TurnoverLine } from "../../../../src/model/snapshot/steading/TurnoverStatement.js";

/**
 * The book writes every improvement's payoff as two sentences — "When you meet the requirements, …
 * Henceforth, …" — and `system.effects` carries that split as `trigger.isCompletion`. This is that
 * split as the card renders it.
 *
 * It renders whether or not the improvement is finished, because the prose that used to state the
 * payoff has been stripped out of the pack: this is the only place it is said now.
 */
const MILL = new SteadingImprovement("mill", "Mill", {
	slug: "mill",
	list: [{ type: "entry", slug: "site", content: { text: "a site" }, track: { max: 1 } }],
}, 0, {
	requires: "site",
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
		{ when: { kind: "completed" }, text: "draw it on the map" },
		{ when: { kind: "moment", moment: "autumn-harvest" }, change: { target: "surplus", amount: 1 },
		  text: "the steading generates +1 Surplus" },
	],
});

// Two clauses that carry the book's own trigger words: one that fires with the season, and one the
// pack stores as completion-triggered because it holds for as long as the palisade stands.
const RAINCATCHING = new SteadingImprovement("raincatching", "Raincatching", {
	slug: "raincatching",
	list: [{ type: "entry", slug: "roofs", content: { text: "roofs" }, track: { max: 1 } }],
}, 0, {
	requires: "roofs",
	effects: [
		{ when: { kind: "turn", seasons: ["summer"], phrase: "when **_summer comes and you roll a 7+ with Fortunes_**" },
		  change: { target: "surplus", amount: 1 }, condition: true, outcome: "7+",
		  text: "the steading generates 1 Surplus" },
	],
});
const PALISADE = new SteadingImprovement("palisade", "Palisade", {
	slug: "palisade",
	list: [{ type: "entry", slug: "timber", content: { text: "timber" }, track: { max: 1 } }],
}, 0, {
	requires: "timber",
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
		{ when: { kind: "completed", phrase: "when **_you take advantage of the palisade_**" },
		  condition: true, text: "you have advantage to Deploy" },
	],
});

// A requirement is asked whether it is met by a RequirementBoxes, which the improvement builds from
// this steading's ticks — never by a bare object of them.
const BUILT   = MILL.boxesFrom({ site: 1 });
const UNBUILT = MILL.boxesFrom({});

describe("ImprovementPayoff", () => {
	describe("splitting the two halves", () => {
		it("puts completion results in one half and everything else in the other", () => {
			const payoff = ImprovementPayoff.from(MILL, { boxes: BUILT });
			expect(payoff.completion.lines.map(l => l.text.raw))
				.toEqual(["increase Fortunes by 1", "draw it on the map"]);
			expect(payoff.henceforth.lines.map(l => l.text.raw))
				.toEqual(["the steading generates +1 Surplus"]);
		});

		/**
		 * The palisade's "when you take advantage of the palisade" holds from the moment the palisade
		 * stands, so it is stored as completion-triggered — but the book prints it under Henceforth,
		 * and under "When you meet the requirements:" it reads as a second "when" inside the first.
		 */
		it("files a completion result that states its own trigger under Henceforth", () => {
			const payoff = ImprovementPayoff.from(PALISADE, { boxes: PALISADE.boxesFrom({ timber: 1 }) });
			expect(payoff.completion.lines.map(l => l.text.raw)).toEqual(["increase Fortunes by 1"]);
			expect(payoff.henceforth.lines.map(l => l.text.raw)).toEqual(["you have advantage to Deploy"]);
		});

		it("says when it has nothing to show", () => {
			const bare = new SteadingImprovement("bare", "Bare", { slug: "bare", list: [] }, 0, {});
			expect(ImprovementPayoff.forCatalog(bare).isEmpty).toBe(true);
			expect(ImprovementPayoff.from(MILL).isEmpty).toBe(false);
		});
	});

	/**
	 * The Henceforth half is ALWAYS stated. Seven results across the pack fire at a turn or a moment
	 * and are plain arithmetic the sheet could perform — but the season's own panel is where the table
	 * performs them, and a control here would pay them early and then again in the season that owns
	 * them.
	 */
	it("never offers to apply the Henceforth half, even when built", () => {
		const { henceforth } = ImprovementPayoff.from(MILL, { boxes: BUILT });
		expect(henceforth.lines[0].isAutomatic).toBe(true);
		expect(henceforth.automatic).toEqual([]);
		expect(henceforth.willChangeAnything).toBe(false);
	});

	describe("what an unfinished improvement says", () => {
		// The promise, with no control: the prose that used to make it is gone from the pack.
		it("states the completion results, unearned", () => {
			const payoff = ImprovementPayoff.from(MILL, { boxes: UNBUILT });
			expect(payoff.completion.lines).toHaveLength(2);
			expect(payoff.completion.lines.every(l => l.earned)).toBe(false);
			expect(payoff.completion.automatic).toEqual([]);
			expect(payoff.isOwed).toBe(false);
		});

		it("states the Henceforth results too", () => {
			expect(ImprovementPayoff.from(MILL, { boxes: UNBUILT }).henceforth.lines).toHaveLength(1);
		});
	});

	describe("owed, and taken", () => {
		it("is owed once the requirements hold and nothing has been applied", () => {
			const payoff = ImprovementPayoff.from(MILL, { boxes: BUILT });
			expect(payoff.isOwed).toBe(true);
			expect(payoff.isTaken).toBe(false);
		});

		it("is taken once every writable line has been written", () => {
			const payoff = ImprovementPayoff.from(MILL, {
				boxes: BUILT,
				recordFor: (_e, id) => (id === "mill:0" ? new AppliedEffect({ change: { target: "fortunes", amount: 1 } }) : null),
			});
			expect(payoff.isOwed).toBe(false);
			expect(payoff.isTaken).toBe(true);
		});

		/**
		 * An improvement whose completion is pure fiction — Township changing Size, Roadbuilding
		 * letting you build roads — owes nothing the sheet can write. A card claiming otherwise would
		 * be asking for a click that does nothing, which is what the old checkboxes did.
		 */
		it("is never owed for a completion that is all fiction", () => {
			const township = new SteadingImprovement("township", "Township", {
				slug: "township",
				list: [{ type: "entry", slug: "folk", content: { text: "folk" }, track: { max: 1 } }],
			}, 0, { requires: "folk", effects: [{ when: { kind: "completed" }, text: "change Size to town" }] });

			const payoff = ImprovementPayoff.from(township, { boxes: township.boxesFrom({ folk: 1 }) });
			expect(payoff.hasCompletion).toBe(true);
			expect(payoff.isOwed).toBe(false);
			expect(payoff.isTaken).toBe(false);
		});
	});

	/**
	 * The catalog — the improvement item's own sheet — knows no steading. Nothing is ticked, nothing
	 * is applied, and nothing is applicable, because there is nothing to write to. A control there
	 * would carry an action that sheet does not define, and pressing it would do nothing at all.
	 */
	describe("as the catalog states it", () => {
		const catalog = ImprovementPayoff.forCatalog(MILL);

		it("states both halves in full", () => {
			expect(catalog.completion.lines).toHaveLength(2);
			expect(catalog.henceforth.lines).toHaveLength(1);
		});

		it("offers no control on either half", () => {
			expect(catalog.completion.automatic).toEqual([]);
			expect(catalog.henceforth.automatic).toEqual([]);
			expect(catalog.isOwed).toBe(false);
			expect(catalog.completion.totals).toEqual([]);
		});
	});

	/**
	 * The card is the one surface not inside a season, so it reads each clause as the sentence the
	 * book prints — "when ***summer comes and you roll a 7+ with Fortunes***, the steading generates
	 * 1 Surplus" — rather than as a fragment under a heading and a timing chip.
	 *
	 * The clause is on the LINE wherever it is built; whether it is printed is the surface's
	 * question. It was once a paraphrase as well — a second "only if …" copy of the same fiction,
	 * in the sheet's voice — and that is what `condition` used to carry.
	 */
	describe("the book's own sentence", () => {
		const line = () => ImprovementPayoff.forCatalog(RAINCATCHING).henceforth.lines[0];

		it("carries the trigger clause beside the result", () => {
			expect(line().phrase.raw).toBe("when **_summer comes and you roll a 7+ with Fortunes_**");
			expect(line().text.raw).toBe("the steading generates 1 Surplus");
		});

		it("withholds the chip the clause has just said", () => {
			expect(line().timingKeys).toEqual([]);
		});

		// Every {{rich}} value has to be an own property: enrichRichTextTree walks own enumerable keys,
		// and a getter is invisible to it — the clause would render its @UUIDs and rolls as source.
		it("holds the clause where the enrich pass can reach it", () => {
			expect(Object.keys(line())).toContain("phrase");
		});

		// Carried on every line, printed by the surfaces that have not already stated the trigger —
		// see the statement partial's `showPhrase`. The line says the fiction it waits on ONCE, in
		// the book's words, and says separately that it is one the sheet cannot judge.
		it("carries the clause wherever the line is built, and the qualifier only there", () => {
			const inSeason = new TurnoverLine({
				id: "raincatching:0", source: "Raincatching",
				effect: RAINCATCHING.effects.all()[0],
			});
			expect(inSeason.phrase.raw).toBe("when **_summer comes and you roll a 7+ with Fortunes_**");
			expect(inSeason.isConditional).toBe(true);
			expect(inSeason.timingKeys).toEqual([]);
		});
	});

	// The card says before → after off the steading's own ratings, not off zero.
	it("counts the totals against the ratings it was given", () => {
		const payoff = ImprovementPayoff.from(MILL, { boxes: BUILT, ratings: { fortunes: 4 } });
		expect(payoff.completion.totals).toEqual([expect.objectContaining({ target: "fortunes", from: 4, to: 5 })]);
	});
});
