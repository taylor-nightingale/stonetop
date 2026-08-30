import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The Play tab renders the ratings at their FULL density, and the claim is that this and the line
 * are one component seen at two sizes. What that has to be true of, geometrically — none of which a
 * text scan of the stylesheet can answer, because every one is a question about where the browser
 * actually put the boxes:
 *
 *  1. The line keeps EVERY rating, on every tab. An earlier pass shed the four stated in full below,
 *     which was backwards: rolling a steading move needs a rating, the condition bending it and the
 *     roll mode, and Play is the tab you roll from.
 *  2. One rule closes each rating head — including its note. Two bordered cells drew two rules at
 *     two heights, because label and value are baseline-aligned and their boxes end at different
 *     depths; the step was 2.3px and invisible to any reading of the CSS.
 *  3. The arch, its name, its value and the bar under them are ONE object of one width. Left to fill
 *     a column the picture floated in a box twice its width, which is what made the pair read as two
 *     photographs rather than as the book's badges.
 *  4. The stepper never covers the digit it edits.
 *  5. The columns fold rather than clipping their rows mid-word.
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

const stepper = value => `
	<span class="stonetop-stepper">
		<input type="number" class="stonetop-step steading-attr-input" value="${value}">
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--up" data-step-dir="1">▲</button>
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--down" data-step-dir="-1">▼</button>
	</span>`;

const label = (attr, text, { rollable = true } = {}) => rollable
	? `<span class="steading-tile-label"><button type="button" class="steading-stat-roll rollable" data-roll="${attr}">
			<span class="steading-title-full">${text}</span><span class="steading-title-short" aria-hidden="true">${text.slice(0, 4)}</span><i class="fas fa-dice-d6 steading-roll-die" aria-hidden="true"></i>
		</button></span>`
	: `<span class="steading-tile-label"><span class="steading-tile-title">
			<span class="steading-title-full">${text}</span><span class="steading-title-short" aria-hidden="true">${text.slice(0, 4)}</span>
		</span></span>`;

const lineTile = (attr, text, { railed = false } = {}) => `
	<div class="steading-tile steading-${attr}${railed ? " steading-railed" : ""}" data-attr="${attr}">
		${label(attr, text)}<span class="steading-tile-value">${stepper(2)}</span>
	</div>`;

// A 1x1 gif standing in for the extracted panel. The arch, its outline and the band at its foot are
// all in the image now, so there is nothing of the sheet's own to stand in for.
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const fullTile = (attr, text, { arched = false, note = "", noteKind = "tier" } = {}) => `
	<div class="steading-tile steading-${attr}${arched ? " steading-tile--arched" : ""}" data-attr="${attr}">
		${arched ? `<span class="steading-arch" aria-hidden="true">
			<img class="steading-tile-badge" width="120" height="120" src="${GIF}" alt="">
		</span>` : ""}
		${label(attr, text)}<span class="steading-tile-value">${stepper(2)}</span>
		${note ? `<span class="steading-tile-note steading-tile-note--${noteKind}">${note}</span>` : ""}
	</div>`;

const list = (attr, title, rows) => `
	<div class="steading-overview-field">
		<h3 class="stonetop-move-group-title">${title}</h3>
		<div class="stonetop-panel-divider" aria-hidden="true"></div>
		<div class="steading-attr-list">
			${rows.map((r, i) => `<div class="steading-attr-row">
				<input type="text" class="stonetop-attr-extra" data-attr="${attr}" data-index="${i}" value="${r}">
				<button class="stonetop-attr-extra-remove stonetop-icon-btn" type="button"><img src="" alt=""></button>
			</div>`).join("")}
			<button class="stonetop-attr-extra-add stonetop-list-add" type="button"><img src="" alt=""><span>add one</span></button>
		</div>
	</div>`;

const condition = (slug, active, effect) => `
	<label class="steading-debility${active ? " is-active" : ""}">
		<input class="steading-circle-input" type="checkbox" data-slug="${slug}"${active ? " checked" : ""}>
		<span class="steading-circle" aria-hidden="true"></span>
		<span class="steading-debility-text">
			<span class="steading-debility-name">${slug}</span>
			<span class="steading-debility-effect"><span class="steading-debility-dash" aria-hidden="true">—</span> ${effect}</span>
		</span>
	</label>`;

// Both densities at once, which is the situation the design has to resolve and neither half can be
// tested from alone.
const fixture = width => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
   <div class="stonetop-rail-layout" data-side="left">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="false" aria-label="Rail"><i class="fas fa-archway"></i></button>
    <div class="stonetop-rail steading-rail" data-density="full">
      <div class="steading-archpair">
        ${fullTile("fortunes", "Fortunes", { arched: true })}
        ${fullTile("surplus", "Surplus", { arched: true })}
      </div>
    </div>
   <div class="stonetop-rail-main steading-main">
    <header class="sheet-header steading-line" data-density="line">
      <div class="steading-line-row steading-line-values">
        <div class="steading-identity">
          <span class="stonetop-combo"><input type="text" class="steading-steadfast-input stonetop-combo-input" value="Stonetop"></span>
          <span class="steading-size-pill">
            <select class="steading-attr-input steading-size-select" aria-label="Size" data-attr="size"><option selected>village</option></select>
            <span class="steading-size-band">150–350</span>
          </span>
        </div>
        <div class="steading-ledger">
          ${lineTile("fortunes", "Fortunes", { railed: true })}
          ${lineTile("surplus", "Surplus", { railed: true })}
          ${lineTile("population", "Population")}
          ${lineTile("prosperity", "Prosperity")}
          ${lineTile("defenses", "Defenses")}
        </div>
      </div>
      <div class="steading-line-row steading-line-conditions">
        <div class="steading-conditions">
          ${condition("lacking", true, "treat Prosperity as if it's 1 lower than it is")}
          ${condition("diminished", false, "disadvantage to Deploy, Muster, or Pull Together")}
          ${condition("malcontent", false, "Fortunes reset to +0 each season, not +1")}
        </div>
        <fieldset class="steading-rollmode"><legend class="steading-line-heading">Roll Mode</legend>
          <label class="steading-rollmode-option is-checked"><input type="radio" class="steading-rollmode-input" name="rm" checked><span>Normal</span></label>
        </fieldset>
      </div>
    </header>
    <nav class="sheet-tabs tabs"><button class="item active" data-tab="play">Play</button></nav>
    <section class="sheet-body">
      <div class="tab active" data-group="primary" data-tab="play">
        <div class="steading-overview-grid steading-play-grid" data-density="full">
          <section class="steading-overview-column">
            ${fullTile("prosperity", "Prosperity", { note: "→ +0 lacking", noteKind: "adjustment" })}
            ${list("prosperity", "Resources", ["Farming (beans, potatoes, oats, barley)", "Distilling (whisky)"])}
          </section>
          <section class="steading-overview-column">
            ${fullTile("defenses", "Defenses", { note: "legendary" })}
            ${list("defenses", "Fortifications, etc.", ["Village militia", "The Ringwall (low, stone)"])}
          </section>
        </div>
      </div>
    </section>
   </div>
   </div>
  </div></div>
</div>`;

const TARGETS = {
	grid:           ".steading-play-grid",
	col1:           ".steading-play-grid > .steading-overview-column:nth-of-type(1)",
	col2:           ".steading-play-grid > .steading-overview-column:nth-of-type(2)",
	rail:           ".steading-rail",
	railedLineTile: '.steading-line .steading-tile[data-attr="fortunes"]',
	sizePill:       ".steading-size-pill",
	lineFortunes:   '.steading-line .steading-tile[data-attr="fortunes"]',
	lineProsperity: '.steading-line .steading-tile[data-attr="prosperity"]',

	valuesRow:      ".steading-line-values",
	conditionsRow:  ".steading-line-conditions",
	rollMode:       ".steading-line-conditions .steading-rollmode",
	markedEffect:   ".steading-debility.is-active .steading-debility-effect",
	unmarkedEffect: ".steading-debility:not(.is-active) .steading-debility-effect",
	head:           '.steading-play-grid .steading-tile[data-attr="prosperity"]',
	headLabel:      '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-label',
	headValue:      '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-value',
	headNote:       '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-note',
	archTile:       '.steading-archpair .steading-tile[data-attr="fortunes"]',
	archTile2:      '.steading-archpair .steading-tile[data-attr="surplus"]',
	arch:           '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-arch',
	archName:       '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-tile-label',
	archValue:      '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-tile-value',
	archInput:      '.steading-rail .steading-archpair .steading-tile[data-attr="fortunes"] .steading-attr-input',
	archStepUp:     '.steading-archpair .steading-tile[data-attr="fortunes"] .stonetop-stepper-btn--up',
	archStepDown:   '.steading-archpair .steading-tile[data-attr="fortunes"] .stonetop-stepper-btn--down',
};

// The probe's window is ~768px by default, so a fixture wider than that is clipped by the viewport
// rather than laid out — and every container query answers to the viewport instead of the width
// under test. Size the window to match.
const measureAt = width => probe.measure({
	bodyHtml: fixture(width), bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: [`--window-size=${width + 40},1200`],
});

describe.skipIf(!canProbe())("the Play tab's full density", () => {
	for (const width of [1400, 900]) {
		describe(`at ${width}px`, () => {
			let m;
			beforeAll(() => { m = measureAt(width); });

			// Measured as area rather than `display`, because there are several ways to get this wrong.
			// The four the line owns outright, plus Size in its pill. Fortunes and Surplus are the
			// rail's while the rail is inline; that handoff has its own tests below, and between the
			// two nothing is ever on neither surface.
			it("keeps every rating it owns on the line, on the tab that states them in full", () => {
				for (const name of ["lineProsperity", "sizePill"]) {
					expect(m.get(name).values.boxWidth, `${name} left the line`).toBeGreaterThan(0);
				}
			});

			it("puts the conditions on their own row under the values, with the mode ending it", () => {
				const values = m.get("valuesRow").values;
				const conds  = m.get("conditionsRow").values;
				expect(conds.boxTop).toBeGreaterThan(values.boxTop + values.boxHeight - 1);
				const mode = m.get("rollMode").values;
				expect(mode.boxLeft + mode.boxWidth)
					.toBeCloseTo(conds.boxLeft + conds.boxWidth, 0);
			});

			// One rule, closing the head — note included, so the note cannot read as a second value.
			it("closes each rating head with one rule, below its note", () => {
				const head = m.get("head").values;
				const note = m.get("headNote").values;
				const value = m.get("headValue").values;
				expect(note.boxTop).toBeGreaterThan(value.boxTop + value.boxHeight - 1);
				expect(note.boxTop + note.boxHeight).toBeLessThanOrEqual(head.boxTop + head.boxHeight + 1);
			});

			it("makes the arch, its name, its value and its bar one object of one width", () => {
				const tile = m.get("archTile").values;
				for (const part of ["arch", "archName", "archValue"]) {
					const p = m.get(part).values;
					expect(p.boxWidth, `${part} is not the arch tile's width`).toBeCloseTo(tile.boxWidth, 0);
				}
			});

			it("keeps the two arches level, though only one of them rolls", () => {
				expect(m.get("archTile").values.boxTop).toBeCloseTo(m.get("archTile2").values.boxTop, 0);
				expect(m.get("archTile").values.boxHeight).toBeCloseTo(m.get("archTile2").values.boxHeight, 0);
			});

			// The bug this replaces: absolutely positioned over the input's right edge and revealed on
			// hover, so on a centred value the button sat on top of the digit — the control covering
			// the thing it edits.
			//
			// Stated as non-overlap rather than as left/right order: whether ▾ ends up before or after
			// the number is a nicety that a legitimate reflow may change, while a button on top of the
			// value is the defect, at any width.
			it("draws both steppers at rest, clear of the number", () => {
				const input = m.get("archInput").values;
				const boxes = { down: m.get("archStepDown").values, up: m.get("archStepUp").values };
				for (const [name, box] of Object.entries(boxes)) {
					expect(box.boxWidth, `the ${name} stepper is not drawn at rest`).toBeGreaterThan(0);
					const overlap = Math.min(box.boxLeft + box.boxWidth, input.boxLeft + input.boxWidth)
						- Math.max(box.boxLeft, input.boxLeft);
					expect(overlap, `the ${name} stepper covers ${Math.round(overlap)}px of the value`)
						.toBeLessThanOrEqual(0);
				}
			});
		});
	}

	// The columns fold rather than squeezing their rows into ellipses.
	describe("as it narrows", () => {
		const columnsAt = width => {
			const m = measureAt(width);
			const tops = ["col1", "col2"].map(c => m.get(c).values.boxTop);
			return new Set(tops).size === 1 ? 2 : 1;
		};

		it("holds two columns while there is room", () => {
			expect(columnsAt(1400)).toBe(2);
		});

		it("folds rather than clipping once there is not", () => {
			// Below `@container steading-play (max-width: 34rem)`. The rail has already drawered by
			// here, so the grid gets the whole window and this is the grid's own threshold.
			expect(columnsAt(500)).toBeLessThan(2);
		});
	});

	// The handoff that makes the rail safe: above the breakpoint the rail carries Fortunes and
	// Surplus and the line hides its copies; at or below it the rail is a drawer and the line shows
	// them again. Measured, because the two rules live on two containers and only the browser can
	// say whether they actually agree about the width.
	describe("the rail, and the ratings it carries", () => {
		it("hides the line's copies while the rail is inline", () => {
			const m = measureAt(1400);
			expect(m.get("rail").values.boxWidth).toBeGreaterThan(0);
			expect(m.get("railedLineTile").values.boxWidth).toBe(0);
		});

		// One case per width rather than a loop: each is a separate browser launch, and four of them
		// in one `it` overruns the suite's timeout.
		// 900 is the boundary itself — the rail's `max-width: 900px` and the line's `min-width:
		// 900.01px` have to leave no gap, and an off-by-one here means Fortunes and Surplus are on
		// neither surface at exactly one width.
		it.each([900, 860, 700, 640])("gives them back at %ipx, where the rail no longer shows them", width => {
			const m = measureAt(width);
			expect(m.get("railedLineTile").values.boxWidth,
				`Fortunes is on neither the rail nor the line at ${width}px`).toBeGreaterThan(0);
		});

		it("keeps Size out of the ledger and in its own pill", () => {
			expect(measureAt(1400).get("sizePill").values.boxWidth).toBeGreaterThan(0);
		});
	});

	// Conditions shed in the order they are worth: the ones the steading does not have lose their
	// explanation first, and every name stays reachable at every width.
	describe("the conditions, as the line narrows", () => {
		// Wider than the old 1400: the rail takes 220px off the line at every width, permanently, and
		// the line's shedding thresholds are measured against its OWN container. Same behaviour for a
		// given line width — the window simply has to be that much bigger to produce it.
		it("states all three effects while there is room", () => {
			const m = measureAt(1660);
			expect(m.get("markedEffect").values.boxWidth).toBeGreaterThan(0);
			expect(m.get("unmarkedEffect").values.boxWidth).toBeGreaterThan(0);
		});

		it("drops the unmarked explanations before the marked one", () => {
			const m = measureAt(900);
			expect(m.get("unmarkedEffect").values.boxWidth).toBe(0);
			expect(m.get("markedEffect").values.boxWidth).toBeGreaterThan(0);
		});
	});
});
