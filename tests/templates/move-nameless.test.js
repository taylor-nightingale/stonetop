import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";

// Some moves are printed with no name at all: an arcanum's front trigger ("When you consult the
// Mindgem …"), the Would-Be Hero's Destined. They still HAVE a name — a slug to be granted by, a chat
// card, an accessible name for the die — but drawing it as a heading puts a title on the card that the
// book never printed, and repeats the group label the move already sits under.

const MOVE = (nameless) => ({
	slug: "consult-mindgem-about", name: "Consult the Mindgem about the Makers", nameless,
	ownedId: "abc", rollStat: "int",
	description: "When you **_consult the Mindgem_**, ask a question and roll +INT.",
	gloss: "consult the Mindgem", selection: { value: 1, max: 1 },
});

const render = (nameless, params = {}) =>
	renderPartial("stonetop.move-item", { ...MOVE(nameless), sheetIdPrefix: "sheet-1", ...params });

const renderRow = (nameless, params = {}) =>
	renderPartial("stonetop.move-row", { ...MOVE(nameless), sheetIdPrefix: "sheet-1", ...params });

describe("a move the book prints with no name", () => {
	it("draws no name button — the row is the move's own words", () => {
		const html = render(true);
		expect(html).not.toContain("stonetop-item-name");
		expect(html).toContain("consult the Mindgem");
	});

	it("still says its name where the reader needs one: the die's label", () => {
		// Hiding the heading must not leave a control announced as nothing at all.
		expect(render(true)).toContain("Consult the Mindgem about the Makers");
	});

	it("keeps the same controls a named move has", () => {
		const html = render(true);
		expect(html).toContain('data-action="moveToChat"');
		expect(html).toContain('class="rollable move-rollable"');
	});

	it("draws the name for an ordinary move", () => {
		const html = render(false);
		expect(html).toContain("stonetop-item-name");
		expect(html).toContain("Consult the Mindgem about the Makers");
	});

	// On a disclosure row the name IS the control that opens the text, so there is nothing to collapse
	// behind if it goes. Those rows are the moves tab's; an inline grant never asks for one.
	it("keeps the disclosure button, which would otherwise have no label", () => {
		const html = render(true, { disclosure: true });
		expect(html).toContain("stonetop-move-disclosure");
		expect(html).toContain("Consult the Mindgem about the Makers");
	});
});

// Dropping the name leaves the header holding controls and nothing else, and a header is a LABEL
// line — so the die and the chat bubble stood on a blank strip above the paragraph they act on. The
// row says it has no label line; the CSS is what moves the controls onto the move's own first line
// (see tests/styles/nameless-move-render.test.js, which measures that they land there).
describe("a nameless row says it draws no label line", () => {
	it("marks the row, so the CSS can place its controls on the move's own first line", () => {
		expect(renderRow(true)).toContain("stonetop-item--nameless");
	});

	it("groups the controls, so they can be placed as one thing", () => {
		const html = render(true);
		expect(html).toContain('<span class="stonetop-item-controls">');
	});

	it("leaves a named row exactly as it was — one header line, ungrouped controls", () => {
		const html = renderRow(false);
		expect(html).not.toContain("stonetop-item--nameless");
		expect(html).not.toContain('<span class="stonetop-item-controls">');
	});

	// The disclosure row keeps its name, so it still HAS a label line and must not be told otherwise.
	// It groups its controls for its own reason: the third column of its grid.
	it("does not mark a disclosure row, which keeps its name", () => {
		const html = renderRow(true, { disclosure: true });
		expect(html).not.toContain("stonetop-item--nameless");
		expect(html).toContain('<span class="stonetop-item-controls">');
	});
});
