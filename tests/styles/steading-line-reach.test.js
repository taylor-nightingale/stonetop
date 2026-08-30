import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * Every control on the ledger line must be REACHABLE at every sheet width.
 *
 * The line was first built the way the mockup drew it — one row, `overflow: hidden`, truncating
 * from the right. That is correct for a status display and wrong here: the line carries the
 * debility checkboxes and the roll-mode radios, and a clipped control is not merely invisible. It
 * cannot be tabbed to, marked or cleared at all. On a narrow sheet there was no way to set a
 * debility.
 *
 * So the line wraps rather than clips, and sheds TEXT (notes, then whole label words) to stay one
 * row for as long as it honestly can. This measures the invariant that matters: at the narrowest
 * width anyone would plausibly use, every control is still inside the box.
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

const rating = (attr, label, value, note = "") => `
	<div class="steading-tile" data-attr="${attr}">
		<span class="steading-tile-label">
			<button type="button" class="steading-stat-roll rollable" data-roll="${attr}">
				<span class="steading-title-full">${label}</span><span class="steading-title-short" aria-hidden="true">${label.slice(0, 4)}</span>
			</button>
		</span>
		<span class="steading-tile-value">
			<span class="stonetop-stepper">
				<input type="number" class="stonetop-step steading-attr-input" data-attr="${attr}" value="${value}">
			</span>
		</span>
		${note ? `<span class="steading-tile-note steading-tile-note--tier">${note}</span>` : ""}
	</div>`;

const condition = (slug, active) => `
	<label class="steading-debility${active ? " is-active" : ""}">
		<input class="steading-circle-input" type="checkbox" data-slug="${slug}"${active ? " checked" : ""}>
		<span class="steading-circle" aria-hidden="true"></span>
		<span class="steading-debility-text">
			<span class="steading-debility-name">${slug}</span>
			<span class="steading-debility-effect">an effect of a realistic length that will not fit</span>
		</span>
	</label>`;

const fixture = width => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
    <div class="steading-season-band"></div>
    <header class="sheet-header steading-line" data-density="line">
      <div class="steading-line-row steading-line-values">
      <div class="steading-identity">
        <span class="stonetop-combo steading-steadfast-combo">
          <input type="text" class="steading-steadfast-input stonetop-combo-input" value="Stonetop">
        </span>
        <div class="steading-tile" data-attr="size">
          <span class="steading-tile-label"><span class="steading-tile-title">Size</span></span>
          <span class="steading-tile-value"><select class="steading-attr-input steading-tile-select"><option selected>village</option></select></span>
        </div>
      </div>
      <div class="steading-ledger">
        ${rating("fortunes", "Fortunes", "2")}
        ${rating("surplus", "Surplus", "2")}
        ${rating("population", "Population", "1")}
        ${rating("prosperity", "Prosperity", "3")}
        ${rating("defenses", "Defenses", "3", "legendary")}
      </div>
      </div>
      <div class="steading-line-row steading-line-conditions">
      <div class="steading-conditions">
        ${condition("diminished", false)}
        ${condition("lacking", true)}
        ${condition("malcontent", false)}
      </div>
      <fieldset class="steading-rollmode">
        <legend class="steading-line-heading">Roll Mode</legend>
        <label class="steading-rollmode-option"><input type="radio" class="steading-rollmode-input" name="rm" value="adv"><span>Advantage</span></label>
        <label class="steading-rollmode-option is-checked"><input type="radio" class="steading-rollmode-input" name="rm" value="normal" checked><span>Normal</span></label>
        <label class="steading-rollmode-option"><input type="radio" class="steading-rollmode-input" name="rm" value="dis"><span>Disadvantage</span></label>
      </fieldset>
      </div>
    </header>
  </div></div>
</div>`;

const TARGETS = {
	line:       ".steading-line",
	firstValue: '.steading-tile[data-attr="fortunes"] .steading-attr-input',
	lastValue:  '.steading-tile[data-attr="defenses"] .steading-attr-input',
	size:       ".steading-tile-select",
	cond1:      '.steading-debility [data-slug="diminished"]',
	cond3:      '.steading-debility [data-slug="malcontent"]',
	mode1:      '.steading-rollmode-option:first-of-type',
	mode3:      '.steading-rollmode-option:last-of-type',
};

const CONTROLS = ["firstValue", "lastValue", "size", "cond1", "cond3", "mode1", "mode3"];

describe.skipIf(!canProbe())("every control on the ledger line stays reachable", () => {
	// A window narrow enough to be uncomfortable but not absurd — the case that broke.
	for (const width of [1280, 900, 700]) {
		describe(`at ${width}px`, () => {
			let measured;
			beforeAll(() => {
				measured = probe.measure({
					bodyHtml: fixture(width), bodyClass: "theme-light",
					rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
				});
			});

			it("renders every control", () => {
				for (const name of CONTROLS) {
					expect(measured.get(name).missing, `${name} did not render`).toBe(false);
				}
			});

			// The invariant. A control outside the line's box has been clipped away, and a clipped
			// checkbox cannot be tabbed to or ticked.
			it("keeps every control inside the line", () => {
				const line = measured.get("line").values;
				const lineRight = line.boxLeft + line.boxWidth;
				for (const name of CONTROLS) {
					const el = measured.get(name).values;
					expect(el.boxLeft + el.boxWidth, `${name} is clipped past the line's right edge`)
						.toBeLessThanOrEqual(lineRight + 1);
				}
			});
		});
	}
});
