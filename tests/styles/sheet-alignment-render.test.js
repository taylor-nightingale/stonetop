import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

// The whole character sheet, measured for one left edge: the name, the stats, the tab strip and the
// tab's content all start the same distance from the rail. The rail's tab
// sits inside that inset, so opening or shutting the rail moves none of them — the band's inset was
// once the only one, and below the breakpoint the tab pushed the whole column over by its width.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

let HTML;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const playbook = new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox")
		.withInstinct({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "take", text: "To take what isn't yours" }] }] })
		.withChoiceValues({ instinct: { take: 1 } }).build();
	const actor = new FakeCharacterActorBuilder().withPlaybook("the-fox").withItems([playbook])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory())).build();
	HTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", {
		tabs: { playbook: { cssClass: "active" } }, actor, editable: true, viewFlags: {}, sheetIdPrefix: "s1",
		stonetop: await actor.typedActor.buildSnapshot(),
	});
});

const sheet = (width, state) => `
<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 900px">
 <div class="window-content">${HTML.replace('class="stonetop-rail-layout"', `class="stonetop-rail-layout ${state}"`)}</div>
</div>`;

const TARGETS = {
	name: ".charname", stat: ".stonetop-stat", tab: ".sheet-tabs .item", section: ".tab.active .stonetop-section-columns",
	main: ".stonetop-rail-main", toggle: ".stonetop-rail-toggle",
};

const measure = (width, state) => probe.measure({
	bodyHtml: sheet(width, state), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets: TARGETS, chromeFlags: [`--window-size=${width + 60},1000`],
});

const left = (m, name) => m.get(name).values.boxLeft;
const right = (m, name) => left(m, name) + m.get(name).values.boxWidth;

describe.skipIf(!canProbe())("the character sheet's one left edge", () => {
	const STATES = { open: [1100, ""], shut: [1100, "rail-shut"], drawer: [800, ""], drawerOpen: [800, "rail-open"] };
	const m = {};
	beforeAll(() => { for (const [name, [width, state]] of Object.entries(STATES)) m[name] = measure(width, state); });

	it("renders", () => {
		for (const state of Object.keys(STATES))
			for (const [name, el] of m[state]) expect(el.missing, `${state}: ${name} did not render`).toBe(false);
	});

	it("starts the name, the stats, the tab strip and the tab's content on one line", () => {
		for (const state of Object.keys(STATES)) {
			const edge = left(m[state], "name");
			for (const name of ["stat", "tab", "section"])
				expect(left(m[state], name), `${state}: ${name}`).toBeCloseTo(edge, 0);
		}
	});

	// An open drawer lies over the column, and its tab rides the drawer's edge over it too.
	it("keeps the rail's tab inside that inset, over none of it", () => {
		for (const state of ["open", "shut", "drawer"])
			expect(right(m[state], "toggle"), state).toBeLessThanOrEqual(left(m[state], "name"));
	});

	it("moves nothing in the tab's column when a drawer opens or shuts", () => {
		expect(left(m.drawerOpen, "name")).toBeCloseTo(left(m.drawer, "name"), 0);
		expect(left(m.drawer, "main")).toBeCloseTo(left(m.drawer, "toggle"), 0);
	});

	it("starts the column at the rail's own edge, with no gap beside it", () => {
		expect(left(m.open, "main")).toBeCloseTo(left(m.open, "toggle"), 0);
		expect(left(m.shut, "main")).toBeCloseTo(left(m.shut, "toggle"), 0);
	});
});

// SC 2.5.8: the tab is drawn narrow and pressed across 24px of the inset.
describe.skipIf(!canProbe())("the rail's tab as a target", () => {
	it("is 24px across to the pointer", () => {
		const m = probe.render({
			bodyHtml: sheet(1100, ""), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1160,1000"],
			probes: {
				target: { selector: ".stonetop-rail-toggle", pseudo: "::after", properties: ["width", "height", "position"] },
				tab:    { selector: ".stonetop-rail-toggle", properties: ["overflow"] },
			},
		});
		expect(parseFloat(m.get("target").get("width"))).toBeGreaterThanOrEqual(24);
		expect(parseFloat(m.get("target").get("height"))).toBeGreaterThanOrEqual(24);
		expect(m.get("target").get("position")).toBe("absolute");
		expect(m.get("tab").get("overflow")).toBe("visible");
	});
});
