import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe, pseudoAsClass } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

// Reported: with an insert's tab, eight tabs, the labels ran over their tabs' frames; overlapping
// them like cards read as a bug. Now a tab never shrinks: those the strip has no room for are listed
// under "More" at its end. TabStripFit decides which (unit- and integration-tested); these fixtures
// are the strip as it leaves it, and measure what the stylesheet then draws.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)), { transformCss: pseudoAsClass("hover") });

const REVENANT = { _id: "revenant-item", type: "insert", name: "Revenant",
	system: { slug: "revenant", description: "Back from the dead.", choiceValues: {}, choices: [] } };

let HTML;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder().withPlaybook("the-fox")
		.withItems([new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build(), REVENANT])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory())).build();
	const stonetop = await actor.typedActor.buildSnapshot();
	const sheetClass = (await import("../../src/actors/character/StonetopCharacterSheet.js")).createStonetopCharacterSheetClass(class {
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
	});
	// Core names a fixed tab from the config's prefix and localizes it before the template sees it.
	const config = new sheetClass()._getTabsConfig("primary");
	const tabs = Object.fromEntries(config.tabs.map(t => [t.id, { ...t,
		label: t.label ?? game.i18n.format(`${config.labelPrefix}.${t.id}`, {}), cssClass: t.id === "playbook" ? "active" : "" }]));
	HTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", {
		tabs, actor, editable: true, viewFlags: {}, sheetIdPrefix: "s1", stonetop,
	});
});

const sheet = (width, state = "") => `
<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 900px">
 <div class="window-content">${HTML.replace('class="stonetop-rail-layout"', `class="stonetop-rail-layout ${state}"`)}</div>
</div>`;

const TABS = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`tab${i + 1}`, `.sheet-tabs > .item:nth-child(${i + 1})`]));
const right = v => v.boxLeft + v.boxWidth;

// The strip as TabStripFit leaves it with the last `listed` tabs under More, and the menu open.
const fitted = (html, listed) => {
	let out = html;
	const ids = [...html.matchAll(/class="item [^"]*" data-action="tab" data-group="primary" data-tab="([^"]+)"/g)].map(m => m[1]);
	for (const id of ids.slice(-listed)) {
		out = out.replace(`data-tab="${id}">`, `data-tab="${id}" hidden>`)
			.replace(`class="stonetop-tab-more-item" data-action="tab" data-group="primary" data-tab="${id}" data-view-state hidden`,
				`class="stonetop-tab-more-item" data-action="tab" data-group="primary" data-tab="${id}" data-view-state`);
	}
	return out.replace('<div class="stonetop-tab-more" hidden>', '<div class="stonetop-tab-more">')
		.replace(/(class="stonetop-tab-more-menu" id="[^"]+") hidden/, "$1")
		.replace('aria-expanded="false" aria-controls="s1-tab-more"', 'aria-expanded="true" aria-controls="s1-tab-more"');
};

const measure = (html, width, targets) => probe.measure({
	bodyHtml: html, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets, chromeFlags: [`--window-size=${width + 60},1000`],
});

describe.skipIf(!canProbe())("the tab strip with eight tabs", () => {
	it("draws every tab whole, apart, and no More, with room for all of them", () => {
		const m = measure(sheet(1500, "rail-shut"), 1500, { ...TABS, more: ".stonetop-tab-more" });
		for (let i = 1; i <= 8; i++) {
			expect(m.get(`tab${i}`).overflowX, `tab${i}`).toBe(0);
			if (i > 1) expect(m.get(`tab${i}`).values.boxLeft).toBeGreaterThanOrEqual(right(m.get(`tab${i - 1}`).values));
		}
		expect(m.get("more").values.boxWidth).toBe(0);
	});

	describe("with four of them under More, its menu open", () => {
		let m;
		beforeAll(() => {
			m = measure(fitted(sheet(720, "rail-shut"), 4), 720, {
				...TABS, strip: ".character-main > .sheet-tabs", more: ".stonetop-tab-more-btn",
				menu: ".stonetop-tab-more-menu", entry: ".stonetop-tab-more-item:not([hidden])",
				sheet: ".application", tabBody: ".character-main > .sheet-body",
			});
		});

		it("draws the tabs it keeps whole and apart, and the ones under More not at all", () => {
			for (let i = 1; i <= 4; i++) expect(m.get(`tab${i}`).overflowX, `tab${i}`).toBe(0);
			for (let i = 2; i <= 4; i++) expect(m.get(`tab${i}`).values.boxLeft).toBeGreaterThanOrEqual(right(m.get(`tab${i - 1}`).values));
			for (let i = 5; i <= 8; i++) expect(m.get(`tab${i}`).values.boxWidth, `tab${i}`).toBe(0);
		});

		it("sets More after the last tab kept, inside the strip", () => {
			expect(m.get("more").values.boxLeft).toBeGreaterThanOrEqual(right(m.get("tab4").values));
			expect(right(m.get("more").values)).toBeLessThanOrEqual(right(m.get("strip").values) + 0.5);
		});

		it("hangs the menu under More, over the tab and inside the sheet, each entry whole", () => {
			const menu = m.get("menu").values;
			expect(menu.boxTop).toBeGreaterThanOrEqual(m.get("more").values.boxTop + m.get("more").values.boxHeight - 1);
			expect(right(menu)).toBeLessThanOrEqual(right(m.get("sheet").values));
			expect(m.get("entry").overflowX).toBe(0);
		});
	});
});
