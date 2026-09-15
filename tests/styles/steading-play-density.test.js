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

const fullTile = (attr, text, { arched = false, note = "", noteKind = "tier", rollable = true } = {}) => `
	<div class="steading-tile steading-${attr}${arched ? " steading-tile--arched" : ""}" data-attr="${attr}">
		${arched ? `<span class="steading-arch" aria-hidden="true">
			<img class="steading-tile-badge" width="120" height="120" src="${GIF}" alt="">
		</span>` : ""}
		${label(attr, text, { rollable })}<span class="steading-tile-value">${stepper(2)}</span>
		${note ? `<span class="steading-tile-note steading-tile-note--${noteKind}">${note}</span>` : ""}
	</div>`;

const assetsField = rows => `
	<div class="steading-overview-field">
		<h3 class="stonetop-move-group-title">Assets</h3>
		<div class="stonetop-panel-divider" aria-hidden="true"></div>
		<div class="steading-attr-list">
			${rows.map(r => `<div class="steading-attr-row steading-asset-row">
				<textarea rows="1" class="stonetop-asset-item stonetop-grow-field">${r}</textarea>
				<label class="steading-asset-state"><input type="checkbox" class="stonetop-item-check"><span>at home</span></label>
				<button class="stonetop-asset-item-remove stonetop-icon-btn" type="button"><img src="" alt=""></button>
			</div>`).join("")}
			<button class="stonetop-asset-item-add stonetop-list-add" type="button"><img src="" alt=""><span>add an asset</span></button>
		</div>
	</div>`;

const coinCell = value => `
	<td class="steading-coinage-cell"><span class="stonetop-stepper">
		<input type="number" class="stonetop-coinage-input stonetop-step" value="${value}">
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--up" data-step-dir="1">▲</button>
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--down" data-step-dir="-1">▼</button>
	</span></td>`;

const coinage = `
	<div class="steading-coinage">
		<h3 class="stonetop-move-group-title">Coinage<button type="button" class="stonetop-advice-btn stonetop-advice-btn--inline stonetop-icon-btn" aria-label="advice">?</button></h3>
		<div class="stonetop-panel-divider" aria-hidden="true"></div>
		<table class="steading-coinage-table">
			<thead><tr><th scope="col" class="steading-coinage-corner">Currency</th><th scope="col">Purses</th><th scope="col">Handfuls</th><th scope="col">Coins</th></tr></thead>
			<tbody>
				${["Silver", "Gold"].map(name => `<tr><th scope="row" class="steading-coinage-name">${name}</th>${coinCell(0)}${coinCell(0)}${coinCell(0)}</tr>`).join("")}
			</tbody>
		</table>
	</div>`;

const notes = `
	<div class="steading-notes-field steading-block">
		<h3 class="stonetop-move-group-title">Notes</h3>
		<div class="stonetop-panel-divider" aria-hidden="true"></div>
		<textarea class="stonetop-notes stonetop-grow-field" placeholder="Notes"></textarea>
	</div>`;

// The book's whisky jugs, at the intrinsic size the extracted plate actually has (650x431) — the
// ratio is what decides how much of the column the picture takes, and a square stand-in would
// overstate it by half. An empty SVG rather than a pixel, since only the box is being measured.
const PLATE_SRC =
	"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='650'%20height='431'%3E%3C/svg%3E";

const plate = `
	<figure class="steading-resources-plate">
		<img src="${PLATE_SRC}" alt="">
	</figure>`;

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
const fixture = (width, { shut = false, lean = false, heavy = false, plated = true } = {}) => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
   <div class="stonetop-rail-layout${shut ? " rail-shut" : ""}" data-side="left">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="false" aria-label="Rail"><i class="fas fa-archway"></i></button>
    <div class="stonetop-rail steading-rail" data-density="full">
      <div class="steading-archpair">
        ${fullTile("fortunes", "Fortunes", { arched: true })}
        ${fullTile("surplus", "Surplus", { arched: true, rollable: false })}
      </div>
      <!-- The moves the rail also carries. Only their WIDTH matters here: they fill the rail's
           content box, so they are what "centred over its column" is measured against. -->
      <div class="stonetop-move-group"><h3 class="stonetop-move-group-title">Homefront Moves</h3></div>
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
        <!-- The book's order, with the MARKED one in the middle: a fixture that lists the marked
             condition first cannot tell a row that holds still from one that sorts it to the front. -->
        <div class="steading-conditions">
          ${condition("diminished", false, "disadvantage to Deploy, Muster, or Pull Together")}
          ${condition("lacking", true, "treat Prosperity as if it's 1 lower than it is")}
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
            ${notes}
            ${plated ? plate : ""}
          </section>
          <section class="steading-overview-column">
            ${fullTile("defenses", "Defenses", { note: "legendary" })}
            ${list("defenses", "Fortifications, etc.", heavy
              ? ["Village militia", "The Ringwall (low, stone)", "Three watchtowers", "Spears & shields in every home", "Some bows", "A beacon on the Old Wall"]
              : ["Village militia", "The Ringwall (low, stone)"])}
            ${lean ? "" : assetsField(["A pair of horse-drawn plows, iron", "A wagon (plus horse harness)"]) + coinage}
          </section>
        </div>
      </div>
    </section>
   </div>
   </div>
  </div></div>
</div>`;

const ARCH_STEPPER =
	'.steading-rail .steading-archpair .steading-tile[data-attr="fortunes"] .stonetop-stepper';

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
	debility1:      ".steading-conditions > .steading-debility:nth-of-type(1)",
	debility2:      ".steading-conditions > .steading-debility:nth-of-type(2)",
	debility3:      ".steading-conditions > .steading-debility:nth-of-type(3)",
	markedEffect:   ".steading-debility.is-active .steading-debility-effect",
	unmarkedEffect: ".steading-debility:not(.is-active) .steading-debility-effect",
	notes:          ".steading-play-grid .steading-notes-field",
	notesBox:       ".steading-play-grid .steading-notes-field textarea",
	plate:          ".steading-play-grid .steading-resources-plate",
	plateImg:       ".steading-play-grid .steading-resources-plate img",
	coinTable:      ".steading-coinage-table",
	head:           '.steading-play-grid .steading-tile[data-attr="prosperity"]',
	headLabel:      '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-label',
	headValue:      '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-value',
	headNote:       '.steading-play-grid .steading-tile[data-attr="prosperity"] .steading-tile-note',
	archTile:       '.steading-archpair .steading-tile[data-attr="fortunes"]',
	archTile2:      '.steading-archpair .steading-tile[data-attr="surplus"]',
	arch:           '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-arch',
	archName:       '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-tile-label',
	archValue:      '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-tile-value',
	archPair:       ".steading-rail .steading-archpair",
	railMoves:      ".steading-rail .stonetop-move-group",
	archName2:      '.steading-archpair .steading-tile[data-attr="surplus"] .steading-tile-label',
	archValue2:     '.steading-archpair .steading-tile[data-attr="surplus"] .steading-tile-value',
	lineRollDie:    '.steading-line .steading-tile[data-attr="prosperity"] .steading-roll-die',
	lineStepUp:     '.steading-line .steading-tile[data-attr="prosperity"] .stonetop-stepper-btn--up',
	// All three addressed through the SAME stepper, spelled the same way. They used to differ — the
	// input was reached via `.steading-rail`, the two buttons were not — which left the harness free
	// to resolve them against different tiles.
	archInput:      `${ARCH_STEPPER} .steading-attr-input`,
	archStepUp:     `${ARCH_STEPPER} .stonetop-stepper-btn--up`,
	archStepDown:   `${ARCH_STEPPER} .stonetop-stepper-btn--down`,
};

// The probe's window is ~768px by default, so a fixture wider than that is clipped by the viewport
// rather than laid out — and every container query answers to the viewport instead of the width
// under test. Size the window to match.
const measureAt = (width, options) => probe.measure({
	bodyHtml: fixture(width, options), bodyClass: "theme-light",
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

			// The rating reads as one line, the way it is said aloud: "Prosperity, lacking, 2". The note
			// used to take a row of its own under the value, where it sat level with the heading of the
			// list below and read as a caption on the wrong thing — and cost a row of height on the
			// tiles that had one and none on the tiles that didn't, so the two columns fell out of step.
			//
			// What keeps it from reading as a second number is its POSITION — hard against the name it
			// qualifies, nowhere near the right edge where the value lives — so that is what is asserted
			// here, along with the one rule that still closes the whole head.
			it("sets each rating on one line: name, then its note, then the value", () => {
				const head  = m.get("head").values;
				const label = m.get("headLabel").values;
				const note  = m.get("headNote").values;
				const value = m.get("headValue").values;

				const overlap = Math.min(note.boxTop + note.boxHeight, value.boxTop + value.boxHeight)
					- Math.max(note.boxTop, value.boxTop);
				expect(overlap, "the note is not on the value's line").toBeGreaterThan(0);

				expect(note.boxLeft, "the note is not after the name")
					.toBeGreaterThanOrEqual(label.boxLeft + label.boxWidth - 1);
				expect(note.boxLeft + note.boxWidth, "the note runs into the value")
					.toBeLessThanOrEqual(value.boxLeft + 1);

				// One rule closes the head, and the note is inside it rather than hanging below.
				expect(note.boxTop + note.boxHeight).toBeLessThanOrEqual(head.boxTop + head.boxHeight + 1);
			});

			it("makes the arch, its name, its value and its bar one object of one width", () => {
				const tile = m.get("archTile").values;
				for (const part of ["arch", "archName", "archValue"]) {
					const p = m.get(part).values;
					expect(p.boxWidth, `${part} is not the arch tile's width`).toBeCloseTo(tile.boxWidth, 0);
				}
			});

			// Fortunes rolls and Surplus does not, so one name is a <button> and the other a <span> —
			// and core sizes every button to a fixed height, unlayered. That put Fortunes' whole value
			// row 7px below Surplus's: the two numbers the book crowns side by side, out of level.
			//
			// The NAMES and the VALUES, not just the tiles: two tiles can start and end together while
			// the rows inside them sit at different depths, which is the shape the defect took.
			// The pair takes the whole column it heads. Capped under it, the arches sat in a margin of
			// empty rail down both sides while the moves beneath them ran edge to edge, and the two
			// ratings the book CROWNS read as the smallest thing in their own column.
			//
			// Measured against the MOVES, not against the rail's border box: the rail carries a right
			// gutter, so "fills the rail" and "fills the column" are 12px apart and only the second is
			// what a reader sees.
			it("gives the arch pair the full width of the column it heads", () => {
				const pair  = m.get("archPair").values;
				const moves = m.get("railMoves").values;
				expect(pair.boxLeft, "the arch pair does not start where the column does")
					.toBeCloseTo(moves.boxLeft, 0);
				expect(pair.boxWidth, "the arch pair is narrower than the column it heads")
					.toBeCloseTo(moves.boxWidth, 0);
			});

			it("keeps the two arches level, though only one of them rolls", () => {
				for (const [a, b] of [["archTile", "archTile2"], ["archName", "archName2"], ["archValue", "archValue2"]]) {
					expect(m.get(a).values.boxTop, `${a} and ${b} start at different depths`)
						.toBeCloseTo(m.get(b).values.boxTop, 0);
					expect(m.get(a).values.boxHeight, `${a} and ${b} are different heights`)
						.toBeCloseTo(m.get(b).values.boxHeight, 0);
				}
			});

			// A name that rolls has to look like one. The die was dropped from the line for room, on
			// the reasoning that its names are the only things on it that respond to a click — a fact
			// about the line that nobody reading it can see.
			// Computed rather than measured: the die is a Font Awesome glyph, and this harness has no
			// icon font — the box is empty either way, so only the cascade can answer whether the line
			// still hides it.
			it("marks a rollable rating on the line with the same die it uses in full", () => {
				const seen = probe.render({
					bodyHtml: fixture(width), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
					probes: {
						lineDie: { selector: TARGETS.lineRollDie, properties: ["display"] },
						archDie: { selector: '.steading-archpair .steading-tile[data-attr="fortunes"] .steading-roll-die', properties: ["display"] },
					},
				});
				expect(seen.get("lineDie").missing, "the line's rollable name has no die at all").toBe(false);
				expect(seen.get("lineDie").get("display"),
					"a rollable rating on the line has nothing saying it rolls").not.toBe("none");
				expect(seen.get("archDie").get("display")).not.toBe("none");
			});

			// The line's carets are hidden at rest — ten permanent arrows across five ratings is noise
			// on the one row that has to stay glanceable — but they are hidden with `visibility`, so
			// they still hold their room. Revealed with `display` they grew the row the instant a
			// pointer crossed a number, and the whole sheet stepped down under it.
			it("has the line's hidden carets hold their room, so hovering never moves the sheet", () => {
				expect(m.get("lineStepUp").values.boxWidth,
					"the line's carets are out of flow, so revealing one re-lays out the row")
					.toBeGreaterThan(0);
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

			// ▾ and ▴ flank the number, so they have to flank it EVENLY — one arrow standing further
			// out than the other reads as a misalignment, which is exactly how it was reported.
			//
			// Stated as "the value carries no margin of its own", because that WAS the bug and it is
			// the only way the gaps can differ: the stepper separates its three children with a single
			// `gap`, which is symmetric by definition, so the one thing that can land on one side and
			// not the other is a margin on the middle child. A `margin-left: 4px` on the line's input
			// did exactly that, inside the stepper, on the ▾ side alone.
			//
			// Computed rather than measured: the arrows are glyphs whose fallback font this harness
			// picks non-deterministically, which moves both boxes by a px or two and says nothing
			// about the rule under test.
			it("gives the value no margin of its own, so the two arrows flank it evenly", () => {
				const seen = probe.render({
					bodyHtml: fixture(1400), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
					probes: {
						lineInput: {
							selector: '.steading-line .steading-tile[data-attr="prosperity"] .steading-attr-input',
							properties: ["margin-left", "margin-right"],
						},
						archInput: { selector: `${ARCH_STEPPER} .steading-attr-input`, properties: ["margin-left", "margin-right", "text-align"] },
					},
				});
				for (const name of ["lineInput", "archInput"]) {
					const el = seen.get(name);
					expect(el.missing, `${name} did not render`).toBe(false);
					expect(el.get("margin-left"), `${name} is pushed off-centre inside its stepper`)
						.toBe(el.get("margin-right"));
				}
				// And the digit itself is centred in its field, so a two-digit value does not crowd one
				// arrow while leaving a hole at the other.
				expect(seen.get("archInput").get("text-align")).toBe("center");
			});
		});
	}

	// ── The measure, and what levels the two columns ───────────────────────────────────────────
	//
	// Play is two columns because a third costs a third of the measure, on exactly the lists this
	// sheet says must never be truncated ("Tradesfolk (midwife, potter, publican, smith, tanner)"
	// begins to wrap at three). So the measure is the thing to hold, and it is held here rather than
	// worked out on paper: the arithmetic was right about the three-column case and still said nothing
	// about what a sibling in the grid would do to it.
	describe("the measure, and the box that closes the shorter column", () => {
		// Derived, not a remembered number: the grid hands its whole width to two equal tracks and a
		// single gap, so anything else taking measure — a third column, a fixed-width sibling — shows
		// up as a column narrower than that share.
		it.each([[1400], [1107]])("gives the whole grid to two equal columns (%ipx)", width => {
			const m = measureAt(width);
			const grid = m.get("grid").values;
			const col1 = m.get("col1").values;
			const col2 = m.get("col2").values;
			const gap  = 1.25 * 16;
			expect(col1.boxWidth, "the two columns are not equal").toBeCloseTo(col2.boxWidth, 0);
			expect(col1.boxWidth, "something else on the tab is taking measure")
				.toBeCloseTo((grid.boxWidth - gap) / 2, 0);
		});

		// The acceptance the tab pass was written against: no worse than it was. 411px is the measure
		// MEASURED on the shipped sheet before this pass, at a 1107px window with the rail open and the
		// root at 16px — the width the three-column option was rejected at. A guard against a column
		// narrowed back toward that measure, not a claim to the half-pixel.
		//
		// 405 rather than the 410 first measured: the tab scroller now reserves the focus ring's reach
		// at its left edge, which the ring was being clipped by, and the two columns split that 3px
		// between them. Deliberate, and the smallest price there is for a ring a keyboard user can see.
		it("is no narrower than the measure it had before the pass", () => {
			expect(measureAt(1107).get("col1").values.boxWidth).toBeGreaterThan(405);
		});

		// The two columns of this tab are different lengths — Prosperity leads eight resources, Defenses
		// leads four fortifications, the assets and the treasury. What used to level them was a
		// decorative plate at the foot of the shorter one; what levels them now is the notes box, which
		// is the one thing on the tab that can use the height it is given.
		it("ends the two columns level, whatever they hold", () => {
			for (const width of [1400, 1107]) {
				const m = measureAt(width);
				expect(m.get("col1").values.boxHeight, `columns fall out of step at ${width}px`)
					.toBeCloseTo(m.get("col2").values.boxHeight, 0);
			}
		});

		// Stated as a comparison rather than a height, because the whole point is that nothing measures
		// anything: lengthen the other column and the box grows with it; shorten it and the box gives
		// the height back. Measured against a LONGER right column rather than against the shipped one,
		// because the tab as shipped need not have any slack to hand out at all — the left column also
		// carries the plate — and a claim about what happens to the slack has to be made where there
		// is some.
		it("grows the notes box by exactly the slack the other column leaves", () => {
			const heavy = measureAt(1107, { heavy: true });
			const full  = measureAt(1107);
			const lean  = measureAt(1107, { lean: true });
			expect(heavy.get("notesBox").values.boxHeight,
				"the notes box does not take up the other column's height")
				.toBeGreaterThan(full.get("notesBox").values.boxHeight);
			expect(full.get("notesBox").values.boxHeight,
				"the notes box keeps height the other column no longer needs")
				.toBeGreaterThanOrEqual(lean.get("notesBox").values.boxHeight);
		});

		// And a floor, for the steading with few resources and for the folded single-column width,
		// where there is no slack to take: an empty box one line tall is not one you write in.
		it("never falls below a box worth writing in", () => {
			for (const m of [measureAt(1107, { lean: true }), measureAt(500)]) {
				expect(m.get("notesBox").values.boxHeight).toBeGreaterThanOrEqual(6 * 16 - 1);
			}
		});

		// A box this size has to SAY it is one, and it says it as a BOX — the frame core gives a
		// textarea, kept rather than stripped, plus a placeholder naming what goes on it.
		//
		// It was ruled like a printed page for a while (eight grey lines: a box pretending to be
		// paper), and then stripped to the sheet's one-rule idiom with the frame taken off. Beside
		// the Places tab that read as the one writing surface somebody had rubbed out, since the note
		// on every neighbouring place is a box you can see the edges of. So the two are one field
		// now — steading-notes-box.test.js is where that equality is held; this only asserts that the
		// scratchpad is framed at all, and still grows.
		it("says it is somewhere to write, as a box", () => {
			const seen = probe.render({
				bodyHtml: fixture(1107), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
				probes: {
					notes: {
						selector: ".steading-play-grid .steading-notes-field textarea",
						properties: ["background-image", "border-bottom-width", "border-top-width",
							"box-shadow", "border-radius", "field-sizing"],
					},
				},
			});
			const notes = seen.get("notes");
			expect(notes.missing, "the notes box did not render").toBe(false);
			// The ruling is gone — no lined paper painted behind the text.
			expect(notes.get("background-image"), "the writing area is still ruled").toBe("none");
			// The frame closes on every side, which is what tells it apart from a rule to write on.
			expect(parseFloat(notes.get("border-bottom-width"))).toBeGreaterThan(0);
			expect(parseFloat(notes.get("border-top-width"))).toBeGreaterThan(0);
			expect(notes.get("box-shadow"), "core's inset box is not drawn round it").not.toBe("none");
			expect(parseFloat(notes.get("border-radius"))).toBeGreaterThan(0);
			// And it grows with what is written in it, like every other note on these sheets.
			expect(notes.get("field-sizing"), "the box does not grow with its text").toBe("content");
		});

		// ── The plate that closes the column ──
		//
		// The book's whisky jugs, under the Resources list because that list's "Distilling (whisky)"
		// line is what they draw. Decoration, so every claim here is about it staying out of the way:
		// it goes last, it is capped, and it does not become what levels the columns.
		describe("the plate under the Resources list", () => {
			it("closes the column, below everything written in it", () => {
				const m = measureAt(1107);
				const notesBottom = m.get("notes").values.boxTop + m.get("notes").values.boxHeight;
				expect(m.get("plate").values.boxTop,
					"the plate is not the last thing in the column").toBeGreaterThanOrEqual(notesBottom);
			});

			// Capped at the vignette's width rather than the column's. At full width it ran over 500px
			// of dense woodcut under a list of five short lines — the heaviest thing on the tab,
			// illustrating the least.
			it("stays a vignette rather than filling the column's width", () => {
				const m = measureAt(1107);
				expect(m.get("plateImg").values.boxWidth).toBeLessThanOrEqual(15 * 16);
				expect(m.get("plateImg").values.boxWidth,
					"the plate is as wide as the column it closes")
					.toBeLessThan(m.get("col1").values.boxWidth * 0.75);
			});

			// The notes box is still what absorbs the difference between the two columns; the picture is
			// a fixed object that the box makes room for. Stated as "the plate does not move": were it
			// the flexible one, a longer right column would stretch it and the sheet would breathe a
			// woodcut in and out as resources were added.
			it("keeps its size while the notes box takes the slack", () => {
				const heavy = measureAt(1107, { heavy: true });
				const full  = measureAt(1107);
				expect(heavy.get("plateImg").values.boxHeight, "the plate flexes with the column")
					.toBeCloseTo(full.get("plateImg").values.boxHeight, 0);
				expect(heavy.get("notesBox").values.boxHeight,
					"the notes box is not the one taking the slack")
					.toBeGreaterThan(full.get("notesBox").values.boxHeight);
			});

			// And it is the plate's height the notes box gave up to make room for it.
			it("takes its room from the notes box, not from the tab", () => {
				const plated   = measureAt(1107, { heavy: true });
				const unplated = measureAt(1107, { heavy: true, plated: false });
				expect(plated.get("col1").values.boxHeight, "the plate made the tab taller")
					.toBeCloseTo(unplated.get("col1").values.boxHeight, 0);
				expect(plated.get("notesBox").values.boxHeight,
					"the notes box did not give up the height the plate took")
					.toBeLessThan(unplated.get("notesBox").values.boxHeight);
			});
		});
	});

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

		// The rail is the reader's to put away at any width, and the two ratings it was carrying are
		// already in the line's markup — so shutting it reveals them rather than moving them. If this
		// fails, collapsing the rail on a wide sheet loses Fortunes and Surplus entirely.
		it("gives them back when the reader shuts the rail at a wide width", () => {
			const m = measureAt(1400, { shut: true });
			expect(m.get("rail").values.boxWidth, "the shut rail still takes room").toBe(0);
			expect(m.get("railedLineTile").values.boxWidth,
				"Fortunes is on neither the rail nor the line").toBeGreaterThan(0);
		});

		it("keeps Size out of the ledger and in its own pill", () => {
			expect(measureAt(1400).get("sizePill").values.boxWidth).toBeGreaterThan(0);
		});
	});

	// A condition explains itself when it is MARKED, at every width, and never otherwise.
	describe("the conditions", () => {
		// Not width-keyed in either direction: an explanation that arrives because the window got
		// wider is explaining something nothing is doing.
		it("says nothing about an unmarked condition, however much room there is", () => {
			const m = measureAt(1660);
			expect(m.get("markedEffect").values.boxWidth).toBeGreaterThan(0);
			expect(m.get("unmarkedEffect").values.boxWidth,
				"an unmarked condition explained itself because the sheet was wide").toBe(0);
		});

		// The marked one used to be sorted to the front, which meant that ticking a circle moved the
		// control out from under the pointer that had just clicked it and shuffled the other two past
		// it — for a row of three items whose whole value is being in the same place every time.
		// The fixture marks the MIDDLE condition, so a row that re-sorts fails this.
		it("leaves the conditions in the book's order, marked or not", () => {
			const m = measureAt(1660);
			const lefts = ["debility1", "debility2", "debility3"].map(n => m.get(n).values.boxLeft);
			expect(lefts, "marking a condition re-sorted the row").toEqual([...lefts].sort((a, b) => a - b));
			expect(m.get("debility2").values.boxLeft,
				"the marked condition was sorted to the front").toBeGreaterThan(lefts[0]);
		});

		// A steading marks these rarely, and when it does, "what does lacking do again?" is the very
		// next question at the table — so the condition bending every roll says so at any width, down
		// to the narrowest anyone would use.
		it("keeps the marked condition's explanation at the narrowest width", () => {
			const m = measureAt(900);
			expect(m.get("unmarkedEffect").values.boxWidth).toBe(0);
			expect(m.get("markedEffect").values.boxWidth,
				"the condition currently bending every roll stopped saying what it does").toBeGreaterThan(0);
		});
	});
});
