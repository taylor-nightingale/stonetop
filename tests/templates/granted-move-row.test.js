import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";

// A result that confers a MOVE renders as that move's own row: the move's name, its die, its own
// words behind a disclosure — not a fragment of it beside a detached button.
//
// And nothing else. The row used to carry the conferring improvement's name as a caption, which put
// it in the only place on a move row that is spoken for: between the name and the move's own words.
// A snapshot still CAN carry a `sourceLabel` — an arcanum move's "Requires: Battery" — so the
// suppression is the template's, and it is worth pinning: the partial is shared, and the caption
// would come back the moment a disclosure row were handed one.

const MOVE = {
	slug: "news-at-the-inn", name: "News at the Inn", ownedId: null, rollStat: "fortunes",
	description: "When **_news reaches the inn_**, roll +Fortunes.", gloss: "news reaches the inn",
	sourceLabel: "Inn", selection: { value: 0, max: 1 },
};

const render = showSource => renderPartial("stonetop.steading-statement", {
	editable: true,
	sheetIdPrefix: "sheet-1",
	stonetop: { grantedMoves: { [MOVE.slug]: MOVE } },
	statement: {},
	moveSlugs: [MOVE.slug],
	showSource,
});

describe("a conferred move's row", () => {
	it("renders as a move row rather than a prose line and a detached button", () => {
		const html = render(true);
		expect(html).toContain("News at the Inn");
		expect(html).toContain('class="stonetop-move-body"');
		expect(html).not.toContain("steading-statement-move\"");
	});

	// The row's second line is the gloss — the move's own trigger — and the first is the move's name.
	// A caption between them separates a move from the words that say what it does.
	it("hangs no source caption between the name and the move's own words", () => {
		expect(render(true)).not.toContain("stonetop-item-source");
		expect(render(true)).toContain('class="stonetop-move-gloss">news reaches the inn<');
	});

	it("says nothing about the source on the card that IS the source either", () => {
		expect(render(false)).not.toContain("stonetop-item-source");
	});
});
