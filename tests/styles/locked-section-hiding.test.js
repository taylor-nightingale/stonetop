import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// Locked, the playbook tab shows what the character chose and hides what they left empty — a
// heading over blank space is the thing the lock exists to remove. That hiding is pure CSS: a
// section with none of the markers a rendered choice leaves behind gets `display: none`.
//
// The lore block is why this is probed rather than read as text. It carries its own divider above
// the section, so hiding only the section inside it strands a rule across the tab with nothing
// under it — and whether the wrapper itself goes depends on `:is()` and `:has()` resolving in a
// real engine, which no amount of stylesheet parsing can answer.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// A locked playbook tab holding one of each: a lore block the character answered, a lore block they
// left alone, and the same pair as bare sections.
const TAB = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
	<div class="tab playbook is-locked">
		<div class="stonetop-playbook-lore" id="lore-answered">
			<div class="stonetop-panel-divider" aria-hidden="true"></div>
			<div class="stonetop-playbook-columns">
				<div class="details-section stonetop-choice-section" id="section-answered">
					<div class="stonetop-choice-track">… got lost in the Great Wood.</div>
				</div>
			</div>
		</div>
		<div class="stonetop-playbook-lore" id="lore-empty">
			<div class="stonetop-panel-divider" aria-hidden="true"></div>
			<div class="stonetop-playbook-columns">
				<div class="details-section stonetop-choice-section" id="section-empty"></div>
			</div>
		</div>
	</div>
</div></div>`;

describe.skipIf(!canProbe())("a locked tab hides what was left empty", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let probed;
	beforeAll(() => {
		probed = probe.render({
			bodyHtml: TAB,
			bodyClass: "theme-light",
			probes: Object.fromEntries(
				["lore-answered", "lore-empty", "section-answered", "section-empty"]
					.map(id => [id, { selector: `#${id}`, properties: ["display"] }])),
		});
	});

	it("hides a section with nothing chosen in it", () => {
		expect(probed.get("section-empty").get("display")).toBe("none");
	});

	// The wrapper, not just the section inside it: the divider it holds would otherwise stand alone
	// across the tab. Probed on the wrapper because a hidden element's children still compute their
	// own `display` — only the wrapper's own value says the block is gone.
	it("takes the whole lore block, divider and all, when nothing was chosen", () => {
		expect(probed.get("lore-empty").get("display")).toBe("none");
	});

	it("keeps a lore block the character answered", () => {
		expect(probed.get("lore-answered").get("display")).not.toBe("none");
		expect(probed.get("section-answered").get("display")).not.toBe("none");
	});
});
