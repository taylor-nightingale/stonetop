import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

// An insert's tab (D12), measured: its head, its moves across the tab, then its sections in the two
// fixed columns. And the Playbook tab's own instinct, set aside
// while the insert's is in force. The real partials over a real character.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const THRALL = {
	_id: "thrall-item", type: "insert", name: "The Thrall",
	system: {
		slug: "thrall", description: "You serve another.", choiceValues: { instinct: { fascination: 1 } },
		instinct: { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
			{ slug: "fascination", content: { title: "Fascination", text: "To explore your powers." } },
		]}]},
		choices: [
			{ slug: "your-master", list: [
				{ type: "entry", content: { title: "Your Master", text: "Name them." } },
				{ type: "entry", slug: "master", content: { text: "My master is" }, input: { type: "inline" } },
			] },
			{ slug: "terrible-purpose", list: [
				{ type: "entry", content: { title: "Terrible Purpose", text: "Choose one." } },
				{ type: "entry", slug: "duty", content: { text: "**DUTY** — Name the task you refuse to leave undone.\n\nWhen you *spend the night working on your task*, regain all your HP or clear all your debilities." },
				  track: { max: 1 }, input: { type: "inline", follows: "lead" } },
				{ type: "entry", slug: "longing", content: { text: "**LONGING** — Name them.\n\nWhen you *spend the night watching them*, regain all your HP or clear all your debilities." },
				  track: { max: 1 }, input: { type: "inline", follows: "lead" } },
			] },
			{ slug: "consequences", list: [
				{ type: "entry", content: { title: "Consequences", text: "Mark one." } },
				{ type: "entry", slug: "stench", content: { text: "Carrion stench" }, track: { max: 1 } },
			] },
		],
	},
};

const FAVOR = {
	_id: "m-favor", type: "move", name: "Favor",
	system: { slug: "favor", categoryKey: "insert-thrall", acquired: true, instanceCount: 1,
		description: "When you **_ask your master for aid_**, roll +WIS.", rollStat: "wis" },
};

const playbook = () => new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox")
	.withInstinct({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "take", text: "To take what isn't yours" }] }] })
	.withChoiceValues({ instinct: { take: 1 } }).build();

let INSERT, PLAYBOOK;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox").withItems([playbook(), THRALL, FAVOR])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const stonetop = await actor.typedActor.buildSnapshot();
	const root = { tabs: { playbook: { cssClass: "active" } }, actor, editable: true, viewFlags: {}, sheetIdPrefix: "s1", stonetop };
	INSERT = renderLocalized("stonetop.tab-insert", { ...root, insert: stonetop.inserts[0], tab: { cssClass: "active" } }, "en");
	PLAYBOOK = renderLocalized("stonetop.tab-playbook", root, "en");
});

const sheet = tab => `
<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>
<div class="application stonetop sheet actor character themed theme-light" style="width: 1000px; height: 1400px">
 <div class="window-content"><section class="sheet-body" style="height: 1300px">${tab}</section></div>
</div>`;

const right = v => v.boxLeft + v.boxWidth;
const bottom = v => v.boxTop + v.boxHeight;

describe.skipIf(!canProbe())("an insert's tab", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: sheet(INSERT), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1060,1500"],
			targets: {
				head: ".stonetop-insert-header", moves: ".stonetop-insert-moves",
				columns: ".stonetop-section-columns",
				instinct: '[data-section="insert-thrall-instinct"]', purpose: '[data-section="insert-thrall-terrible-purpose"]',
				purposeBar: '[data-section="insert-thrall-terrible-purpose"] .stonetop-bar',
				consequences: '[data-section="insert-thrall-consequences"]',
				consequencesBar: '[data-section="insert-thrall-consequences"] .stonetop-bar',
			},
		});
	});
	const el = name => m.get(name).values;

	it("renders", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("sets its moves under its head, across the tab, a panel's gap below", () => {
		expect(el("moves").boxTop - bottom(el("head"))).toBeGreaterThanOrEqual(12);
		expect(el("moves").boxWidth).toBeCloseTo(el("columns").boxWidth, 0);
	});

	it("sets its sections under its moves in two columns", () => {
		expect(el("columns").boxTop - bottom(el("moves"))).toBeGreaterThanOrEqual(12);
		expect(el("purpose").boxLeft).toBeGreaterThanOrEqual(right(el("instinct")));
	});

	// The Terrible Purpose is chosen like the rest: nothing marked, it rests as its bar.
	it("rests a section with nothing chosen as its bar, the Terrible Purpose included", () => {
		expect(el("purpose").boxHeight).toBeLessThanOrEqual(el("purposeBar").boxHeight + 3);
		expect(el("consequences").boxHeight).toBeLessThanOrEqual(el("consequencesBar").boxHeight + 3);
	});
});

// Reported: a purpose's blank sat under all its triggers. It follows the sentence it answers — on
// that sentence's line where there is room, under it where there is not — and the triggers follow
// a paragraph's gap below. The choosing body is shown by hand: the probe runs no script.
describe.skipIf(!canProbe())("a Terrible Purpose's blank, while choosing", () => {
	let m;
	beforeAll(() => {
		const opened = INSERT.replace(
			/(<div class="stonetop-section-choose" id="[^"]*terrible-purpose[^"]*") hidden>/, "$1>");
		expect(opened, "the purpose's choosing body was not found").not.toBe(INSERT);
		const track = slug => `[data-section="insert-thrall-terrible-purpose"] .stonetop-section-choose .stonetop-choice-track:has([data-cg-option="${slug}"])`;
		m = probe.measure({
			bodyHtml: sheet(opened), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1060,1500"],
			targets: Object.fromEntries(["longing", "duty"].flatMap(slug => [
				[`${slug}Desc`, `${track(slug)} .stonetop-choice-track-desc`],
				[`${slug}Blank`, `${track(slug)} textarea[data-cg-option="${slug}-input"]`],
				[`${slug}Rest`, `${track(slug)} .stonetop-choice-track-rest`],
			])),
		});
	});
	const el = name => m.get(name).values;

	it("draws each purpose's blank in its text", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	// "**LONGING** — Name them." leaves the line room: the blank is on it.
	it("sets the blank on its sentence's line where there is room", () => {
		const desc = el("longingDesc"), blank = el("longingBlank");
		const lineMid = desc.firstLineTop + desc.firstLineHeight / 2;
		expect(Math.abs(blank.boxTop + blank.boxHeight / 2 - lineMid)).toBeLessThan(desc.firstLineHeight / 2);
		expect(blank.boxLeft).toBeGreaterThan(desc.boxLeft + 40);
	});

	it("starts the triggers a paragraph's gap under the blank, never beside or above it", () => {
		for (const slug of ["longing", "duty"]) {
			const gap = el(`${slug}Rest`).boxTop - bottom(el(`${slug}Blank`));
			expect(gap, slug).toBeGreaterThan(4);
			expect(gap, slug).toBeLessThan(2 * el(`${slug}Desc`).firstLineHeight);
		}
	});

	it("keeps the blank a line of the text, not a box the width of the column", () => {
		const blank = el("longingBlank");
		expect(blank.boxHeight).toBeLessThan(1.8 * el("longingDesc").firstLineHeight);
		expect(right(blank)).toBeLessThanOrEqual(right(el("longingDesc")) + 1);
	});
});

describe.skipIf(!canProbe())("the playbook's instinct while an insert's is in force", () => {
	it("is kept, and plainly not the one that counts", () => {
		const m = probe.render({
			bodyHtml: sheet(PLAYBOOK), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1060,1500"],
			probes: {
				setAside: { selector: '[data-section="instinct"] .stonetop-choice-track.is-set-aside', properties: ["color"] },
				line:     { selector: '[data-section="instinct"] .stonetop-set-aside', properties: ["color"] },
				body:     { selector: ".sheet-body", properties: ["color"] },
				lineFace: { selector: '[data-section="instinct"] .stonetop-set-aside', properties: ["font-family"] },
			},
		});
		expect(m.get("setAside").missing).toBe(false);
		expect(m.get("lineFace").get("font-family")).not.toContain("StonetopUI");
		expect(m.get("setAside").get("color")).not.toBe(m.get("body").get("color"));
	});
});
