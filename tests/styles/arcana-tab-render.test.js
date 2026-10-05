import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";

// The Arcana tab (D13), measured at the widths the sheet actually gives it: 42rem at the sheet's 47rem
// floor, 49rem at the default 1160px window, 74rem at a wide one. The real tab partial over a real
// character, in English.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

// The book's art ships on one 1125×675 canvas; any picture of that shape sizes the same.
const ART = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1125" height="675"><rect width="1125" height="675" fill="black"/></svg>');

const MINDGEM = {
	_id: "mindgem-item", type: "arcanum", name: "Mindgem", img: ART,
	system: {
		slug: "mindgem", major: true, flipped: false, choiceValues: {},
		front: { item: { name: "Mindgem", weight: 2, tagList: ["slow", "indestructible"] },
			choices: [{ slug: "intro", list: [{ type: "entry", content: { title: null,
				text: "A chunk of makerglass the size of a human head; inspection reveals facets within facets, a thousandfold." } }] }] },
		back: { title: "Mysteries of the Mindgem", item: null, choices: [] },
	},
};

// A labelled track: the header that used to crush its title into a column.
const BASIN = {
	_id: "basin-item", type: "arcanum", name: "A redwood basin",
	system: {
		slug: "redwood-basin", major: false, flipped: true, choiceValues: {},
		front: { item: null, choices: [] },
		back: { title: "Bittersweet Elixir", resource: { max: 3, title: null, labels: ["youthful", "mature", "elderly"] },
			item: { name: "A redwood basin", weight: 2, tagList: ["magical", "beautiful"] },
			choices: [{ slug: "intro", list: [{ type: "entry", content: { title: null,
				text: "When you fill the basin with a few years of your life, it becomes a draught of honey and regret." } }] }] },
	},
};

// A move that carries a track, in move-item.hbs's header markup.
const CODEX_MOVE = `
<ol class="items-list stonetop-arcanum-moves"><li class="item stonetop-item"><div class="stonetop-item-header">
	<button type="button" class="stonetop-item-name stonetop-item-name--open">Cast a Codex Spell</button>
	<button type="button" class="rollable move-rollable">d</button>
	<span class="stonetop-item-resources"><span class="stonetop-arcanum-resource-title">Casting penalty</span>
		${'<button type="button" class="stonetop-arcanum-resource-btn"></button>'.repeat(5)}</span>
</div></li></ol>`;

let TAB;
beforeAll(async () => {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems([MINDGEM, BASIN])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	TAB = renderLocalized("stonetop.tab-arcana", {
		tabs: { arcana: { cssClass: "active" } }, actor, editable: true, sheetIdPrefix: "s1",
		stonetop: await actor.typedActor.buildSnapshot(),
	}, "en");
});

/** The tab with every card but `slug`'s put away, as ArcanaSelection leaves it. */
const showing = slug => TAB.replace(new RegExp(`(<div class="stonetop-arcanum-card[^"]*" data-slug="(?!${slug}")[^"]+")`, "g"), "$1 hidden");

/** The tab at `rem` wide, showing the card whose slug is given. */
const sheet = (rem, slug) => `
<div class="application stonetop sheet actor character themed theme-light">
 <div class="window-content"><section class="sheet-body" style="width: ${rem}rem">${showing(slug)}</section></div>
</div>`;

const TARGETS = {
	list: ".stonetop-arcana-list", card: ".stonetop-arcana-reader > .stonetop-arcanum-card:not([hidden])",
	img: ".stonetop-arcanum-card:not([hidden]) .stonetop-arcanum-img",
	header: ".stonetop-arcanum-card:not([hidden]) .stonetop-arcanum-header",
	title: ".stonetop-arcanum-card:not([hidden]) .stonetop-arcanum-title",
	track: ".stonetop-arcanum-card:not([hidden]) .stonetop-arcanum-header-resource",
	moveName: ".stonetop-arcanum-moves .stonetop-item-name",
	moveTrack: ".stonetop-arcanum-moves .stonetop-item-resources",
};

const right = v => v.boxLeft + v.boxWidth;
const bottom = v => v.boxTop + v.boxHeight;
const measure = (rem, slug, extra = "") => probe.measure({
	bodyHtml: sheet(rem, slug) + extra, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets: TARGETS, chromeFlags: [`--window-size=${rem * 16 + 80},1400`],
});

describe.skipIf(!canProbe())("the Arcana tab at the sheet's narrowest", () => {
	let m;
	beforeAll(() => { m = measure(42, "mindgem"); });
	const el = name => m.get(name).values;

	it("still sets the list beside the card", () => {
		expect(el("card").boxLeft).toBeGreaterThanOrEqual(right(el("list")));
		expect(el("card").boxTop).toBeCloseTo(el("list").boxTop, 0);
	});

	// Too narrow for the art and a title side by side: the picture stands above the band, as on the page.
	it("stands the art above the title band", () => {
		expect(el("header").boxTop).toBeGreaterThanOrEqual(bottom(el("img")) - 1);
	});
});

describe.skipIf(!canProbe())("the Arcana tab at the default window", () => {
	let m;
	beforeAll(() => { m = measure(49, "mindgem"); });
	const el = name => m.get(name).values;

	// A fixed box letterboxed a wide picture, leaving the empty band trimming the art had removed.
	it("draws the art at its own proportions, with no empty band in its box", () => {
		expect(el("img").boxWidth / el("img").boxHeight).toBeCloseTo(1125 / 675, 1);
	});

	it("sets the art to the right of the title band, level with its top", () => {
		expect(el("img").boxLeft).toBeGreaterThanOrEqual(right(el("header")));
		expect(el("header").boxTop).toBeCloseTo(el("img").boxTop, 0);
	});
});

describe.skipIf(!canProbe())("the Arcana tab on a wide window", () => {
	let m;
	beforeAll(() => { m = measure(74, "mindgem"); });
	const el = name => m.get(name).values;

	// Past its measure the card stops, and the list takes its wider width; the rest stays paper.
	it("stops the card at its reading measure", () => {
		expect(el("card").boxWidth).toBeLessThanOrEqual(46 * 16);
	});

	it("widens the list", () => {
		expect(el("list").boxWidth).toBe(18 * 16);
	});
});

describe.skipIf(!canProbe())("an arcanum's header with a labelled track", () => {
	let m;
	beforeAll(() => { m = measure(42, "redwood-basin"); });
	const el = name => m.get(name).values;

	// Squeezed onto one line, the track left "Bittersweet Elixir" a word per line.
	it("drops the track under the title rather than squeezing it", () => {
		expect(el("track").boxTop).toBeGreaterThanOrEqual(bottom(el("title")) - 1);
	});

	it("leaves the title its line", () => {
		expect(el("title").boxHeight).toBeLessThan(1.3 * 16 * 1.6);
	});
});

describe.skipIf(!canProbe())("a move on an arcanum that carries a track", () => {
	let m;
	beforeAll(() => {
		const reader = `<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
			<div class="stonetop-arcanum-card" style="width: 20rem"><div class="stonetop-arcanum-body">${CODEX_MOVE}</div></div></div></div>`;
		m = probe.measure({
			bodyHtml: reader, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: { moveName: TARGETS.moveName, moveTrack: TARGETS.moveTrack }, chromeFlags: ["--window-size=800,600"],
		});
	});
	const el = name => m.get(name).values;

	// "Cast a / Codex / Spell" beside "Casting penalty ○○○○○".
	it("drops the track under the name rather than squeezing the name", () => {
		expect(el("moveTrack").boxTop).toBeGreaterThanOrEqual(bottom(el("moveName")) - 1);
		expect(el("moveName").boxHeight).toBeLessThan(16 * 2);
	});
});

// Hungering Maw's shape: art, a short intro, then a long move. A box that is its own formatting
// context stands clear of a float for its WHOLE height — the move list ran narrow long after the art
// had ended. Plain blocks keep the card's width and only their lines step around the picture.
describe.skipIf(!canProbe())("a long move beside an arcanum's art", () => {
	let m;
	beforeAll(() => {
		const words = "The ring draws the life-force from your victim, and the bands twist on each other. ".repeat(12);
		const card = `<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
			<div class="stonetop-arcana-reader" style="width: 36rem">
			<div class="stonetop-arcanum-card">
				<img class="stonetop-arcanum-img" src="${ART}" alt="">
				<div class="stonetop-arcanum-header"><div class="stonetop-arcanum-header-left"><span class="stonetop-arcanum-title">Hungering Maw of Hlad</span></div></div>
				<div class="stonetop-arcanum-body">
					<div class="stonetop-arcanum-section"><div class="stonetop-choice-description">A ring of black metal bands.</div></div>
					<div class="stonetop-arcanum-section"><div class="stonetop-arcanum-move-grant"><ol class="items-list stonetop-arcanum-moves">
						<li class="item stonetop-item"><div class="stonetop-item-header"><span class="stonetop-item-controls">
							<button type="button" class="rollable move-rollable">d</button></span></div>
						<div class="stonetop-item-description">${words}</div></li>
					</ol></div></div>
				</div>
			</div></div></div></div>`;
		m = probe.measure({
			bodyHtml: card, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: { body: ".stonetop-arcanum-body", moves: ".stonetop-arcanum-moves", img: ".stonetop-arcanum-img" },
			chromeFlags: ["--window-size=900,1400"],
		});
	});
	const el = name => m.get(name).values;

	it("keeps the move list the card's width, so its text runs full width past the art", () => {
		expect(bottom(el("moves"))).toBeGreaterThan(bottom(el("img")));
		expect(el("moves").boxWidth).toBeGreaterThanOrEqual(el("body").boxWidth - 2 * 8 - 1);
	});
});

// Mindgem's back: a short intro, then a section titled "Consequences" while the art is still beside it.
// A plain block's border runs under a float — only its text lines step around — so the label's rule
// crossed the picture. Ruled things beside the art stop where the art begins.
describe.skipIf(!canProbe())("a section label beside an arcanum's art", () => {
	let m;
	beforeAll(() => {
		const card = `<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
			<div class="stonetop-arcana-reader" style="width: 36rem">
			<div class="stonetop-arcanum-card">
				<img class="stonetop-arcanum-img" src="${ART}" alt="">
				<div class="stonetop-arcanum-header"><div class="stonetop-arcanum-header-left"><span class="stonetop-arcanum-title">Mysteries of the Mindgem</span></div></div>
				<div class="stonetop-arcanum-body">
					<div class="stonetop-arcanum-section"><div class="stonetop-choice-description">When the Mighty Servant makes a move.</div></div>
					<div class="stonetop-arcanum-section"><p class="stonetop-arcanum-section-label">Consequences</p>
						<div class="stonetop-choice-description">It becomes frustrated.</div></div>
				</div>
			</div></div></div></div>`;
		m = probe.measure({
			bodyHtml: card, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: { label: ".stonetop-arcanum-section-label", img: ".stonetop-arcanum-img" },
			chromeFlags: ["--window-size=900,1000"],
		});
	});
	const el = name => m.get(name).values;

	it("stops the label's rule where the art begins", () => {
		expect(el("label").boxTop).toBeLessThan(bottom(el("img")));
		expect(right(el("label"))).toBeLessThanOrEqual(el("img").boxLeft);
	});
});
