import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";

/**
 * The Content tab's split, measured rather than read off the stylesheet.
 *
 * The tab makes two geometric claims, and neither can be settled by a text scan of the CSS:
 *
 *  1. The lists take the wider half. They hold phrases the table wrote — a name and a sentence about
 *     it — while the procedure beside them is fixed copy of a known length. A 1 : 1 split spends the
 *     measure on the half that never needed it.
 *  2. The procedure is a panel of its own beside them, wrapping inside its column rather than out of
 *     it. A quoted block that overflows is the one failure that would make the tab look broken rather
 *     than merely cramped.
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

const section = (slug, label, note, items, index) => renderPartial("stonetop.steading-content-list", {
	index, section: { slug, label: { raw: label }, note: { raw: note }, items },
});

const procedure = `Keep this in sync with the GM playbook. Review it at the start of each session.<br /><br />When <strong><em>anyone calls &ldquo;time out,&rdquo;</em></strong> play stops. Step out of character, check in with each other, maybe take a break. Discuss what&rsquo;s wrong, player-to-player.<br /><br />When everyone is ready, move on.`;

// Mirrors the Content panel of steading.hbs, through the partials it renders.
const fixture = `
<div class="application stonetop sheet actor steading themed theme-light">
	<div class="window-content"><div class="sheet-wrapper"><section class="sheet-body">
	<div class="steading-split-grid steading-content-grid" style="width: 880px">
		<section class="steading-split-column">
			${section("excluded", "Excluded Content", "(Not part of the game, on-camera or off)", ["Harm to children, on screen", "Sexual violence"], 0)}
			${section("veiled", "Veiled Content", "(Part of the fiction, but only off-camera)", ["Torture"], 1)}
			${section("specialHandling", "Special Handling", "", ["Tegwen — check in before a scene with her"], 2)}
		</section>
		<section class="steading-split-column">
			<section class="stonetop-panel">
				${renderPartial("stonetop.bar", { title: "From the playbook", index: 3 })}
				<div class="stonetop-panel-body steading-content-procedure stonetop-rich">${procedure}</div>
			</section>
		</section>
	</div>
	</section></div></div>
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

	// Three panels in one column: without a gap between them the second bar sits directly on the last
	// row of the list above it, and the three read as one long list.
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
