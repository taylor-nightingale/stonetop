import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The neighbouring-community row, measured rather than read off the stylesheet.
 *
 * The row makes four geometric claims, none of which a text scan of the CSS can settle, because
 * every one is a question about where the browser actually put the boxes:
 *
 *  1. The name leads the line and the two facts end it. "Size and travel sit at the right of the
 *     heading" is the whole reason a row with nothing filled in still reads as a row; a fact that
 *     drifted back against the name would read as part of it.
 *  2. Each fact is ONE object on ONE rule — the sheet's single idiom for a value. The label and the
 *     value are baseline-aligned, so their boxes end at different depths, and a rule drawn per part
 *     lands at two heights by a step small enough to be invisible in the source.
 *  3. Narrow, the facts drop UNDER the name rather than crushing it. The alternative is a name
 *     squeezed toward an ellipsis by two fields, which is the one thing on the row that must always
 *     be readable.
 *  4. Nothing in the row overflows the panel — including a travel time written as prose, which is
 *     how the book states them ("at least a few days' travel").
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

// Mirrors steading-neighbor-places.hbs at the steading's settings: Size read-only, Travel editable.
const fact = (label, value) => value ? `
				<span class="steading-neighbor-fact">
					<span class="steading-neighbor-fact-label">${label}</span>
					${label === "Travel"
						? `<input type="text" class="steading-neighbor-travel" value="${value}">`
						: `<span class="steading-neighbor-fact-value">${value}</span>`}
				</span>` : "";

// Mirrors steading-neighbor-places.hbs at the STEADING's settings: Size read-only, Travel editable,
// and a fact with no value left out entirely rather than drawn as a label and a dash.
const row = (name, subtitle, size, travel, note = "") => `
	<section class="steading-neighbor-place steading-block">
		<div class="steading-neighbor-head">
			<h4 class="steading-neighbor-name">${name}${subtitle ? ` <span class="steading-neighbor-subtitle">${subtitle}</span>` : ""}</h4>
			<div class="steading-neighbor-facts">${fact("Size", size)}${fact("Travel", travel)}</div>
		</div>
		<label class="steading-neighbor-text-field">
			<span>Notes</span>
			<textarea rows="2" class="stonetop-neighbor-place-note stonetop-grow-field">${note}</textarea>
		</label>
	</section>`;

const fixture = width => `
<div class="application stonetop sheet actor steading themed theme-light">
	<div class="window-content"><div class="sheet-wrapper">
	<div class="steading-split-grid"><section class="steading-split-column" style="width: ${width}px; flex: none">
		<section class="steading-neighbor-places">
			<h3 class="stonetop-move-group-title">Neighbouring Communities</h3>
			<div class="stonetop-panel-divider" aria-hidden="true"></div>
			${row("Marshedge", "", "town", "10 days", "")}
			${row("The Steplands", "Hillfolk", "", "4 days", LONG_NOTE)}
			${row("Other places", "The Manmarch, etc.", "", "")}
		</section>
	</section></div>
	</div></div>
</div>`;

// A note written over a campaign, plus an unbroken token of the kind a URL or a name drop leaves in
// one — the two ways a fixed-height box fails.
const LONG_NOTE = "Ulna trades through on her way south every autumn and wants wheat, flax and rope; "
	+ "they have asked twice about the Ringwall and been told no both times, and the second time it was "
	+ "Dunwick who said it, in front of everyone, which nobody there has forgotten. "
	+ "Reference: aVeryLongUnbrokenTokenThatCannotWrapAtAnySpaceWhatsoever";

const TARGETS = {
	places:    ".steading-neighbor-places",
	head:      ".steading-neighbor-place .steading-neighbor-head",
	name:      ".steading-neighbor-place .steading-neighbor-name",
	facts:     ".steading-neighbor-place .steading-neighbor-facts",
	sizeFact:  ".steading-neighbor-place .steading-neighbor-fact:first-child",
	sizeLabel: ".steading-neighbor-place .steading-neighbor-fact:first-child .steading-neighbor-fact-label",
	sizeValue: ".steading-neighbor-place .steading-neighbor-fact-value",
	travel:    ".steading-neighbor-place .steading-neighbor-travel",
	proseName: ".steading-neighbor-place + .steading-neighbor-place .steading-neighbor-name",
	proseTrav: ".steading-neighbor-place + .steading-neighbor-place .steading-neighbor-travel",
	unsetSize: ".steading-neighbor-place + .steading-neighbor-place .steading-neighbor-fact-value",
	bareFacts: ".steading-neighbor-place:last-child .steading-neighbor-facts",
	emptyNote: ".steading-neighbor-place .stonetop-neighbor-place-note",
	longNote:  ".steading-neighbor-place + .steading-neighbor-place .stonetop-neighbor-place-note",
};

const measureAt = width => probe.measure({
	bodyHtml: fixture(width), bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: ["--window-size=1200,1200"],
});

const right = el => el.values.boxLeft + el.values.boxWidth;
const bottom = el => el.values.boxTop + el.values.boxHeight;

describe.skipIf(!canProbe())("a neighbouring community's heading row", () => {
	describe("at a comfortable width", () => {
		let m;
		beforeAll(() => { m = measureAt(620); });

		// `unsetSize` is deliberately absent — see the fact-omission assertion below.
		it("renders every part of the row", () => {
			for (const name of Object.keys(TARGETS).filter(n => n !== "unsetSize"))
				expect(m.get(name).missing, `${name} did not render`).toBe(false);
		});

		// The facts FOLLOW the name along the line, as the ledger runs Population after the steading's
		// own name. Not pushed to the right edge: right-aligning a pair whose halves differ in width on
		// every row ("town" against "village") lands their rules at a different x in each one.
		it("runs the facts after the name on one line, not out to the edge", () => {
			const name = m.get("name"), facts = m.get("facts"), head = m.get("head");
			expect(facts.values.boxLeft, "the facts drifted back against the name")
				.toBeGreaterThan(right(name));
			expect(right(facts), "the facts were stretched to the row's end")
				.toBeLessThan(right(head) - 40);
			// One line: the two boxes overlap vertically rather than stacking.
			expect(facts.values.boxTop).toBeLessThan(bottom(name));
		});

		it("draws one rule under a fact, not one per part of it", () => {
			const fact = m.get("sizeFact"), label = m.get("sizeLabel"), value = m.get("sizeValue");
			// Both parts end inside the one box that carries the border.
			expect(bottom(label)).toBeLessThanOrEqual(bottom(fact) + 0.5);
			expect(bottom(value)).toBeLessThanOrEqual(bottom(fact) + 0.5);
			expect(right(value)).toBeLessThanOrEqual(right(fact) + 0.5);
		});

		it("crops nothing, including a travel time written as prose", () => {
			for (const name of ["name", "sizeValue", "travel", "proseTrav"])
				expect(m.get(name).overflows, `${name} is cropped`).toBe(false);
		});

		// Left to itself a text input takes a default ~20-character measure, drawing a rule three times
		// the length of the one beside it — which is what read as "misaligned".
		it("draws the travel rule at the width of the time, not a default input measure", () => {
			const travel = m.get("travel").values, size = m.get("sizeValue").values;
			expect(travel.boxWidth).toBeLessThan(size.boxWidth * 3);
		});

		it("leaves out a fact with no value, rather than drawing a label and a dash", () => {
			// The Steplands has no size: the region is not a steading and the book gives it none.
			expect(m.get("unsetSize").missing, "an unset Size was drawn anyway").toBe(true);
			// "Other places" has neither, so its fact row is empty and takes no height.
			expect(m.get("bareFacts").values.boxHeight).toBeLessThan(2);
		});

		it("keeps the row inside the panel", () => {
			expect(right(m.get("facts"))).toBeLessThanOrEqual(right(m.get("places")) + 0.5);
		});
	});

	// The Places tab is one of two columns, and the rail takes 220px off the sheet before either of
	// them gets a share — so these are widths the row really sees.
	describe("at a narrow width", () => {
		let m;
		beforeAll(() => { m = measureAt(300); });

		it("still fits name and facts on one line", () => {
			expect(m.get("facts").values.boxTop).toBeLessThan(bottom(m.get("name")));
		});

		it("keeps everything inside the panel", () => {
			expect(right(m.get("facts"))).toBeLessThanOrEqual(right(m.get("places")) + 0.5);
			expect(m.get("travel").overflows).toBe(false);
		});
	});

	// Narrower than the facts can share a line with the name. The claim is about which one gives way:
	// the name is the thing that must always be readable, so the facts drop below it rather than
	// squeezing it toward an ellipsis.
	describe("narrower than the line can hold", () => {
		let m;
		beforeAll(() => { m = measureAt(220); });

		it("drops the facts under the name rather than crushing it", () => {
			expect(m.get("facts").values.boxTop, "the facts stayed on the name's line")
				.toBeGreaterThanOrEqual(bottom(m.get("name")) - 1);
			expect(m.get("name").overflows, "the name was crushed by the facts").toBe(false);
		});

		it("still keeps everything inside the panel", () => {
			expect(right(m.get("facts"))).toBeLessThanOrEqual(right(m.get("places")) + 0.5);
			expect(m.get("travel").overflows).toBe(false);
		});
	});
});

// A note about a neighbour is written over a campaign, not in one sitting. A fixed box scrolls its
// own beginning out of sight, and there is no resize handle to get it back.
describe.skipIf(!canProbe())("a neighbouring community's notes", () => {
	let m;
	beforeAll(() => { m = measureAt(620); });

	it("stands taller than an empty one when it holds a campaign's worth of note", () => {
		// Several lines taller, not a hair: the claim is that it grows, and a box already floored at
		// two lines will always be a pixel or two off its own floor.
		expect(m.get("longNote").values.boxHeight)
			.toBeGreaterThan(m.get("emptyNote").values.boxHeight + 40);
	});

	it("shows the whole note rather than scrolling inside a box", () => {
		expect(m.get("longNote").overflowY, "the note is cropped").toBe(0);
	});

	// Two lines of THIS field's own text — derived from its line-height, so the floor moves with the
	// Foundry font-size step rather than being a px guess about one.
	it("floors an empty note at two lines, so it still reads as somewhere to write", () => {
		const empty = m.get("emptyNote").values;
		expect(empty.boxHeight).toBeGreaterThan(30);
		expect(empty.boxHeight).toBeLessThan(48);
	});

	// An unbroken token — a URL, a name drop — must break rather than run out of the panel.
	it("breaks a word too long to wrap instead of overflowing sideways", () => {
		expect(m.get("longNote").overflowX, "the note runs off the side").toBe(0);
		expect(right(m.get("longNote"))).toBeLessThanOrEqual(right(m.get("places")) + 0.5);
	});
});

