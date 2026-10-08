import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";

// Why a homefront move might not roll a flat 2d6: advantage a built improvement permits, or a debility
// hindering it. Said in the roll prompt, where the mode is chosen, and nowhere on the row: the prompt is
// where it can be acted on. A REMINDER — the mode stays the table's to pick — so it carries no control.
//
// It has to READ as a reminder, which is the part three earlier attempts failed. A line phrased in the
// row's own voice ("Advantage", "Township gives advantage") gets read as a fact: that advantage is
// already on. So the line says what CAN be applied and names the improvement that permits it.

const notes = (...list) => new RollModeNotes(list);
const adv = (source, clause = null) => new RollModeNote({ mode: "adv", source, clause });
const dis = source => new RollModeNote({ mode: "dis", source, enforced: true });

const render = rollNotes => renderPartial("stonetop.roll-notes", rollNotes);

const lines = html => html.match(/class="stonetop-move-rollnote"/g) ?? [];

describe("the roll reminder", () => {
	// A list of prose takes the book's swirl. `stonetop-unmarked` is the opt-out, and opting out killed
	// the gutter the swirl is positioned into — which put the marker in the caret's column, clipped.
	it("takes the book's bullet rather than opting out of it", () => {
		expect(render(notes(adv("Township")))).toContain('class="stonetop-move-rollnotes"');
		expect(render(notes(adv("Township")))).not.toContain("stonetop-move-rollnotes stonetop-unmarked");
	});

	// "can be applied", not "Advantage". The offer is the point; a bare mode label was read as the mode
	// the row is already in. Asserted on the COPY, not the key — a localize carrying hash args formats
	// through en.json, here and in play, so this is the sentence the prompt shows.
	it("states advantage as something that can be applied, naming its source", () => {
		const html = render(notes(adv("Township")));
		expect(html).toContain("Township");
		expect(html).toContain("can be applied");
	});

	// Not symmetrical, because the rules are not: SteadingRolls really does flip the die for a debility,
	// so "can be applied" would be the one untrue thing in the prompt.
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

	it("states an entitlement and a hindrance in the same prompt", () => {
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

});
