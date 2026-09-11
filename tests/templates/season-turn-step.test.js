import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";
import { SeasonalPicks, WinterLosses } from "../../src/model/data/steading/SeasonalPicks.js";
import { StepAdjustment } from "../../src/model/data/steading/ImprovementEffect.js";
import { buildSeasonSteps } from "../../src/model/snapshot/steading/SeasonStepSnapshot.js";
import { buildChoiceGroup } from "../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../src/model/snapshot/character/ChoiceGroup.js";
import { rich } from "../../src/model/snapshot/RichText.js";
import { AppliedStepRoll } from "../../src/model/data/steading/AppliedStepRoll.js";

// The numbered list used to gloss each step with a generic label — "Roll it", "Roll 1d4", "Pick 1
// from what winter takes" — which drops the trigger ("when winter grips the land"), the roller
// ("whoever is the weariest") and winter's Meet with Disaster clause. The step now says what the
// move says, and the label key is only the fallback.

// Rendered through the enclosing box rather than the step partial alone: the step partial reads
// `@root.editable` and `@root.stonetop.seasons`, and Handlebars makes the top-level context the root
// — so a step rendered standalone is its own root and every edit-gated control silently vanishes.
const renderStep = (raw, { editable = true, pick = null, statement = null, applied = {}, moveResults = null,
                           outcome = null } = {}) => {
	const built = buildSeasonSteps({
		procedure: SeasonProcedure.from({ steps: [raw], moveResults }), statement, applied, pick, outcome,
	});
	const seasons = {
		moves:       { key: "seasons" },
		currentMove: { slug: "seasons-change-winter", name: "Seasons Change: Winter", ownedId: "owned-winter" },
		steps:       built.steps,
		adjustments: built.adjustments,
		pick,
		turnover: {
			season: { key: "winter", labelKey: "winter" },
			next:   { key: "spring", labelKey: "spring" },
			year:   3,
			statement,
		},
	};
	return renderPartial("stonetop.steading-season-box",
		{ editable, sheetIdPrefix: "sheet-1", stonetop: { fortunesReset: 1, seasons }, seasons });
};

// A statement line as the step partial reads one: the improvement that causes it, the book's words,
// and the bend itself. Not a full TurnoverLine — the partial asks a line three questions.
const bends = (source, raw, { phrase = null } = {}) =>
	({ source, text: rich(`${source} bends it`), phrase: phrase ? rich(phrase) : null,
	  adjustment: StepAdjustment.fromRaw(raw) });

// A clause waiting on the move's own roll — "7+", which is the 10+ row and the 7-9 row both.
const waitsOnTheRoll = source => ({ source, text: rich("the steading generates 1 Surplus"),
	phrase: rich("when **_winter grips the land and you roll a 7+ with Fortunes_**"),
	firesOnTier: key => ["success", "partial"].includes(key) });

describe("a step's line", () => {
	it("renders the move's own words", () => {
		const html = renderStep({ kind: "roll", die: "1d4", stat: "population",
			text: "When **_winter grips the land_**, whoever is weariest rolls 1d4+Population." });
		expect(html).toContain("whoever is weariest");
		expect(html).toContain("winter grips the land");
	});

	// A homebrew Seasons Change carries no authored text; a numbered row with no line at all is worse
	// than a generic one.
	it("falls back to the label key when the move gave it no words", () => {
		const html = renderStep({ kind: "consume" });
		expect(html).toContain("The steading consumes that much Surplus");
	});

	// Both at once would be the duplication that authoring the text was supposed to avoid.
	it("does not print the generic label beside the move's words", () => {
		const html = renderStep({ kind: "consume", text: "The steading consumes that much Surplus. If there's not enough, reduce Surplus to 0 and Meet with Disaster." });
		expect(html).toContain("Meet with Disaster");
		expect(html).not.toContain("steading-turn-label");
	});
});

describe("a step's control", () => {
	// The control names the roll it makes. "Roll Seasons Change: Summer" restated the move's name
	// directly under a line that had just said whose roll it is and when.
	// Two controls, two different acts, and neither turns the wheel. The move's own roll posts the
	// 2d6+Fortunes card with its tiers and leaves the season where it stands; the step's own dice
	// move Surplus. Turning is the advance control below the box, and it rolls nothing at all.
	it("rolls the move itself as a normal move roll, without turning the wheel", () => {
		const html = renderStep({ kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes." });
		const steps = html.slice(html.indexOf("steading-turn-steps"), html.indexOf("steading-during-owed"));
		expect(steps).toContain('data-move-slug="seasons-change-winter"');
		expect(steps).toContain('data-roll="fortunes"');
		expect(steps).toContain("rollable move-rollable");
		expect(steps).not.toContain('data-action="turnSeason"');
	});

	// Shortened but not stripped: the step's line is the book's "+1", and a malcontent steading resets
	// to +0 — this control is the only thing on the tab that knows the difference.
	it("shortens the reset control but keeps the value it will set", () => {
		expect(renderStep({ kind: "reset", text: "Whatever the result, reset Fortunes to +1." }))
			.toContain("Reset to +1");
		expect(renderStep({ kind: "reset" })).toContain("Reset Fortunes to +1");
	});

	// The button carries its ADDRESS and nothing else. Its dice, its rating, which way it moves
	// Surplus and what this steading's improvements do to all three are answered by the step, so a
	// control showing 2d6+Population cannot describe one roll while the handler makes another.
	it("addresses the step by its position, and carries no formula of its own", () => {
		const html = renderStep({ kind: "roll", die: "1d4", stat: "population", text: "words",
			affects: "consumption" });
		expect(html).toContain('data-action="rollSeasonStep"');
		expect(html).toContain('data-step="0"');
		expect(html).not.toContain("data-die=");
		expect(html).not.toContain("data-affects=");
	});
});

// Winter's 7-9 and 6- consume another 1d4+Population, which the step used to state in the middle of
// a sentence holding all three tiers — with no control, no record and no way to undo it, beside an
// opening consumption that had all three.
describe("the results of the move's own roll", () => {
	const WINTER_RESULTS = {
		success: { label: "10+", value: "The winter is relatively mild." },
		partial: { label: "7-9", value: "The steading must consume additional Surplus equal to 1d4+Population." },
		failure: { label: "6-",  value: "As a 7-9, but also threats abound (and don't mark XP)." },
	};

	const winterRoll = (options = {}) => renderStep({
		kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes.",
		results: {
			partial: { die: "1d4", stat: "population", affects: "consumption" },
			failure: { die: "1d4", stat: "population", affects: "consumption" },
		},
	}, { moveResults: WINTER_RESULTS, ...options });

	// The rendered rows, keyed by tier — a clause is filed under a ROW now, so a test that only asked
	// whether the page contains it would pass wherever it landed.
	const tierRows = (html) => {
		const parts = html.split('class="stonetop-result-row stonetop-result-row--');
		// The class can carry the lit-row marker after the tier ("partial is-rolled"), so the key is
		// the first word of it and the marker stays inside the part the assertions read.
		return Object.fromEntries(parts.slice(1)
			.map(part => [part.slice(0, part.indexOf('"')).split(" ")[0], part]));
	};

	// Three rows, each headed by the move's own notation, rather than one clause the reader has to
	// find their result inside.
	it("draws each result as its own row, labelled as the move labels it", () => {
		const html = winterRoll();
		expect(html).toContain("steading-turn-tiers");
		for (const [key, tier] of Object.entries(WINTER_RESULTS)) {
			expect(html).toContain(`stonetop-result-row--${key}`);
			expect(html).toContain(`>${tier.label}<`);
			expect(html).toContain(tier.value);
		}
	});

	// The rows are a reading of the DICE, not a reprint of the move: the table rolled one of these
	// three and the sheet says which, so nobody has to remember a total to use the box.
	it("lights the result the roll landed on", () => {
		const rows = tierRows(winterRoll({ outcome: "partial" }));
		expect(rows.partial).toContain("is-rolled");
		expect(rows.success).not.toContain("is-rolled");
		expect(rows.failure).not.toContain("is-rolled");
	});

	// Colour is not a thing every reader gets, and a screen reader gets none of it: the lit row says
	// so in words and answers "which one am I on?" to anything that asks the page.
	it("says which row was rolled in words, not only in colour", () => {
		const rows = tierRows(winterRoll({ outcome: "failure" }));
		expect(rows.failure).toContain('aria-current="true"');
		expect(rows.failure).toContain("stonetop-result-rolled");
		expect(rows.partial).not.toContain('aria-current="true"');
	});

	// Before anybody rolls, all three read alike — a season nobody has rolled has no result to be
	// living with, and lighting one would be the sheet inventing a roll.
	it("lights nothing until the move is rolled", () => {
		expect(winterRoll()).not.toContain("is-rolled");
	});

	// The row that costs the steading a roll gets the same control a step's own dice get, addressed
	// by the tier so it records and undoes on its own.
	it("gives the tier that costs a roll its own control", () => {
		const html = winterRoll();
		expect(html).toContain('data-action="rollSeasonStep" data-step="0:partial"');
		expect(html).toContain('data-action="rollSeasonStep" data-step="0:failure"');
		expect(html).not.toContain('data-step="0:success"');
	});

	/**
	 * Harnessing the Stream and Raincatching wait on the season's OWN roll. They used to float above
	 * these rows with their qualifier on a second line — beside the roll rather than in it, with
	 * nothing saying which result they meant.
	 */
	describe("what the steading has built that waits on one", () => {
		const withStream = () => winterRoll({ statement: { outcomeGated: [waitsOnTheRoll("Harnessing the Stream")] } });

		it("states it inside every row its range covers", () => {
			const rows = tierRows(withStream());
			expect(rows.success).toContain("Harnessing the Stream");
			expect(rows.partial).toContain("Harnessing the Stream");
			expect(rows.failure).not.toContain("Harnessing the Stream");
		});

		// The row IS the trigger, so it does not print the clause: "when you roll a 7+ with Fortunes"
		// inside the 10+ row says it twice. The clause is on the line either way — this surface simply
		// does not ask for it (see the statement partial's `showPhrase`).
		it("drops the clause the row has just made", () => {
			expect(withStream()).not.toContain("you roll a 7+ with Fortunes");
		});

		it("says nothing on a roll nothing waits on", () => {
			expect(winterRoll()).not.toContain("steading-turn-outcomes");
		});
	});

	// A mild winter costs nothing, and neither does any result of the other three seasons: a control
	// there would offer to spend Surplus the move never asks for.
	it("leaves a result that costs nothing as words", () => {
		const html = renderStep({ kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes." },
			{ moveResults: WINTER_RESULTS });
		expect(html).toContain("The winter is relatively mild");
		expect(html).not.toContain('data-action="rollSeasonStep"');
	});

	// Rolling MOVES Surplus, so the row then says what it did and offers to give it back rather than
	// offering the roll again.
	it("says what a rolled result did, and offers to give it back", () => {
		const html = winterRoll({ applied: { "0:partial": new AppliedStepRoll({ total: 4, from: 6, to: 2 }) } });
		expect(html).toContain("Consumed 4 Surplus");
		expect(html).toContain('data-action="revertSeasonStep" data-step="0:partial"');
		// The other results are still to roll, and say so.
		expect(html).toContain('data-action="rollSeasonStep" data-step="0:failure"');
	});

	// The words are the move's, and they are all a reader gets without the right to write: both
	// controls move Surplus.
	it("offers no control on a sheet that cannot be edited", () => {
		const html = winterRoll({ editable: false });
		expect(html).toContain("consume additional Surplus");
		expect(html).not.toContain("rollSeasonStep");
	});

	// A move that carries no results — every move in the system but these four, and any homebrew
	// Seasons Change — draws no rows at all rather than three blank ones.
	it("draws no rows for a move that authored none", () => {
		expect(renderStep({ kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes." }))
			.not.toContain("steading-turn-tiers");
	});
});

// The third of the user's complaints: the tab "isn't content aware of improvements that modify it".
// Five improvements bend winter's consumption and every one of them used to sit in one list headed
// "when the steading consumes Surplus", nowhere near the step that consumes.
describe("a step the steading's improvements bend", () => {
	const winterRoll = { kind: "roll", die: "1d4", stat: "population", affects: "consumption",
		text: "When winter grips the land, whoever is weariest rolls 1d4+Population." };

	// Each in the book's own sentence, under the step it bends, attributed to the improvement that
	// causes it. The sheet does not narrate its own summary of them: a first attempt printed "Rolls
	// 2d6 + Population, counted −1 — Additional Housing, Township", which stacked a second formula
	// under the move's own and said neither which improvement did which nor what was counted −1.
	it("states each bend in its own words, with the improvement that causes it", () => {
		const html = renderStep(winterRoll, { statement: { adjustments: [
			bends("Township", { step: "consumption", at: "formula", die: "2d6", stat: "population" }),
			bends("Additional Housing", { step: "consumption", at: "term", term: "population", amount: -1 }),
			bends("Stone Wall", { step: "consumption", at: "result", amount: -1 }),
		] } });
		const step = html.slice(html.indexOf("steading-turn-step"), html.indexOf("steading-during-owed"));
		for (const name of ["Township", "Additional Housing", "Stone Wall"]) {
			expect(step).toContain(`>${name}<`);
			expect(step).toContain(`${name} bends it`);
		}
		expect(step).not.toContain("steading-turn-adjusted");
	});

	// They are a list of clauses under a line of prose, which is what the book's swirl marks. The
	// statement's own rows are a table with controls in it and take no bullet.
	it("marks them as a list", () => {
		const html = renderStep(winterRoll, { statement: { adjustments: [
			bends("Stone Wall", { step: "consumption", at: "result", amount: -1 }),
		] } });
		expect(html).toContain("steading-effect-lines");
		expect(html).not.toContain("steading-effect-lines steading-statement-lines steading-statement-lines--sourced stonetop-unmarked");
	});

	// What the sheet MADE of them is on the control, which rolls the dice it names — Township's 2d6
	// where the move's own line says 1d4.
	it("puts the dice it will actually roll on the control", () => {
		const html = renderStep(winterRoll, { statement: { adjustments: [
			bends("Township", { step: "consumption", at: "formula", die: "2d6", stat: "population" }),
		] } });
		expect(html).toContain("Roll 2d6 + stonetop.steading.attr.population");
	});

	// And says only "Roll" where nothing bent it: the line above has just given the formula.
	it("stays a verb where nothing bent the roll", () => {
		const html = renderStep(winterRoll);
		const step = html.slice(html.indexOf("steading-turn-step"), html.indexOf("steading-during-owed"));
		expect(step).toContain("stonetop.steading.seasons.steps.rollShort");
		expect(step).not.toContain("Roll 1d4");
	});

	// "in winter, as long as the camp is in operation" — the book's own clause, which is the one
	// place the qualifier is stated: it opens the row's sentence, and what the sheet cannot
	// evaluate is never folded into what the control writes.
	it("keeps a conditional reduction's clause with it", () => {
		const html = renderStep(winterRoll, { statement: { adjustments: [
			bends("Permanent Logging Camp", { step: "consumption", at: "result", amount: -1 },
				{ phrase: "**_in winter, as long as the camp is in operation_**" }),
		] } });
		expect(html).toContain("as long as the camp is in operation");
	});

	// A step nothing bends says nothing about bends.
	it("says nothing where nothing bends it", () => {
		expect(renderStep(winterRoll)).not.toContain("steading-turn-results");
	});
});

// The user's complaint, in their words: "'pick 1 from what winter takes' is the wrong place to say
// that", and "the picking of the content should be inline in the seasons change box". The step used
// to render a note pointing at a block further down the tab — naming the wrong place for the one
// thing the step is about.
describe("a pick step", () => {
	const group = buildChoiceGroup(SeasonalPicks.byKey("winter-losses").toChoiceGroupData(1), new ChoiceValues());

	it("renders the choice inside the step that calls for it", () => {
		const html = renderStep({ kind: "pick", from: "winter-losses", count: 1, text: "Then, pick 1:" },
			{ pick: { step: null, group, labelKey: null, count: 1 } });
		const step = html.slice(html.indexOf("steading-turn-step"), html.indexOf("steading-during-owed"));
		expect(step).toContain("steading-turn-pick");
		expect(step).toContain("stonetop-choice-entry");
		for (const loss of WinterLosses.all()) expect(step).toContain(loss.name);
	});

	it("no longer points at a block somewhere else", () => {
		const html = renderStep({ kind: "pick", from: "winter-losses", count: 1, text: "Then, pick 1:" },
			{ pick: { step: null, group, labelKey: null, count: 1 } });
		expect(html).not.toContain("stays in force all season");
	});

	// Winter offers losses and the other three offer gains, but a season whose move hands the table
	// nothing has no group to render — and an empty picker under "pick 1" would read as a bug.
	it("draws nothing where the season hands the table no choice", () => {
		const html = renderStep({ kind: "pick", from: "winter-losses", count: 1, text: "Then, pick 1:" });
		expect(html).toContain("Then, pick 1:");
		expect(html).not.toContain("steading-turn-pick");
	});
});
