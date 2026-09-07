import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The attention badge on a board card, settled in a browser.
//
// The card's header is a flex row: a caret-and-name that takes the slack, a meter, a remove button —
// and now a badge between the meter and the button. The risks are the ones a stylesheet read as text
// cannot see: the badge wrapping the header onto a second line, or being squeezed until its word is
// clipped, on the row with the longest improvement name. Both would still leave every rule in the
// file looking correct.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const card = (id, name, { badge = null, extra = "" } = {}) => `
	<div class="steading-improvement-card steading-block ${extra}" id="${id}"
	     data-disclosure-row data-slug="${id}" data-state="progress">
		<div class="steading-improvement-card-top" id="${id}-top">
			<button type="button" class="steading-improvement-disclosure">
				<i class="fas fa-caret-right stonetop-move-caret" aria-hidden="true"></i>
				<span class="steading-improvement-name">${name}</span>
			</button>
			<span class="steading-improvement-meter">
				<span class="steading-improvement-pips" aria-hidden="true">
					<i class="steading-improvement-pip is-on"></i><i class="steading-improvement-pip"></i>
				</span>
				<span class="steading-improvement-count">1 / 2</span>
			</span>
			${badge ? `<span class="steading-improvement-attention" id="${id}-badge">${badge}</span>` : ""}
			<button type="button" class="steading-improvement-remove stonetop-icon-btn">x</button>
		</div>
	</div>`;

// A narrow board is the hard case: the sheet's improvement column, not the whole window.
const FIXTURE = `
<div class="application app stonetop sheet actor steading" style="width: 420px">
  <div class="window-content">
    <div class="steading-board-list">
      ${card("plain", "Mill")}
      ${card("badged", "Trade with the Barrier Pass and Beyond", { badge: "this season" })}
      ${card("dim", "Stone Wall", { badge: "1 to go", extra: "is-untouched" })}
    </div>
  </div>
</div>`;

describe.skipIf(!canProbe())("the board's attention badge", () => {
	const box = new Map();
	const style = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			targets: {
				plainTop: "#plain-top", badgedTop: "#badged-top",
				badge: "#badged-badge", dimBadge: "#dim-badge",
			},
		})) box.set(k, v);

		for (const [k, v] of probe.render({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			probes: { dimCard: { selector: "#dim", properties: ["opacity"] } },
		})) style.set(k, v);
	}, 120000);

	// One line, even on the longest name in the pack. A wrapped header would push every badged row
	// taller than its neighbours and the column would stop scanning.
	it("stays on the header's one line", () => {
		expect(box.get("badgedTop").values.boxHeight)
			.toBeCloseTo(box.get("plainTop").values.boxHeight, 0);
	});

	// `white-space: nowrap` keeps the word whole; `flex: 0 0 auto` is what stops the name eating it.
	it("is not squeezed until its word is clipped", () => {
		expect(box.get("badge").overflowsX).toBe(false);
		expect(box.get("badge").values.boxWidth).toBeGreaterThan(20);
	});

	// An untouched card is dimmed so the board reads as a list of projects rather than a wall — but a
	// dimmed marker is a marker that whispers.
	it("un-dims an untouched card that is asking for something", () => {
		expect(Number(style.get("dimCard").get("opacity"))).toBe(1);
	});
});
