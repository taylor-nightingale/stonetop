import { describe, it, expect } from "vitest";
import { possessionRow, takeBox } from "../../scripts/development/redesign-mock/parts.js";

/**
 * The possessions tab's row: the move row's skeleton with a possession's contents.
 *
 * What these guard is the difference, because the sameness is guarded by the move row's own tests
 * running against the shared skeleton: no roll, no die, no chat and no card — a possession rolls
 * nothing and its row already says everything a card would — and a second line that is the WHOLE
 * description rather than a label for text somewhere else.
 */

/** A possession the snapshot would hand over, reduced to the fields the row reads. */
const aPossession = (over = {}) => ({
	slug: "books-and-scrolls",
	name: "Books & scrolls",
	nameHtml: "Books &amp; scrolls",
	descriptionHtml: "expend a use to consult your collection",
	isTaken: true,
	isGranted: false,
	grantedBy: null,
	isLocked: false,
	isRemovable: false,
	resource: null,
	picks: [],
	markedPicks: [],
	...over,
});

const weapons = [
	{ slug: "sword", label: "◇ Sword, iron", marked: true, detail: "", exclusive: false },
	{ slug: "battleaxe", label: "◇ Battleaxe, iron", marked: false, detail: "", exclusive: false },
	{ slug: "crossbow", label: "◇ Crossbow", marked: true, detail: "", exclusive: false },
];
const weaponsOfWar = (over = {}) => aPossession({
	slug: "weapons-of-war-heavy", name: "Weapons of war", nameHtml: "Weapons of war",
	descriptionHtml: "choose up to 3 (now or later)",
	picks: weapons, markedPicks: weapons.filter(w => w.marked), ...over,
});

describe("possessionRow, at rest", () => {
	const html = possessionRow(aPossession());

	it("draws the name and the whole description", () => {
		expect(html).toContain("Books &amp; scrolls");
		expect(html).toContain("expend a use to consult your collection");
	});

	it("has no roll, no die, no chat and no card", () => {
		expect(html).not.toContain("rd-cell--roll");
		expect(html).not.toContain("fa-dice-d6");
		expect(html).not.toContain("stonetop-move-chat");
		expect(html).not.toContain("rd-preview");
	});

	// A move's gloss is cut to one line because the text is a click away; a possession's description
	// IS its content, so it is a different element that wraps.
	it("puts the description in a line of its own kind, not the move's clamped gloss", () => {
		expect(html).toContain("rd-mrow-desc");
		expect(html).not.toContain("stonetop-move-gloss");
	});

	it("draws no box and no choosing line", () => {
		expect(html).not.toContain("rd-mrow-mark");
		expect(html).not.toContain("rd-choosing-line");
	});

	it("shares the move row's skeleton", () => {
		expect(html).toContain('class="rd-row rd-mrow"');
		expect(html).toContain("rd-mrow-name");
		expect(html).toContain("rd-mrow-sub");
	});
});

describe("a possession with a resource", () => {
	it("draws the title and the track, as a move's", () => {
		const html = possessionRow(aPossession({ resource: { current: 0, max: 2, title: "Skins of fine whisky" } }));
		expect(html).toContain("Skins of fine whisky");
		expect(html).toContain('aria-label="Books &amp; scrolls, 1 of 2"');
	});
});

describe("a possession with options", () => {
	it("shows every option, always, as a box under the description", () => {
		for (const opts of [{}, { choosing: true }]) {
			const html = possessionRow(weaponsOfWar(), opts);
			expect(html).toMatch(/data-pick-possession="weapons-of-war-heavy"\s+data-pick-slug="sword" checked/);
			expect(html).toContain('data-pick-slug="battleaxe"');
			expect(html).not.toContain(" hidden");
		}
	});

	// Nothing to open: the options are never shut away.
	it("has no disclosure and no body", () => {
		const html = possessionRow(weaponsOfWar());
		expect(html).not.toContain("stonetop-move-disclosure");
		expect(html).not.toContain("rd-row-body");
	});

	// The ticked boxes are right under the description, so it does not list them a second time.
	it("keeps the description to the description", () => {
		const html = possessionRow(weaponsOfWar());
		const desc = html.slice(html.indexOf("rd-mrow-desc"), html.indexOf("</span>", html.indexOf("rd-mrow-desc")));
		expect(desc).toContain("choose up to 3 (now or later)");
		expect(html).not.toContain("rd-picked");
	});

	it("draws a pick-1 row as radios, so one pick clears the other", () => {
		const one = weapons.map(w => ({ ...w, exclusive: true }));
		expect(possessionRow(weaponsOfWar({ picks: one }))).toContain('type="radio"');
		expect(possessionRow(weaponsOfWar())).not.toContain('type="radio"');
	});

	it("prints an option's description beside its text", () => {
		const maul = [{ slug: "maul", label: "Black iron maul", marked: false, detail: "utterly immune to all magic", exclusive: true }];
		expect(possessionRow(weaponsOfWar({ picks: maul, markedPicks: [] }))).toContain("utterly immune to all magic");
	});
});

describe("a possession with nothing to pick", () => {
	it("has no disclosure, no body and no option list", () => {
		const html = possessionRow(aPossession());
		expect(html).not.toContain("stonetop-move-disclosure");
		expect(html).not.toContain("rd-row-body");
		expect(html).not.toContain("rd-movepicks");
	});
});

describe("choosing possessions", () => {
	const choosing = { choosing: true };

	it("gives the row one box, which takes the possession", () => {
		const html = possessionRow(aPossession({ isTaken: false }), choosing);
		expect(html).toContain("rd-mrow-mark");
		expect(html).toContain('data-take-possession="books-and-scrolls"');
		expect(html).not.toContain(" checked");
	});

	// The shipped sheet locks the box of a possession the playbook hands over, and names what did.
	it("locks a granted possession's box, and says what granted it", () => {
		const html = possessionRow(aPossession({ isGranted: true, grantedBy: "Starting", isLocked: true }), choosing);
		expect(html).toMatch(/rd-take"[^>]*disabled/);
		expect(html).toContain("rd-choosing-line");
		expect(html).toContain("Starting");
	});

	it("has no choosing line for a possession the player picked", () => {
		expect(possessionRow(aPossession(), choosing)).not.toContain("rd-choosing-line");
	});

	// Both are lines under the description; neither may push the other out.
	it("shows a granted possession's grant and its options together", () => {
		const html = possessionRow(weaponsOfWar({ isGranted: true, grantedBy: "Starting", isLocked: true }), choosing);
		expect(html).toContain("Starting");
		expect(html).toContain('data-pick-slug="sword"');
	});
});

describe("a possession the GM added", () => {
	it("can be deleted, and only then", () => {
		expect(possessionRow(aPossession({ isRemovable: true }))).toContain('aria-label="Remove Books &amp; scrolls"');
		expect(possessionRow(aPossession())).not.toContain("Remove Books");
	});
});

describe("takeBox, for a possession", () => {
	it("says which kind of thing it takes, so one handler cannot take the other", () => {
		expect(takeBox(aPossession(), { kind: "possession" })).toContain('data-take-possession="books-and-scrolls"');
		expect(takeBox(aPossession())).toContain('data-take="books-and-scrolls"');
	});

	it("is disabled only when locked", () => {
		expect(takeBox(aPossession(), { locked: true })).toContain(" disabled");
		expect(takeBox(aPossession())).not.toContain("disabled");
	});
});
