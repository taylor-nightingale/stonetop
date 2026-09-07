import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";

// A result that confers a MOVE renders as that move's own row. Which leaves one thing for the
// template to decide: whether the row says where the move came from.
//
// Every other move row on the sheet sits under a heading that answers that — a category, a playbook,
// an arcanum. A conferred move does not: it is collected by WHEN it fires, among the results of a
// season, so the improvement's name is the only thing on the row explaining why it is there. Except
// on that improvement's own card, which is already saying it.
//
// The statement partial reads that from `showSource`, and the row is TWO block frames down from it
// (`{{#each}}` over the slugs, `{{#with}}` over the lookup) — a path depth nothing else pins, and one
// that fails silently in both directions: too shallow and every card repeats its own name, too deep
// and the season's statement stops saying which improvement conferred the hunt.

const MOVE = {
	slug: "news-at-the-inn", name: "News at the Inn", ownedId: null, rollStat: "fortunes",
	description: "When **_news reaches the inn_**, roll +Fortunes.", gloss: "news reaches the inn",
	sourceLabel: "Inn", selection: { value: 0, max: 1 },
};

const render = showSource => renderPartial("stonetop.steading-statement", {
	editable: true,
	sheetIdPrefix: "sheet-1",
	stonetop: { grantedMoves: { [MOVE.slug]: MOVE } },
	statement: { grantedMoveSlugs: [MOVE.slug], automatic: [], advisory: [], hasAutomatic: false },
	showSource,
});

describe("a conferred move's row", () => {
	it("renders as a move row rather than a prose line and a detached button", () => {
		const html = render(true);
		expect(html).toContain("News at the Inn");
		expect(html).toContain('class="stonetop-move-body"');
		expect(html).not.toContain("steading-statement-move\"");
	});

	it("names the improvement that conferred it where the surface does not", () => {
		expect(render(true)).toContain('class="stonetop-item-source">Inn<');
	});

	it("says nothing about the source on the card that IS the source", () => {
		expect(render(false)).not.toContain("stonetop-item-source");
	});
});
