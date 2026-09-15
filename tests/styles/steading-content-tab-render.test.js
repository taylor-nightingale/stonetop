import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The Content tab's split, measured rather than read off the stylesheet.
 *
 * The tab makes two geometric claims, and neither can be settled by a text scan of the CSS:
 *
 *  1. The lists take the wider half. They hold phrases the table wrote — a name and a sentence about
 *     it — while the procedure beside them is fixed copy of a known length. A 1 : 1 split spends the
 *     measure on the half that never needed it.
 *  2. The procedure is an aside, not a field: ruled down its left edge, indented from that rule, and
 *     wrapping inside its column rather than out of it. A quoted block that overflows is the one
 *     failure that would make the tab look broken rather than merely cramped.
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

const entry = text => `
	<div class="steading-attr-row">
		<textarea rows="1" class="stonetop-content-item stonetop-grow-field">${text}</textarea>
		<button class="stonetop-content-item-remove stonetop-icon-btn" type="button"><img alt=""></button>
	</div>`;

const section = (title, note, entries) => `
	<div class="steading-overview-field steading-content-section">
		<h3 class="stonetop-move-group-title">${title}${note ? ` <span class="stonetop-section-note">${note}</span>` : ""}</h3>
		<div class="stonetop-panel-divider" aria-hidden="true"></div>
		<div class="steading-attr-list">
			${entries.map(entry).join("")}
			<button class="stonetop-content-item-add stonetop-list-add" type="button"><img alt=""><span>add</span></button>
		</div>
	</div>`;

// Mirrors the Content panel of steading.hbs.
const fixture = `
<div class="application stonetop sheet actor steading themed theme-light">
	<div class="window-content"><div class="sheet-wrapper">
	<div class="steading-split-grid steading-content-grid" style="width: 880px">
		<section class="steading-split-column">
			${section("Excluded Content", "(Not part of the game, on-camera or off)", ["Harm to children, on screen", "Sexual violence"])}
			${section("Veiled Content", "(Part of the fiction, but only off-camera)", ["Torture"])}
			${section("Special Handling", "", ["Tegwen — check in before a scene with her"])}
		</section>
		<div class="steading-split-divider" aria-hidden="true"></div>
		<section class="steading-split-column">
			<h3 class="stonetop-move-group-title">From the playbook</h3>
			<div class="stonetop-panel-divider" aria-hidden="true"></div>
			<div class="steading-content-procedure stonetop-rich">Keep this in sync with the GM playbook. Review it at the start of each session.<br /><br />When <strong><em>anyone calls &ldquo;time out,&rdquo;</em></strong> play stops. Step out of character, check in with each other, maybe take a break. Discuss what&rsquo;s wrong, player-to-player.<br /><br />When everyone is ready, move on.</div>
		</section>
	</div>
	</div></div>
</div>`;

const TARGETS = {
	lists:     ".steading-content-grid .steading-split-column:first-child",
	aside:     ".steading-content-grid .steading-split-column:last-child",
	procedure: ".steading-content-procedure",
	firstList: ".steading-content-section",
	lastList:  ".steading-content-section:last-child",
};

const measureAt = fontSize => probe.measure({
	bodyHtml: fixture, bodyClass: "theme-light",
	rootAttrs: `style="font-size: ${fontSize}px"`, targets: TARGETS,
	chromeFlags: ["--window-size=1200,1200"],
});

describe.skipIf(!canProbe())("the Content tab's split", () => {
	let m;
	beforeAll(() => { m = measureAt(16); });

	it("renders both halves and the quoted procedure", () => {
		for (const name of Object.keys(TARGETS)) expect(m.get(name).missing, `${name} did not render`).toBe(false);
	});

	it("gives the lists the wider half", () => {
		expect(m.get("lists").values.boxWidth).toBeGreaterThan(m.get("aside").values.boxWidth * 1.2);
	});

	it("keeps the quoted procedure inside its column", () => {
		expect(m.get("procedure").overflowsX).toBe(false);
		const aside = m.get("aside").values, proc = m.get("procedure").values;
		expect(proc.boxLeft + proc.boxWidth).toBeLessThanOrEqual(aside.boxLeft + aside.boxWidth + 1);
	});

	// Three headed blocks in one column: without a gap between them the second heading's rule sits
	// directly under the last row of the list above it, and the three read as one long list.
	it("separates the three lists from one another", () => {
		const first = m.get("firstList").values, last = m.get("lastList").values;
		expect(last.boxTop).toBeGreaterThan(first.boxTop + first.boxHeight);
	});

	// The sheet is sized in rem, so a larger Foundry font step must not put the aside outside its
	// column — the failure a px-tuned indent would produce.
	it("holds at a larger font step", () => {
		const big = measureAt(24);
		expect(big.get("procedure").overflowsX).toBe(false);
		expect(big.get("lists").values.boxWidth).toBeGreaterThan(big.get("aside").values.boxWidth);
	});
});
