import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

// The Moves tab and the Possessions tab, measured while choosing: one box a row in its own column,
// the line saying what taking a move asks under the row's trigger, the count after the name small,
// the owed line inside its panel at the narrow width, and a caret and a door on one bar. The real
// partials over a real character.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const LEVEL_UP = {
	_id: "level-up-id", name: "Level Up", type: "move",
	system: { slug: "level-up", moveType: "homefront",
		description: "When you **_rest_**, follow these steps:\n\n- Subtract XP.\n- Increase your level by 1.\n- Choose a new move from your playbook, or an insert class that you've unlocked.",
		steps: [{ kind: "spend" }, { kind: "advance" }, { kind: "chooseMove", tab: "moves" }] },
};
const FOX = "playbook-the-fox";
const move = (slug, name, { taken = 0, max = 1, order = 0, extra = {} } = {}) => ({
	_id: `m-${slug}`, type: "move", name,
	system: { slug, categoryKey: FOX, categoryLabel: "The Fox", categoryNote: "Choose one move each level.",
		acquired: taken > 0, instanceCount: taken, repeatMax: max, sortOrder: order,
		description: `When you **_${name.toLowerCase()}_**, something happens.`, ...extra },
});
const possession = (slug, name, { selected = false, preselected = false } = {}) => ({
	flags: { stonetop: { grant: { source: "playbook:the-fox", key: `possession:${slug}` } } },
	_id: `${slug}-item`, type: "possession", name,
	system: { slug, description: `${name}: a long line of the gear it gives, which wraps rather than being cut to one line.`,
		resource: null, outfitItems: [], choices: null, scaling: null, selected, preselected, uses: 0, pickValues: {}, choiceUses: {} },
});

let MOVES, POSSESSIONS;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const playbook = new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build();
	playbook.system.specialPossessions = { pickCount: 2, pickNote: "Pick 2", preselected: ["kit"], slugs: ["kit", "ledger"] };
	const actor = new FakeCharacterActorBuilder().withLevel(5).withXp(0, 8).withPlaybook("the-fox")
		.withItems([playbook,
			move("ambush", "Ambush", { taken: 1, extra: { rollStat: "dex" } }),
			move("improved-stat", "Improved Stat", { taken: 2, max: 3, order: 1 }),
			move("master-thief", "Master Thief", { order: 2, extra: { requirement: { level: 6 } } }),
			possession("kit", "Burglar's kit", { selected: true, preselected: true }), possession("ledger", "Ledger")])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory({ moves: new FakeMoveRepository([], [LEVEL_UP]) })))
		.build();
	const root = { tabs: { moves: { cssClass: "active" }, possessions: { cssClass: "active" } }, actor, editable: true, viewFlags: {},
		sheetIdPrefix: "s1", stonetop: await actor.typedActor.buildSnapshot() };
	MOVES = renderLocalized("stonetop.tab-moves", root, "en");
	POSSESSIONS = renderLocalized("stonetop.tab-possessions", root, "en");
});

// A door opened, as it opens one: the choosing list shown, the resting one and the door's word
// hidden, the instruction and Done shown.
const choosing = html => html
	.replace(/(class="stonetop-section-choose" id="[^"]+") hidden/g, "$1")
	.replace(/class="stonetop-section-rest" data-disclosure-shut/g, 'class="stonetop-section-rest" data-disclosure-shut hidden')
	.replace(/data-disclosure-open hidden/g, "data-disclosure-open")
	.replace(/<span data-disclosure-shut>/g, "<span data-disclosure-shut hidden>");

const sheet = (tab, width) => `
<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 1400px">
 <div class="window-content"><section class="sheet-body" style="height: 1300px">${tab}</section></div>
</div>`;

const measure = (tab, width, targets) => probe.measure({
	bodyHtml: sheet(tab, width), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets, chromeFlags: [`--window-size=${width + 60},1500`],
});

const right = v => v.boxLeft + v.boxWidth;
const bottom = v => v.boxTop + v.boxHeight;
const ROW = slug => `.stonetop-section-choose li[data-slug="${slug}"]`;

describe.skipIf(!canProbe())("the Moves tab while choosing", () => {
	let m;
	beforeAll(() => {
		m = measure(choosing(MOVES), 1000, {
			box: `${ROW("ambush")} .stonetop-mrow-take`, name: `${ROW("ambush")} .stonetop-mrow-name`,
			row: ROW("ambush"), statName: `${ROW("improved-stat")} .stonetop-mrow-title`,
			times: `${ROW("improved-stat")} .stonetop-mrow-times`, line: `${ROW("master-thief")} .stonetop-mrow-choosing`,
			thiefName: `${ROW("master-thief")} .stonetop-mrow-name`, thiefGloss: `${ROW("master-thief")} .stonetop-move-gloss`,
			door: ".stonetop-moves-panel .stonetop-section-door", caret: ".stonetop-moves-panel .stonetop-bar-toggle",
			bar: ".stonetop-moves-panel .stonetop-bar",
		});
	});
	const el = name => m.get(name).values;

	it("renders", () => {
		for (const [name, probed] of m) if (name !== "thiefGloss") expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("sets the box in a column of its own, before the name, inside the row", () => {
		expect(right(el("box"))).toBeLessThanOrEqual(el("name").boxLeft);
		expect(el("box").boxLeft).toBeGreaterThanOrEqual(el("row").boxLeft);
		expect(el("box").boxWidth).toBeGreaterThan(8);
	});

	it("says the count after the name, smaller than it", () => {
		expect(el("times").boxLeft).toBeGreaterThanOrEqual(right(el("statName")));
		expect(el("times").boxHeight).toBeLessThan(el("statName").boxHeight);
	});

	it("puts what taking a move asks on a line of its own, under the name", () => {
		expect(el("line").boxTop).toBeGreaterThanOrEqual(bottom(el("thiefName")) - 1);
		expect(el("line").boxLeft).toBeGreaterThanOrEqual(el("thiefName").boxLeft);
	});

	it("hangs the door and the caret from one bar, side by side", () => {
		expect(right(el("door"))).toBeLessThanOrEqual(el("caret").boxLeft + 1);
		expect(el("door").boxTop).toBeLessThanOrEqual(el("bar").boxTop + 1);
	});
});

describe.skipIf(!canProbe())("the owed line, at the sheet's narrowest", () => {
	it("keeps its words and its Choose inside its panel", () => {
		const m = measure(MOVES, 520, {
			owed: ".stonetop-owing", choose: ".stonetop-owing-choose", panel: ".stonetop-moves-panel", text: ".stonetop-owing-text",
		});
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
		expect(right(m.get("choose").values)).toBeLessThanOrEqual(right(m.get("owed").values));
		expect(right(m.get("owed").values)).toBeLessThanOrEqual(right(m.get("panel").values));
		expect(right(m.get("text").values)).toBeLessThanOrEqual(m.get("choose").values.boxLeft);
	});
});

describe.skipIf(!canProbe())("a shut Moves panel", () => {
	it("is its bar and its caret: the door goes with the panel", () => {
		const shut = MOVES.replace(/(class="stonetop-bar-toggle"[^>]*aria-expanded=)"true"/, '$1"false"')
			.replace(/(<div class="stonetop-panel-body" id="s1-moves-panel-playbook-the-fox")/, "$1 hidden");
		const m = probe.render({
			bodyHtml: sheet(shut, 1000), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1060,1500"],
			probes: { door: { selector: ".stonetop-moves-panel .stonetop-section-door", properties: ["display"] } },
		});
		expect(m.get("door").get("display")).toBe("none");
	});
});

describe.skipIf(!canProbe())("the Possessions tab while choosing", () => {
	let m;
	beforeAll(() => {
		m = measure(choosing(POSSESSIONS), 1000, {
			box: '.stonetop-section-choose li[data-slug="ledger"] .stonetop-possession-check',
			name: '.stonetop-section-choose li[data-slug="ledger"] .stonetop-mrow-name',
			desc: '.stonetop-section-choose li[data-slug="ledger"] .stonetop-prow-desc',
			granted: '.stonetop-section-choose li[data-slug="kit"] .stonetop-mrow-choosing',
			kitDesc: '.stonetop-section-choose li[data-slug="kit"] .stonetop-prow-desc',
		});
	});
	const el = name => m.get(name).values;

	it("renders", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("uses the move row's column for its box", () => {
		expect(right(el("box"))).toBeLessThanOrEqual(el("name").boxLeft);
	});

	it("sets the description under the name, and says what granted a possession under that", () => {
		expect(el("desc").boxTop).toBeGreaterThanOrEqual(bottom(el("name")) - 1);
		expect(el("granted").boxTop).toBeGreaterThanOrEqual(bottom(el("kitDesc")) - 1);
	});
});
