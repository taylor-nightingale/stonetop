// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { createStonetopSteadingSheetClass } from "../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";
import { stonetopActorSheetBase } from "../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../fakes/renderTemplate.js";

// The steading sheet, whole, measured for the structure it shares with the character sheet: one left
// edge for the ledger line, the tab strip and the tab's content; tabs drawn whole, with those the
// strip has no room for under "More" and the sheet's ? after it; and the rail's move groups as
// panels, each with an ink bar and a caret.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

let HTML;
beforeAll(async () => {
	const actor = new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository()
		.addBasic(new FakeCompendiumMoveBuilder().withName("Bolster").withMoveType("homefront")
			.withDescription("When you **_prepare for what's coming_**, say how.").build());
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: { getBySlug: async () => null }, moves: repo }));
	await actor.typedActor.onCreate();
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "st1";
	const context = await sheet._prepareContext({});
	// Core names a fixed tab from the config's prefix and localizes it before the template sees it.
	for (const tab of Object.values(context.tabs ?? {})) tab.label = game.i18n.format(tab.label, {});
	HTML = renderTemplate("systems/stonetop/templates/actor/steading.hbs", context);
});

const sheet = (width, state = "") => `
<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px; height: 900px">
 <div class="window-content">${HTML.replace('class="stonetop-rail-layout"', `class="stonetop-rail-layout ${state}"`)}</div>
</div>`;

const measure = (width, state, targets) => probe.measure({
	bodyHtml: sheet(width, state), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets, chromeFlags: [`--window-size=${width + 60},1000`],
});

const right = v => v.boxLeft + v.boxWidth;

describe.skipIf(!canProbe())("the steading's one left edge", () => {
	for (const [width, state, name] of [[1300, "", "rail open"], [1300, "rail-shut", "rail shut"], [800, "", "a drawer"]]) {
		it(`starts the ledger line, the tab strip and the tab's content on one line (${name})`, () => {
			const m = measure(width, state, {
				line: ".steading-main > .steading-line", tab: ".steading-main > .sheet-tabs .item",
				body: ".steading-main > .sheet-body", strip: ".steading-main > .sheet-tabs", main: ".steading-main",
			});
			for (const [key, el] of m) expect(el.missing, key).toBe(false);
			const edge = m.get("main").values.boxLeft + 24;
			expect(m.get("tab").values.boxLeft, "the first tab").toBeCloseTo(edge, 0);
			expect(m.get("line").textLeft, "the ledger line").toBeCloseTo(edge, 0);
			expect(m.get("body").textLeft, "the tab's content").toBeCloseTo(edge, 0);
		});
	}
});

describe.skipIf(!canProbe())("the steading's tab strip", () => {
	const TABS = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`tab${i + 1}`, `.steading-main > .sheet-tabs > .item:nth-child(${i + 1})`]));

	it("draws every tab whole, the ? last", () => {
		const m = measure(1300, "", { ...TABS, advice: ".steading-main > .sheet-tabs .stonetop-advice-btn" });
		for (let i = 1; i <= 6; i++) expect(m.get(`tab${i}`).overflowX, `tab${i}`).toBe(0);
		expect(m.get("advice").values.boxLeft).toBeGreaterThanOrEqual(m.get("tab6").values.boxLeft + m.get("tab6").values.boxWidth);
	});

	// As TabStripFit leaves it with the last two under More: More after the last tab kept, the ? after
	// More, all inside the strip.
	it("sets More after the tabs it keeps and the ? after More", () => {
		const html = sheet(720, "rail-shut");
		const ids = [...html.matchAll(/class="item [^"]*" data-action="tab" data-group="primary" data-tab="([^"]+)"/g)].map(m => m[1]);
		let fitted = html.replace('<div class="stonetop-tab-more" hidden>', '<div class="stonetop-tab-more">');
		for (const id of ids.slice(-2)) fitted = fitted.replace(new RegExp(`(class="item [^"]*" data-action="tab" data-group="primary" data-tab="${id}")`), "$1 hidden");
		const m = probe.measure({ bodyHtml: fitted, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: { tab4: TABS.tab4, tab5: TABS.tab5, more: ".stonetop-tab-more-btn", advice: ".steading-main > .sheet-tabs .stonetop-advice-btn", strip: ".steading-main > .sheet-tabs" },
			chromeFlags: ["--window-size=780,1000"] });
		const r = v => v.boxLeft + v.boxWidth;
		expect(m.get("tab5").values.boxWidth).toBe(0);
		expect(m.get("more").values.boxLeft).toBeGreaterThanOrEqual(r(m.get("tab4").values));
		expect(m.get("advice").values.boxLeft).toBeGreaterThanOrEqual(r(m.get("more").values));
		expect(r(m.get("advice").values)).toBeLessThanOrEqual(r(m.get("strip").values) + 0.5);
	});
});

describe.skipIf(!canProbe())("the steading rail's move groups", () => {
	it("are panels, each headed by an ink bar with a caret", () => {
		const m = probe.render({
			bodyHtml: sheet(1300), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1360,1000"],
			probes: {
				panel: { selector: ".steading-rail .stonetop-panel", properties: ["border-top-style"] },
				bar:   { selector: ".steading-rail .stonetop-panel > .stonetop-bar", properties: ["font-family"] },
				caret: { selector: ".steading-rail .stonetop-panel .stonetop-bar-toggle", properties: ["position"] },
			},
		});
		for (const name of ["panel", "bar", "caret"]) expect(m.get(name).missing, name).toBe(false);
		expect(m.get("panel").get("border-top-style")).toBe("solid");
		expect(m.get("bar").get("font-family")).toContain("StonetopUI");
	});
});
