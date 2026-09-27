import { describe, it, expect } from "vitest";
import { moveRow, takeBox, pickList } from "../../scripts/development/redesign-mock/parts.js";

/**
 * The deck's only move row.
 *
 * It used to have a twin: the moves tab drew its own `row()` and the rail drew this, and the two
 * drifted into different faces, different roll affordances and two different ways of saying that a
 * move has two uses left. There is one now, and what varies between the rail, the catalogue and the
 * moves tab is which options the SURFACE passes — so these tests are about exactly that: nothing is
 * on by default, and each surface's ask produces one thing.
 */

/** A move the snapshot would hand over, reduced to the fields the row reads. */
const aMove = (over = {}) => ({
	slug: "seek-insight",
	name: "Seek Insight",
	rollsDice: true,
	rollStat: "wis",
	rollLabel: "+WIS",
	gloss: "study a situation or person",
	descriptionHtml: "<p>When you study a situation or person…</p>",
	resource: null,
	requirement: null,
	requirementMet: true,
	timesTaken: 1,
	maxTakes: 1,
	picks: [],
	markedPicks: [],
	categoryLabel: "Basic Moves",
	tiers: [],
	...over,
	// Derived as MoveView derives them, so a fixture cannot say a move is taken zero times and taken.
	get isTaken() { return this.timesTaken > 0; },
	get isRepeatable() { return this.maxTakes > 1; },
});

/** Well Versed as the stand-in carries it: taken once of three, one topic of two marked. */
const topics = [
	{ slug: "the-fae", label: "The Fae and their strange ways", marked: false },
	{ slug: "the-makers", label: "The Makers and their arts", marked: true },
];
const wellVersed = (over = {}) => aMove({
	slug: "well-versed", name: "Well Versed", rollsDice: false, rollStat: null, rollLabel: null,
	gloss: "Know Things about one of your topics",
	timesTaken: 1, maxTakes: 3,
	picks: topics, markedPicks: topics.filter(t => t.marked),
	...over,
});

describe("moveRow, by default", () => {
	const html = moveRow(aMove());

	it("draws the name, the trigger and the roll", () => {
		expect(html).toContain("Seek Insight");
		expect(html).toContain("study a situation or person");
		expect(html).toContain("+WIS");
	});

	it("offers none of the three a surface has to ask for", () => {
		expect(html).not.toContain("rd-mrow-mark");
		expect(html).not.toContain("stonetop-move-chat");
		expect(html).not.toContain("rd-req");
	});

	// The rail's reason for existing: a card is a second route to the words, never the only one.
	it("keeps its disclosure but renders no card unless hover is asked for", () => {
		expect(html).toContain("stonetop-move-disclosure");
		expect(html).not.toContain("rd-preview");
		expect(moveRow(aMove(), { hover: true })).toContain("rd-preview");
	});

	// The trigger and the track share the row's second line, because where the first line has no
	// room the track joins the trigger there rather than taking a line of its own.
	it("puts the trigger on the row's sub line, with the track", () => {
		const withTrack = moveRow(aMove({ resource: { current: 0, max: 4 } }));
		const sub = withTrack.slice(withTrack.indexOf("rd-mrow-sub"));
		expect(sub).toContain("study a situation or person");
		expect(sub).toContain("stonetop-item-resources");
	});

	it("keeps the name out of that line, so it stays on the first", () => {
		const sub = html.slice(html.indexOf("rd-mrow-sub"));
		expect(sub).not.toContain("Seek Insight");
	});
});

describe("a move that does not roll", () => {
	const html = moveRow(aMove({ rollsDice: false, rollStat: null, rollLabel: null }));

	it("gets no die and no roll control", () => {
		expect(html).not.toContain("fa-dice-d6");
		expect(html).not.toContain("move-rollable");
	});

	// The dash holds the column open, so the absence reads as an empty slot and not a missing icon.
	it("still fills the roll column", () => {
		expect(html).toContain("rd-cell--roll");
		expect(html).toContain("rd-nil");
	});
});

describe("a move that rolls plain 2d6", () => {
	// A prompt move: it rolls, and adds no stat.
	const html = moveRow(aMove({ rollLabel: null }), { hover: true });

	it("keeps its die, because it does roll", () => {
		expect(html).toContain("fa-dice-d6");
	});

	// The dash means DOES NOT ROLL, so it cannot stand for "rolls, adds nothing" as well.
	it("leaves the stat cell empty rather than putting the dash in it", () => {
		const cell = html.slice(html.indexOf("rd-cell--roll"), html.indexOf("stonetop-item-controls"));
		expect(cell).not.toContain("rd-nil");
		expect(cell).not.toContain("rd-stat");
	});

	it("tells the card it is a 2d6 roll, with no modifier after it", () => {
		expect(html).toMatch(/rd-preview-roll">2d6<\/span>/);
	});
});

describe("what the moves tab asks for", () => {
	it("takes the chat bubble the rail refuses", () => {
		expect(moveRow(aMove(), { chat: true })).toContain("stonetop-move-chat");
	});

	it("names the move in the bubble's accessible name", () => {
		expect(moveRow(aMove(), { chat: true })).toContain('aria-label="Send Seek Insight to chat"');
	});
});

describe("what choosing asks for", () => {
	const choosing = { choosing: true };

	it("gives every row one box, in a cell of its own", () => {
		for (const m of [aMove(), aMove({ timesTaken: 0 }), wellVersed()]) {
			const html = moveRow(m, choosing);
			expect(html).toContain("rd-mrow-mark");
			expect(html.match(/class="stonetop-item-check rd-take"/g)).toHaveLength(1);
		}
	});

	it("prints a requirement only when the move has one AND the surface is choosing", () => {
		const gated = aMove({ requirement: "Attuned, Level 6" });
		expect(moveRow(gated, choosing)).toContain("Requires: Attuned, Level 6");
		expect(moveRow(gated)).not.toContain("Attuned, Level 6");
		expect(moveRow(aMove(), choosing)).not.toContain("rd-req");
	});

	// Advisory, never a gate: the box stays live, and the row says so in words as well as colour.
	it("marks an unmet requirement in words, and leaves the move takeable", () => {
		const html = moveRow(aMove({ requirement: "Level 6", requirementMet: false, timesTaken: 0 }), choosing);
		expect(html).toContain("rd-req--unmet");
		expect(html).toContain("Requires: Level 6 (not met)");
		expect(html).not.toMatch(/rd-take"[^>]*disabled/);
	});

	it("does not call a met requirement unmet", () => {
		const html = moveRow(aMove({ requirement: "Level 2" }), choosing);
		expect(html).not.toContain("rd-req--unmet");
		expect(html).not.toContain("not met");
	});

	it("states how many times a repeatable move can be taken, and says nothing for the rest", () => {
		expect(moveRow(wellVersed(), choosing)).toContain("Up to 3 times");
		expect(moveRow(aMove(), choosing)).not.toContain("Up to");
	});

	// One line, not two: both are what the move asks of a choice.
	it("puts a requirement and the limit on the same line", () => {
		const html = moveRow(wellVersed({ requirement: "The Seeker, Level 2", timesTaken: 0 }), choosing);
		const line = html.slice(html.indexOf("rd-choosing-line"), html.indexOf("stonetop-move-body"));
		expect(line).toContain("Requires: The Seeker, Level 2");
		expect(line).toContain("Up to 3 times");
	});

	// The box is the first take, so there is nothing to take AGAIN before it; and at the limit there
	// is nothing left to take.
	it("offers Take again only between the first take and the limit", () => {
		expect(moveRow(wellVersed({ timesTaken: 0 }), choosing)).not.toContain("data-take-again");
		expect(moveRow(wellVersed({ timesTaken: 1 }), choosing)).toContain('data-take-again="well-versed"');
		expect(moveRow(wellVersed({ timesTaken: 2 }), choosing)).toContain("data-take-again");
		expect(moveRow(wellVersed({ timesTaken: 3 }), choosing)).not.toContain("data-take-again");
		expect(moveRow(aMove(), choosing)).not.toContain("data-take-again");
	});

	it("names the move in Take again's accessible name", () => {
		expect(moveRow(wellVersed(), choosing)).toContain('aria-label="Take Well Versed again"');
	});
});

describe("at rest", () => {
	// Being in the list says a move is taken. A box on every row says it again; a box on some rows
	// makes those rows look like a different kind of thing.
	it("draws no box, and no cell for one, on any row", () => {
		for (const m of [aMove(), wellVersed(), wellVersed({ timesTaken: 3 })]) {
			const html = moveRow(m);
			expect(html).not.toContain("rd-mrow-mark");
			expect(html).not.toContain("rd-take");
		}
	});

	it("has no choosing line", () => {
		expect(moveRow(wellVersed({ requirement: "Level 2" }))).not.toContain("rd-choosing-line");
	});
});

describe("the times-taken count", () => {
	it("follows the name once a move has been taken twice", () => {
		const html = moveRow(wellVersed({ timesTaken: 2 }));
		const cell = html.slice(html.indexOf("rd-mrow-name"), html.indexOf("rd-cell--roll"));
		expect(cell).toContain("Well Versed");
		expect(cell).toContain("×2");
	});

	// Once is what being in the list already says.
	it("is absent for a move taken once, or not at all", () => {
		expect(moveRow(wellVersed({ timesTaken: 1 }))).not.toContain("rd-times");
		expect(moveRow(wellVersed({ timesTaken: 0 }), { choosing: true })).not.toContain("rd-times");
	});

	it("is said in words to a screen reader, not as a multiplication sign", () => {
		const html = moveRow(wellVersed({ timesTaken: 3 }));
		expect(html).toMatch(/<span aria-hidden="true">×3<\/span>/);
		expect(html).toContain("taken 3 times");
	});

	it("shows while choosing too", () => {
		expect(moveRow(wellVersed({ timesTaken: 2 }), { choosing: true })).toContain("×2");
	});
});

describe("takeBox", () => {
	// □ is "taken" in the design system's mark table, and it has to be the SHEET's square rather
	// than the browser's checkbox or the two ticks mean the same thing in two different shapes.
	it("uses the sheet's own square", () => {
		expect(takeBox(aMove())).toContain("stonetop-item-check");
	});

	it("is ticked once a move has been taken, however many times", () => {
		expect(takeBox(aMove({ timesTaken: 0 }))).not.toContain(" checked");
		expect(takeBox(wellVersed({ timesTaken: 1 }))).toContain(" checked");
		expect(takeBox(wellVersed({ timesTaken: 3 }))).toContain(" checked");
	});

	it("names the move it takes", () => {
		expect(takeBox(aMove())).toContain('aria-label="Seek Insight: taken"');
		expect(takeBox(aMove())).toContain('data-take="seek-insight"');
	});
});

describe("a move with picks", () => {
	it("finishes its second line with the ones marked", () => {
		const html = moveRow(wellVersed());
		const sub = html.slice(html.indexOf("rd-mrow-sub"), html.indexOf("stonetop-move-body"));
		expect(sub).toContain("Know Things about one of your topics: ");
		expect(sub).toContain("The Makers and their arts");
		expect(sub).not.toContain("The Fae and their strange ways");
	});

	it("adds nothing to the line while none is marked", () => {
		const html = moveRow(wellVersed({ markedPicks: [] }));
		expect(html).not.toContain("rd-picked");
		expect(html).not.toContain("topics: ");
	});

	it("puts every pick in the body as a box that can be ticked", () => {
		const html = moveRow(wellVersed());
		const body = html.slice(html.indexOf("stonetop-move-body"));
		expect(body).toContain('data-pick-slug="the-fae"');
		expect(body).toMatch(/data-pick-slug="the-makers" checked/);
	});

	// A pointer-only card cannot hold a control; the body is where they are changed.
	it("shows them in the card as marks, not controls", () => {
		const card = pickList(wellVersed());
		expect(card).toContain("The Fae and their strange ways");
		expect(card).not.toContain("<input");
	});

	it("draws no list for a move with nothing to mark", () => {
		expect(pickList(aMove())).toBe("");
	});
});

describe("a move with a resource", () => {
	// Pips, not "0/2". The row reserves a column for them when it is wide enough; what matters here
	// is that the track is in the markup for the width rule to place.
	it("keeps its title, which a reserved column could never have held", () => {
		const html = moveRow(aMove({ resource: { current: 0, max: 2, title: "Skins of fine whisky" } }));
		expect(html).toContain("Skins of fine whisky");
		expect(html).toContain("stonetop-arcanum-resource-title");
	});

	it("draws one pip per use, each saying which it is and whether it is filled", () => {
		const html = moveRow(aMove({ resource: { current: 1, max: 2 } }));
		expect(html).toContain("stonetop-item-resources");
		expect(html).toContain('aria-label="Seek Insight, 1 of 2"');
		expect(html).toContain('aria-label="Seek Insight, 2 of 2"');
		expect(html.match(/is-checked/g)).toHaveLength(1);
	});

	it("reserves nothing for a move that tracks none", () => {
		expect(moveRow(aMove())).not.toContain("stonetop-item-resources");
	});
});

describe("an open row", () => {
	it("says so on the row and on every control that toggles it", () => {
		const html = moveRow(aMove(), { open: true });
		expect(html).toContain("is-expanded");
		expect(html).toContain('aria-expanded="true"');
		expect(html).not.toMatch(/id="rd-body-[^"]*" hidden>/);
	});

	it("is shut by default, with the body hidden", () => {
		expect(moveRow(aMove())).toMatch(/id="rd-body-[^"]*" hidden>/);
	});

	// The gloss stands in for the text, so it is gone while the text is there — and gone by `hidden`,
	// which the caret slides, not by a class that drops it on the first frame.
	it("hides the gloss while the text is open, and shows it while shut", () => {
		expect(moveRow(aMove(), { open: true })).toContain('<span class="stonetop-move-gloss" hidden>');
		expect(moveRow(aMove())).toContain('<span class="stonetop-move-gloss">');
	});
});
