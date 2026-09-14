import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { MoveSnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { ValueMax } from "../../src/model/snapshot/character/VitalsSnapshot.js";

/**
 * Where a nameless move's controls actually land, measured.
 *
 * A few moves are printed with no name over them — an arcanum's front trigger, the Would-Be Hero's
 * Destined — and the row draws none. But the header they sit in is a LABEL line, and emptied of its
 * label it still took one: the die and the chat bubble stood on a blank strip above the paragraph
 * they act on, reading as decoration belonging to nothing. "Is there a rule for it" is a text
 * question; "did the browser give those two buttons a line of their own" is not.
 *
 * Both shapes are measured, because they are laid out differently and only one of them was ever
 * looked at: the moves tab renders these rows WITH an acquisition check, while an arcanum card and a
 * playbook's choice group grant them inline with none.
 *
 * The fixture is the real partial rendered from a real snapshot — the rules under test are keyed on
 * `.stonetop-item--nameless` and on `display: contents`, which is to say on exactly the markup the
 * partial emits.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// Destined, as the pack ships it: no name over it, two paragraphs, rolls +Omens.
const DESTINED = [
	"At the **_start of a session_**, roll +Omens: **on a 7+**, lose all Omens and the GM will",
	"describe a vision or portent that points toward your fate and/or clarifies your current",
	"situation; also, **on a 10+**, ask the GM a follow-up question and get a clear, helpful answer.",
	"",
	"**_Until your destiny is fulfilled_**, treat a 6- on Death's Door as a 7-9, and a 7-9 as a 10+.",
].join("\n");

const destined = new MoveSnapshotBuilder()
	.withSlug("destined").withName("Destined").withNameless(true)
	.withDescription(DESTINED).withRollStat("omens").withOwnedId("owned-destined")
	.withSelection(new ValueMax(1, 1)).withSelectable(false)
	.build();

// A named row beside it, so "the controls sit on the row's first line" is measured against a row
// where that has always been true rather than against a number written down here.
const bolster = new MoveSnapshotBuilder()
	.withSlug("bolster").withName("Bolster")
	.withDescription("When you **_prepare for what's coming_**, say how and answer the GM's questions.")
	.withRollStat("defenses").withOwnedId("owned-bolster")
	.withSelection(new ValueMax(1, 1)).withSelectable(false)
	.build();

// Tab width, which is where these rows are read: an arcanum's card and the moves tab both give the
// text a column wide enough to wrap, and the claim is about which line the controls share.
const fixture = showCheck => `
<div class="application stonetop sheet character themed theme-light" style="width: 640px">
 <div class="window-content">
  <div class="stonetop-move-group"><ol class="items-list" style="column-count: 1">
   ${[bolster, destined].map(move => renderPartial("stonetop.move-row",
		{ ...move, sheetIdPrefix: "s1", showCheck, categoryKey: "starting" })).join("\n")}
  </ol></div>
 </div>
</div>`;

const ROW = '.stonetop-item:has([data-move-slug="destined"])';

const TARGETS = {
	row:      ROW,
	text:     `${ROW} .stonetop-item-description`,
	controls: `${ROW} .stonetop-item-controls`,
	die:      `${ROW} .move-rollable`,
	chat:     `${ROW} .stonetop-move-chat`,
	check:    `${ROW} .stonetop-item-check`,
	namedRow: '.stonetop-item:has([data-move-slug="bolster"])',
};

const measure = showCheck => probe.measure({
	bodyHtml: fixture(showCheck), bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"',
	targets: TARGETS,
	chromeFlags: ["--window-size=800,1000"],
});

const right  = el => el.values.boxLeft + el.values.boxWidth;
const bottom = el => el.values.boxTop + el.values.boxHeight;

describe.skipIf(!canProbe())("a nameless move's controls, as an inline grant (no check)", () => {
	let m;
	beforeAll(() => { m = measure(false); });
	const el = name => m.get(name);

	// The die and the chat bubble are Font Awesome glyphs and the probe has no icon font, so they are
	// asserted to exist and to be positioned, never to have a width.
	it("renders the row, its text and its grouped controls", () => {
		for (const name of ["row", "text", "controls", "die", "chat"]) {
			expect(el(name).missing, `${name} did not render`).toBe(false);
		}
		expect(el("check").missing, "an inline grant drew an acquisition check").toBe(true);
	});

	// The reported problem, stated as geometry: the controls had a line to themselves above the text.
	// Overlap rather than a shared top edge — the control group is a whole line box tall and the
	// measurement is of the first line's GLYPHS, which sit a fraction inside it.
	it("puts the controls on the move's own first line, not on a line above it", () => {
		const firstLine = el("text").values;
		expect(bottom(el("controls")), "the controls sit entirely above the move's text")
			.toBeGreaterThan(firstLine.firstLineTop);
		expect(el("controls").values.boxTop, "the controls sit below the move's first line")
			.toBeLessThan(firstLine.firstLineTop + firstLine.firstLineHeight);
		expect(el("controls").boxMiddle,
			"the controls are not centred on the text's first line")
			.toBeCloseTo(el("text").firstLineMiddle, 0);
	});

	// The same thing said about the row rather than the controls: a strip of its own is height the
	// row did not need, so the row is exactly its text.
	it("costs the row no height of its own", () => {
		expect(el("row").values.boxHeight - el("text").values.boxHeight,
			"the row is taller than the move's text — the header still takes a line")
			.toBeLessThan(el("text").values.firstLineHeight);
	});

	// Floated, not given a column: a column is reserved down the row's whole height, which is 44px
	// off every line of a paragraph in a 220px rail.
	it("lets the text run full width below the controls", () => {
		expect(right(el("text")), "the text stops short of the row's right edge")
			.toBeCloseTo(right(el("row")), 0);
	});

	it("hangs the controls at the row's right edge, clear of the text", () => {
		expect(right(el("controls"))).toBeCloseTo(right(el("row")), 0);
	});

	// With nothing to clear, the gutter the check is given would indent the move's text past nothing.
	it("starts the text at the row's own left edge", () => {
		expect(el("text").values.boxLeft).toBeCloseTo(el("row").values.boxLeft, 0);
	});

	// The whole point of the change: a nameless row is laid out the way a named one is, measured from
	// whatever identifies the move. A named row has never had a floating strip.
	it("puts them where a named row puts them — on the row's first line", () => {
		expect(el("die").boxMiddle).toBeCloseTo(el("text").firstLineMiddle, 0);
		expect(m.get("namedRow").values.boxHeight).toBeGreaterThan(0);
	});
});

describe.skipIf(!canProbe())("a nameless move's controls, on the moves tab (with a check)", () => {
	let m;
	beforeAll(() => { m = measure(true); });
	const el = name => m.get(name);

	it("renders the check", () => {
		expect(el("check").missing, "the check did not render").toBe(false);
	});

	it("still keeps the controls on the move's first line", () => {
		expect(el("controls").boxMiddle).toBeCloseTo(el("text").firstLineMiddle, 0);
	});

	// The check drops into the gutter the description's indent already leaves for it, so every line
	// of the move's text starts at the same place — the check is beside the first one, not above it.
	it("drops the check into the text's own gutter, level with the first line", () => {
		expect(right(el("check")), "the check overlaps the move's text")
			.toBeLessThanOrEqual(el("text").textLeft + 1);
		expect(el("check").boxMiddle).toBeCloseTo(el("text").firstLineMiddle, 0);
	});

	it("costs the row no height of its own", () => {
		expect(el("row").values.boxHeight - el("text").values.boxHeight)
			.toBeLessThan(el("text").values.firstLineHeight);
	});
});
