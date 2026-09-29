import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

// The Playbook tab (D11), measured: two fixed columns of sections, the playbook's own story across
// both beneath them, and each section costing its bar and its lines and nothing more. The real tab
// partial over a real character, in English.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox").withName("The Fox")
	.withDescription("A clever rogue, quick of wit and light of finger.")
	.withBackgrounds([
		{ slug: "the-natural",   label: "The Natural",   description: "You grew up around here, and know every trail." },
		{ slug: "the-scoundrel", label: "The Scoundrel", description: "You never fit in." },
	])
	.withInstinct({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
		{ slug: "take", text: "To take what isn't yours" }, { slug: "prove", text: "To prove yourself" },
	]}]})
	.withAppearance({ slug: "appearance", list: [{ type: "pick", pickCount: 1, inline: true, options: [
		{ slug: "young-pup", text: "young pup" }, { slug: "old-timer", text: "cagey old-timer" },
	]}]})
	// The Seeker's shape: a heading with nothing to choose, over a titled group of its own.
	.withChoices([
		{ slug: "collection", list: [{ type: "entry", content: { title: "Collection", text: "You have gathered a few things." } }] },
		{ slug: "arcana-major", list: [
			{ type: "entry", content: { title: "Major Arcanum", text: "Choose one." } },
			{ type: "pick", pickCount: 1, options: [{ slug: "azure-hand", text: "The Azure Hand" }, { slug: "stone", text: "A Stone of Fire" }] },
		] },
	])
	.withOrigin([{ region: "Stonetop", names: ["Bhelu", "Cadi", "Dunn", "Enid"] }, { region: "Marshedge", names: ["Ottar"] }])
	.withChoiceValues({ instinct: { take: 1 } })
	.build();

let TAB;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox").withItems([playbookItem()])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	TAB = renderLocalized("stonetop.tab-playbook", {
		tabs: { playbook: { cssClass: "active" } }, actor, editable: true, viewFlags: {}, sheetIdPrefix: "s1",
		stonetop: await actor.typedActor.buildSnapshot(),
	}, "en");
});

// The origin opened, as its door opens it: the choosing body shown, the resting one and the Choose
// word hidden, the instruction and Done shown.
const withOriginOpen = html => {
	const at = html.indexOf('data-section="origin"');
	const end = html.indexOf("</section>", at);
	const origin = html.slice(at, end)
		.replace('id="s1-section-origin" hidden', 'id="s1-section-origin"')
		.replace(/data-disclosure-open hidden/g, "data-disclosure-open")
		.replace("<span data-disclosure-shut>", "<span data-disclosure-shut hidden>")
		.replace('class="stonetop-section-rest" data-disclosure-shut', 'class="stonetop-section-rest" data-disclosure-shut hidden');
	return html.slice(0, at) + origin + html.slice(end);
};

const sheet = (tab, width = 1000) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 1400px">
 <div class="window-content"><section class="sheet-body" style="height: 1300px">${tab}</section></div>
</div>`;

const TARGETS = {
	columns: ".stonetop-section-columns",
	background: '[data-section="background"]', instinct: '[data-section="instinct"]',
	appearance: '[data-section="appearance"]', appearanceBar: '[data-section="appearance"] .stonetop-bar',
	origin: '[data-section="origin"]', lore: '[data-section="lore-collection"]',
	instinctRest: '[data-section="instinct"] .stonetop-section-rest',
	instinctLine: '[data-section="instinct"] .stonetop-section-rest .stonetop-choice-track',
	appearanceDoor: '[data-section="appearance"] .stonetop-section-door',
	originNote: '[data-section="origin"] .stonetop-bar-note',
	firstName: '[data-section="origin"] .stonetop-origin-name:nth-child(1)',
	lastName: '[data-section="origin"] .stonetop-origin-option:first-child .stonetop-origin-name:last-of-type',
	loreTitle: '[data-section="lore-collection"] .stonetop-bar-title',
};

const right = v => v.boxLeft + v.boxWidth;
const bottom = v => v.boxTop + v.boxHeight;
const measure = (tab, width = 1000) => probe.measure({
	bodyHtml: sheet(tab, width), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets: TARGETS, chromeFlags: [`--window-size=${width + 60},1500`],
});

describe.skipIf(!canProbe())("the Playbook tab's sections", () => {
	let m;
	beforeAll(() => { m = measure(withOriginOpen(TAB)); });
	const el = name => m.get(name).values;

	it("renders", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("sets two columns side by side, the background in one and the rest in the other", () => {
		expect(el("instinct").boxLeft).toBeGreaterThanOrEqual(right(el("background")));
		expect(el("instinct").boxTop).toBeCloseTo(el("background").boxTop, 0);
		expect(el("appearance").boxLeft).toBeCloseTo(el("instinct").boxLeft, 0);
	});

	it("runs the playbook's own story across both columns, beneath them", () => {
		expect(el("lore").boxTop).toBeGreaterThanOrEqual(bottom(el("columns")));
		expect(el("lore").boxWidth).toBeCloseTo(el("columns").boxWidth, 0);
	});

	// A section with nothing chosen costs its bar, and nothing more.
	it("rests a section with nothing chosen as its bar alone", () => {
		expect(el("appearance").boxHeight).toBeLessThanOrEqual(el("appearanceBar").boxHeight + 3);
	});

	it("rests a chosen one on what was chosen, inside its panel", () => {
		expect(el("instinctLine").boxHeight).toBeGreaterThan(0);
		expect(bottom(el("instinctLine"))).toBeLessThanOrEqual(bottom(el("instinct")));
	});

	it("hangs the door from its bar", () => {
		expect(el("appearanceDoor").boxTop).toBeLessThanOrEqual(el("appearanceBar").boxTop + 1);
		expect(bottom(el("appearanceDoor"))).toBeGreaterThan(bottom(el("appearanceBar")));
	});

	it("puts the book's instruction on the bar of an open section", () => {
		expect(el("originNote").boxHeight).toBeGreaterThan(0);
	});

	it("runs a region's names on as words rather than stacking them", () => {
		expect(el("lastName").boxTop).toBeCloseTo(el("firstName").boxTop, 0);
	});

	it("keeps each section inside its own column", () => {
		expect(right(el("background"))).toBeLessThanOrEqual(el("instinct").boxLeft);
		expect(right(el("origin"))).toBeLessThanOrEqual(right(el("columns")) + 1);
	});
});

describe.skipIf(!canProbe())("a group's own title inside a section", () => {
	// Major Arcanum under Collection: the shipped entry title is the heading size, which outranked the
	// ink bar above it. Under a bar it is set at the note's size.
	it("is set smaller than the bar that heads the section", () => {
		const html = TAB.replace('id="s1-section-lore-collection" hidden', 'id="s1-section-lore-collection"');
		const m = probe.render({
			bodyHtml: sheet(html), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: {
				title: { selector: '[data-section="lore-collection"] .stonetop-section-choose .stonetop-choice-entry-title', properties: ["font-size"] },
				bar:   { selector: '[data-section="lore-collection"] .stonetop-bar', properties: ["font-size"] },
			},
			chromeFlags: ["--window-size=1060,1500"],
		});
		expect(m.get("title").missing).toBe(false);
		expect(parseFloat(m.get("title").get("font-size"))).toBeLessThanOrEqual(parseFloat(m.get("bar").get("font-size")));
	});
});

// Reported: the instruction was hard to read over the bar's stone. It was faded to 70%, halo and all;
// it is full ink now, outlined crisply in the bar's own ink under the soft halo the title wears.
describe.skipIf(!canProbe())("the book's instruction on a bar", () => {
	const shadows = value => value.split(/,(?![^(]*\))/).map(s => s.trim()).map(s => {
		const color = s.match(/rgba?\([^)]*\)/)[0];
		const [x, y, blur] = s.replace(color, "").trim().split(/\s+/).map(parseFloat);
		return { color, x, y, blur };
	});

	it("is set in full ink, outlined in the bar's own", () => {
		const m = probe.render({
			bodyHtml: sheet(withOriginOpen(TAB)), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: {
				note:  { selector: '[data-section="origin"] .stonetop-bar-note', properties: ["opacity", "text-shadow"] },
				title: { selector: '[data-section="origin"] .stonetop-bar-title', properties: ["text-shadow"] },
			},
			chromeFlags: ["--window-size=1060,1500"],
		});
		expect(m.get("note").missing).toBe(false);
		expect(m.get("note").get("opacity")).toBe("1");
		const ink = shadows(m.get("title").get("text-shadow"))[0].color;
		const note = shadows(m.get("note").get("text-shadow"));
		expect(note.every(s => s.color === ink)).toBe(true);
		const outline = note.filter(s => s.blur === 0 && (s.x !== 0 || s.y !== 0));
		expect(outline.length).toBeGreaterThanOrEqual(4);
	});
});
