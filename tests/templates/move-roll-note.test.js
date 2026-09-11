import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";

// Why a homefront move might not roll a flat 2d6: advantage a built improvement permits, or a debility
// hindering it. A REMINDER — the roll-mode control is the table's and nothing here touches it — so the
// row carries no control for it.
//
// It has to READ as a reminder, which is the part three earlier attempts failed. A line phrased in the
// row's own voice ("Advantage", "Township gives advantage") sits beside the name and the gloss, which
// are facts about the move, and gets read as one more fact: that advantage is already on. So the line
// says what CAN be applied and names the improvement that permits it.

const MOVE = (rollNotes = null) => ({
	slug: "trade-barter", name: "Trade & Barter", ownedId: "abc", rollStat: "prosperity",
	description: "When you **_trade with a neighbour_**, roll +Prosperity.",
	gloss: "trade with a neighbour", selection: { value: 1, max: 1 }, rollNotes,
});

const notes = (...list) => new RollModeNotes(list);
const adv = (source, clause = null) => new RollModeNote({ mode: "adv", source, clause });
const dis = source => new RollModeNote({ mode: "dis", source, enforced: true });

const render = (rollNotes, params = {}) =>
	renderPartial("stonetop.move-item", {
		...MOVE(rollNotes), sheetIdPrefix: "sheet-1", disclosure: true, ...params,
	});

const lines = html => html.match(/class="stonetop-move-rollnote"/g) ?? [];

describe("the roll reminder on a move row", () => {
	it("renders nothing at all for a move nothing speaks for", () => {
		expect(render(null)).not.toContain("stonetop-move-rollnote");
	});

	// A list of prose takes the book's swirl. `stonetop-unmarked` is the opt-out, and opting out killed
	// the gutter the swirl is positioned into — which put the marker in the caret's column, clipped.
	it("takes the book's bullet rather than opting out of it", () => {
		expect(render(notes(adv("Township")))).toContain('class="stonetop-move-rollnotes"');
		expect(render(notes(adv("Township")))).not.toContain("stonetop-move-rollnotes stonetop-unmarked");
	});

	// "can be applied", not "Advantage". The offer is the point; a bare mode label was read as the mode
	// the row is already in. Asserted on the COPY, not the key — a localize carrying hash args formats
	// through en.json, here and in play, so this is the sentence the row shows.
	it("states advantage as something that can be applied, naming its source", () => {
		const html = render(notes(adv("Township")));
		expect(html).toContain("Township");
		expect(html).toContain("can be applied");
	});

	// Not symmetrical, because the rules are not: SteadingRolls really does flip the die for a debility,
	// so "can be applied" would be the one untrue thing on the row.
	it("states an enforced hindrance as already applying", () => {
		const html = render(notes(dis("diminished")));
		expect(html).toContain("diminished");
		expect(html).toContain("applies");
		expect(html).not.toContain("can be applied");
	});

	// In the BOOK'S words, which is the same clause the improvement's own card states — the sheet
	// used to paraphrase it into an "only if …" tail, so the one fiction was authored twice.
	it("carries the fiction a conditional entitlement waits on", () => {
		const html = render(notes(adv("Stone Wall", "when **_you take advantage of the stone wall_**")));
		expect(html).toContain("stonetop-move-rollnote-clause");
		expect(html).toContain("you take advantage of the stone wall");
		expect(html).not.toContain("only if");
	});

	// One line per SOURCE. Collapsing them is what produced a badge, and a badge cannot name the thing
	// that permits it — which is exactly what stops the line reading as a state.
	it("gives every source its own line", () => {
		const html = render(notes(
			adv("Township"),
			adv("Trade with Barrier Pass", "when **_you Trade & Barter for timber_**"),
			adv("Aetherium Crucible", "when **_you Trade & Barter for aetherium_**"),
		));
		expect(lines(html).length).toBe(3);
		for (const source of ["Township", "Trade with Barrier Pass", "Aetherium Crucible"]) {
			expect(html).toContain(source);
		}
	});

	it("states an entitlement and a hindrance on the same row", () => {
		const html = render(notes(adv("Stone Wall", "you use the wall"), dis("diminished")));
		expect(lines(html).length).toBe(2);
		expect(html).toContain("Stone Wall — stonetop.rollMode.adv can be applied");
		expect(html).toContain("diminished — stonetop.rollMode.dis applies");
	});

	// The reminder is information, not a control: the mode stays the table's to pick.
	it("offers no control for it", () => {
		const html = render(notes(adv("Township")));
		expect(html).not.toMatch(/stonetop-move-rollnote[^>]*data-action/);
		expect(html).not.toMatch(/<button[^>]*stonetop-move-rollnote/);
	});

	// Stated once, in one place. It used to be a badge on the shut row AND a list in the body, which is
	// the same fact twice in two registers an inch apart.
	it("states the reminder once, whether the row is shut or open", () => {
		expect(lines(render(notes(adv("Township")))).length).toBe(1);
		expect(lines(render(notes(adv("Township")), { disclosure: false })).length).toBe(1);
	});
});
