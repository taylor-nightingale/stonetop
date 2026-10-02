import { describe, it, expect } from "vitest";
import { ImprovementResult } from "../../../../src/model/data/steading/ImprovementResult.js";

const RAIN_SUMMER = {
	when: { kind: "turn", seasons: ["summer"], phrase: "when **_summer comes_**" },
	change: { target: "surplus", amount: 1 }, outcome: "7+", text: "the steading generates 1 Surplus",
};

describe("ImprovementResult — reading", () => {
	it("reads what the sheet does about it", () => {
		expect(ImprovementResult.fromRaw({ change: { target: "fortunes", amount: 1 } }).does).toBe("change");
		expect(ImprovementResult.fromRaw({ listEntry: { list: "resources", text: "Mill" } }).does).toBe("list");
		expect(ImprovementResult.fromRaw({ set: { target: "size", value: "town" } }).does).toBe("set");
		expect(ImprovementResult.fromRaw({ advantage: { moves: ["deploy"] } }).does).toBe("advantage");
		expect(ImprovementResult.fromRaw({ grantsMove: "lead-the-aurochs-hunt" }).does).toBe("move");
		expect(ImprovementResult.fromRaw({ adjustment: { step: "consumption", amount: -1 } }).does).toBe("adjustment");
		expect(ImprovementResult.fromRaw({ text: "you are extra happy" }).does).toBe("nothing");
	});

	// The card's own split: completion is "when finished" with no clause of its own.
	it("reads which half of the card it belongs to", () => {
		expect(ImprovementResult.fromRaw({ when: { kind: "completed" } }).isCompletion).toBe(true);
		expect(ImprovementResult.fromRaw({ when: { kind: "completed" }, phrase: null }).when).toBe("completed");
		expect(ImprovementResult.fromRaw(RAIN_SUMMER).isCompletion).toBe(false);
		expect(ImprovementResult.fromRaw({ when: { kind: "completed", phrase: "when you take advantage" }, condition: true }).when).toBe("standing");
	});

	it("reads when, the roll it waits on, and the numbers", () => {
		const r = ImprovementResult.fromRaw(RAIN_SUMMER);
		expect([r.when, r.seasons, r.outcome, r.rating, r.amount]).toEqual(["turn", ["summer"], "7+", "surplus", 1]);
	});

	it("says which mechanics the editor can change and which it only keeps", () => {
		expect(ImprovementResult.fromRaw({ change: { target: "fortunes", amount: 1 } }).isMechanicEditable).toBe(true);
		expect(ImprovementResult.fromRaw({ grantsMove: "x" }).isMechanicEditable).toBe(false);
		expect(ImprovementResult.fromRaw({ adjustment: { step: "consumption" } }).isMechanicEditable).toBe(false);
	});
});

describe("ImprovementResult — new results", () => {
	it("starts a completion result finished-triggered, doing nothing, with no words", () => {
		expect(ImprovementResult.onCompletion().toRaw()).toEqual({ when: { kind: "completed" }, text: "" });
	});

	it("starts a henceforth result every season", () => {
		expect(ImprovementResult.henceforth().toRaw()).toEqual({
			when: { kind: "turn", seasons: ["spring", "summer", "autumn", "winter"] }, text: "" });
	});
});

describe("ImprovementResult — editing", () => {
	const r = () => ImprovementResult.fromRaw(RAIN_SUMMER);

	it("changes its words, keeping everything else", () => {
		expect(r().withText("more rain").toRaw()).toEqual({ ...RAIN_SUMMER, text: "more rain" });
	});

	it("switches what the sheet does, dropping the old mechanic", () => {
		const raw = r().withDoes("list").toRaw();
		expect(raw.change).toBeUndefined();
		expect(raw.listEntry).toEqual({ list: "resources", text: "" });
		expect(r().withDoes("nothing").toRaw().change).toBeUndefined();
		expect(r().withDoes("set").toRaw().set).toEqual({ target: "size", value: "hamlet" });
	});

	it("refuses to switch to a mechanic the editor cannot author", () => {
		expect(r().withDoes("move").toRaw()).toEqual(RAIN_SUMMER);
	});

	it("sets the rating, the amount, the list and the entry", () => {
		expect(r().withRating("fortunes").withAmount(-2).toRaw().change).toEqual({ target: "fortunes", amount: -2 });
		const list = r().withDoes("list").withList("fortifications").withEntry("Wall").toRaw().listEntry;
		expect(list).toEqual({ list: "fortifications", text: "Wall" });
		expect(r().withDoes("set").withSetValue("town").toRaw().set).toEqual({ target: "size", value: "town" });
	});

	it("sets which seasons, at which moment, and on what roll", () => {
		expect(r().withSeasons(["spring", "winter"]).toRaw().when.seasons).toEqual(["spring", "winter"]);
		expect(r().withWhen("moment").withMoment("autumn-harvest").toRaw().when)
			.toEqual({ kind: "moment", seasons: ["summer"], moment: "autumn-harvest", phrase: "when **_summer comes_**" });
		expect(r().withOutcome("").toRaw().outcome).toBeUndefined();
		expect(r().withOutcome("10+").toRaw().outcome).toBe("10+");
	});

	// "As long as it stands" is how the book files a result that holds from completion but is stated
	// under Henceforth by its own clause — the palisade's "when you take advantage of the palisade".
	it("makes a result hold as long as the improvement stands", () => {
		const raw = r().withWhen("standing").toRaw();
		expect(raw.when).toEqual({ kind: "completed", phrase: "when **_summer comes_**" });
		expect(raw.condition).toBe(true);
	});

	// The seasons are the result's to name, and the moment is chosen among those that happen in them.
	it("keeps its seasons when it becomes a moment, with no moment chosen yet", () => {
		expect(r().withWhen("moment").toRaw().when).toEqual({ kind: "moment", seasons: ["summer"], phrase: "when **_summer comes_**" });
	});

	it("takes another improvement's named moment with its name, and the book's by key alone", () => {
		const festival = r().withWhen("moment").withMoment("custom-moment-a", "the spring festival");
		expect(festival.toRaw().when).toMatchObject({ moment: "custom-moment-a", momentName: "the spring festival" });
		expect(festival.withMoment("autumn-harvest").toRaw().when.momentName).toBeUndefined();
	});

	it("makes a moment of its own, under a slug of its own, for its author to name", () => {
		const own = r().withWhen("moment").withNewMoment();
		expect(own.moment).toMatch(/^custom-moment-/);
		expect(own.isNamedMoment).toBe(true);
		expect(own.withMomentName("the spring festival").momentName).toBe("the spring festival");
	});

	/**
	 * The moment is typed, not picked: a name that matches a moment results already use links to it
	 * (by its slug — the name is only how it was found), and anything else is a moment of its own.
	 */
	describe("typing a moment's name", () => {
		const known = [
			{ key: "autumn-harvest", label: "The autumn harvest", name: null, shared: true },
			{ key: "custom-moment-f", label: "the festival", name: "the festival", shared: true },
		];
		const atMoment = () => r().withWhen("moment");

		it("links to a moment results already use, matching its name however it is cased", () => {
			expect(atMoment().withMomentNamed("the Autumn Harvest ", known).toRaw().when).toMatchObject({ moment: "autumn-harvest" });
			expect(atMoment().withMomentNamed("the autumn harvest", known).momentName).toBeNull();
		});

		it("links to another author's moment, keeping its name", () => {
			const festival = atMoment().withMomentNamed("the festival", known);
			expect([festival.moment, festival.momentName]).toEqual(["custom-moment-f", "the festival"]);
		});

		it("makes a moment of its own from any other name", () => {
			const own = atMoment().withMomentNamed("the spring festival", known);
			expect(own.moment).toMatch(/^custom-moment-/);
			expect(own.momentName).toBe("the spring festival");
		});

		// Renaming its own moment keeps the slug, so nothing linked to it comes loose.
		it("renames a moment of its own in place", () => {
			const own = atMoment().withMomentNamed("the spring festival", known);
			const renamed = own.withMomentNamed("the May festival", known);
			expect([renamed.moment, renamed.momentName]).toEqual([own.moment, "the May festival"]);
		});

		// Another improvement fires at it too: renaming it here would rename it under them.
		it("makes a new moment rather than rename one another improvement shares", () => {
			const linked = atMoment().withMomentNamed("the festival", known).withMomentNamed("the harvest fair", known);
			expect(linked.moment).not.toBe("custom-moment-f");
			expect(linked.momentName).toBe("the harvest fair");
		});

		it("clears the moment when its name is emptied", () => {
			expect(atMoment().withMomentNamed("the festival", known).withMomentNamed("  ", known).moment).toBeNull();
		});
	});

	it("names only a moment it made up", () => {
		expect(r().withWhen("moment").withMoment("autumn-harvest").withMomentName("x").momentName).toBeNull();
	});

	// The bug: chosen on a result with no words yet, "as long as it stands" read back as plain
	// completion — the result jumped to the other half and lost every choice of when.
	it("stays a result that holds as long as the improvement stands before it has any words", () => {
		const standing = ImprovementResult.henceforth().withWhen("standing");
		expect([standing.when, standing.isCompletion]).toEqual(["standing", false]);
		expect(standing.withWhen("turn").when).toBe("turn");
		expect(standing.withWhen("turn").toRaw().condition).toBeUndefined();
	});

	it("sets the words of the clause that says when", () => {
		expect(r().withPhrase("when rain falls").toRaw().when.phrase).toBe("when rain falls");
	});
});
