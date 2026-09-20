import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";
import { RollModes } from "../../src/actors/RollModes.js";

/**
 * The top band, measured.
 *
 * Six stat tiles, three debility bands under their own pairs, and HP/Armor/Damage — all as wide as
 * each other because all three blocks derive their width from the same two tokens. Whether that
 * actually holds is a question only a renderer answers: a `grid-template-columns` is as valid with
 * tracks too narrow for their contents as with tracks that fit, and nothing in the cascade says
 * which.
 *
 * Rendered from the REAL partials, with the GERMAN strings. Hand-copied fixture markup is a second
 * description of what a partial emits, and the English labels fitted tracks the German ones
 * overflowed — so measuring "Armor" proves nothing that matters.
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

const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const stat = (key, value, name, abbr) => new StatSnapshot(key, value, name, abbr, `${name}.`);
const STATS = {
	str: stat("str",  1, "Stärke",           "STR"),
	dex: stat("dex", -1, "Geschicklichkeit", "DEX"),
	int: stat("int",  2, "Intelligenz",      "INT"),
	wis: stat("wis",  0, "Weisheit",         "WIS"),
	con: stat("con",  0, "Konstitution",     "CON"),
	cha: stat("cha", -1, "Charisma",         "CHA"),
};

const DEBILITIES = [
	["weakened",  "Weakened",  ["str", "dex"], true],
	["dazed",     "Dazed",     ["int", "wis"], false],
	["miserable", "Miserable", ["con", "cha"], false],
].map(([key, name, stats, active]) => new DebilitySnapshotBuilder()
	.withKey(key).withName(name).withStats(stats).withActive(active)
	.withDescription("Fatigued, tired, sluggish, shaky. Take disadvantage when rolling +STR or +DEX.")
	.build());

const VITALS = new VitalsSnapshotBuilder()
	.withHp(new ValueMax(16, 16)).withDamage({ value: "d6" }).withArmor(1)
	.withLevel(4).withXp(new ValueMax(14, 14))
	.withSources(new VitalsSourcesSnapshot("hp sentence", "damage sentence", "armor sentence"))
	.withNotes(new VitalsNotesSnapshot("playbook", "playbook", "leather, shield"))
	.build();

const ROOT = {
	stonetop: { vitals: VITALS, rollModes: RollModes.options("normal") },
	editable: true, sheetIdPrefix: "s1", viewFlags: {},
};

// The band's real nesting: a MAIN row of column-and-picture, and a FOOT carrying the folded line,
// the roll mode and the fold control. The masthead is inside the column, which is what makes the
// picture as tall as the name and the numbers together.
const BAND = `
${FONT_AWESOME}
<div class="application stonetop sheet actor character themed theme-light" style="width: 1160px; height: 900px">
 <div class="window-content"><div class="sheet-wrapper">
  <div class="stonetop-rail-layout" data-side="left">
   <div class="stonetop-rail stonetop-moves-rail">
    ${renderLocalized("stonetop.advancement", ROOT)}
   </div>
   <div class="stonetop-rail-main character-main">
    <div class="stonetop-band">
     <div class="stonetop-band-main">
      <div class="stonetop-band-col">
       <header class="sheet-header flexrow"><div class="header-fields"><h1 class="charname">
         <input name="name" type="text" value="Blodwen"></h1></div></header>
       <section class="sheet-top flexrow" id="s1-band">
        <div class="stonetop-stats-column">
         <h3 class="stonetop-move-group-title">Attribute</h3>
         <div class="stonetop-panel-divider" aria-hidden="true"></div>
         ${renderLocalized("stonetop.actor-stats", { stats: STATS, editable: true })}
         ${renderLocalized("stonetop.debility-bands", { debilities: DEBILITIES })}
         ${renderLocalized("stonetop.actor-attributes", ROOT)}
        </div>
       </section>
      </div>
      <div class="stonetop-actor-portrait">
       <button type="button" class="stonetop-image-btn"><img class="stonetop-actor-portrait-img" alt="p"></button>
      </div>
     </div>
     <div class="stonetop-band-foot">
      ${renderLocalized("stonetop.roll-mode-picker", { modes: ROOT.stonetop.rollModes, name: "stonetop-roll-mode", variant: "inline" })}
      <button type="button" class="stonetop-top-toggle" data-view-state><i class="fas fa-chevron-up stonetop-top-caret"></i><span class="stonetop-top-toggle-label">Attribute</span></button>
     </div>
    </div>
    <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Moves</button></nav>
    <section class="sheet-body"><div class="tab active">a tab</div></section>
   </div>
  </div>
 </div></div>
</div>`;

/** The band's own vitals row. */
const V = ".stonetop-resource-row--vitals";

const TARGETS = {
	// `#s1-band` is the numbers themselves; `.stonetop-band` is the wrapper that also holds the
	// ledger line and reserves the toggle's column, so the toggle is measured against that.
	band: "#s1-band", bandBox: ".stonetop-band",
	column: ".stonetop-stats-column", portrait: ".stonetop-actor-portrait",
	// The outer column — masthead over numbers — and the masthead itself. The masthead is the block
	// that used to set this column's width from its own content.
	bandCol: ".stonetop-band-col", header: ".stonetop-band-col > .sheet-header",
	statsRow: ".stonetop-stats-row", debilities: ".stonetop-debilities", vitalsRow: ".stonetop-resource-row--vitals",
	toggle: ".stonetop-top-toggle", tabs: ".sheet-tabs", firstTab: ".sheet-tabs .item",
	mode: ".stonetop-band-foot > .stonetop-rollmode",
	heading: ".stonetop-stats-column .stonetop-move-group-title",
	// The chain under the heading — the bottom of the heading UNIT, which is what the first block is
	// spaced from. The h3 and the chain are one thing, so the gap between them is not a block gap.
	headingRule: ".stonetop-stats-column .stonetop-panel-divider",

	str: '.stonetop-stat[data-stat="str"]', dex: '.stonetop-stat[data-stat="dex"]',
	cha: '.stonetop-stat[data-stat="cha"]',
	strRoll: '.stonetop-stat[data-stat="str"] .stonetop-stat-roll',
	chaRoll: '.stonetop-stat[data-stat="cha"] .stonetop-stat-roll',

	weakened: ".stonetop-debility:nth-child(1)",
	weakenedTick: ".stonetop-debility:nth-child(1) .stonetop-debility-check",
	weakenedArt: ".stonetop-debility:nth-child(1) .stonetop-debility-divider",
	weakenedName: ".stonetop-debility:nth-child(1) .stonetop-debility-label",
	weakenedEffect: ".stonetop-debility:nth-child(1) .stonetop-debility-effect",
	miserable: ".stonetop-debility:nth-child(3)",

	// Scoped to the row, always: the rail's Advancement tiles carry the same classes and come FIRST
	// in document order, so a bare `.stonetop-vital:nth-child(1)` measures XP and reports it as HP.
	hp: `${V} .stonetop-vital:nth-child(1) .stonetop-resource`,
	armor: `${V} .stonetop-vital:nth-child(2) .stonetop-resource`,
	damage: `${V} .stonetop-vital:nth-child(3) .stonetop-resource`,
	hpLabel: `${V} .stonetop-vital:nth-child(1) .stonetop-resource__label`,
	armorLabel: `${V} .stonetop-vital:nth-child(2) .stonetop-resource__label`,
	damageLabel: `${V} .stonetop-vital:nth-child(3) .stonetop-resource__label`,
	hpNote: `${V} .stonetop-vital:nth-child(1) .stonetop-resource__note`,
	armorNote: `${V} .stonetop-vital:nth-child(2) .stonetop-resource__note`,
	damageNote: `${V} .stonetop-vital:nth-child(3) .stonetop-resource__note`,
	hpCurrent: ".stonetop-char-hp", hpMax: ".stonetop-char-max-hp",

	rail: ".stonetop-rail", xp: ".stonetop-char-xp", railLevel: ".stonetop-char-level",
	xpTile: ".stonetop-resource-row--advancement .stonetop-vital:nth-child(1) .stonetop-resource",
	levelTile: ".stonetop-resource-row--advancement .stonetop-vital:nth-child(2) .stonetop-resource",
};

const right = v => v.boxLeft + v.boxWidth;

describe.skipIf(!canProbe())("the top band", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: BAND, bodyClass: "game themed theme-light",
			rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
			chromeFlags: ["--window-size=1220,960"],
		});
	});
	const el = name => m.get(name).values;

	it("renders every part of the band", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	// The structural claim the whole redesign rests on: the rail is the MOVES rail, and the numbers
	// are beside it rather than above the moves in it.
	it("puts the band beside the rail, not inside it", () => {
		expect(el("band").boxLeft).toBeGreaterThanOrEqual(right(el("rail")) - 1);
	});

	// ── The three blocks are one width, derived from one pair of tokens ──────────────
	// The tile's width is read off the token rather than written here as a number. It used to be a
	// literal 96, which is the same fact stated twice — so shrinking the frames failed this test for
	// no reason beyond the restatement, and a tile that had silently stopped tracking its own token
	// would have passed it just as happily.
	it("draws all six stats on one line, each at the declared frame width", () => {
		const tops = ["str", "dex", "cha"].map(n => el(n).boxTop);
		expect(Math.max(...tops) - Math.min(...tops), "the stats wrapped").toBeLessThan(2);

		const declaredW = parseFloat(probe.render({
			bodyHtml: BAND, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: { tile: { selector: ".stonetop-stat", properties: ["--stat-frame-w"] } },
		}).get("tile").get("--stat-frame-w")) * 16;

		for (const name of ["str", "dex", "cha"])
			expect(el(name).boxWidth, `${name} is not the declared frame width`).toBeCloseTo(declaredW, 0);
	});

	// The rail is NOT sized by the stat frame, and that is deliberate. Its width used to be derived
	// from --stat-frame-w alone (two Advancement frames across plus padding), so shrinking the tiles
	// would have dragged the moves rail from 244px to 196px behind them — narrowing the one column
	// whose names were already truncating. The frames are a floor now, not the width.
	it("does not narrow the moves rail when the stat frames shrink", () => {
		// The rendered rail, not the token: a custom property holding a `max()` substitutes as the
		// expression text, so reading it back proves nothing about the width anything actually got.
		const frames = 2 * el("str").boxWidth;
		expect(el("rail").boxWidth, "the rail followed the frames down").toBeGreaterThan(frames + 48);
	});

	// The bands still derive their width from the frame tokens, so three of them stay exactly as wide
	// as the six tiles they sit under at every Font Size step. The vitals row is no longer part of
	// this claim — see the packing test below.
	it("makes the debility bands exactly as wide as the stats row", () => {
		expect(el("debilities").boxWidth).toBeCloseTo(el("statsRow").boxWidth, 0);
	});

	// Each band belongs to the pair of stats it hinders — the grouping is the rules', and a band
	// that drifted off its pair would be claiming something about the wrong two stats.
	it("lands each debility band under its own pair of tiles", () => {
		const pair = { left: el("str").boxLeft, right: right(el("dex")) };
		expect(el("weakenedArt").boxLeft, "the bracket starts left of its pair")
			.toBeGreaterThanOrEqual(pair.left - 2);
		expect(right(el("weakenedArt")), "the bracket runs past its pair").toBeLessThanOrEqual(pair.right + 2);
	});

	// ── The labels ──────────────────────────────────────────────────────────────────
	// A tile's label is absolutely positioned across its rule, so it contributes NOTHING to its grid
	// track — a track narrower than its own chip is a chip hanging over its neighbour, and no
	// computed value on either one says so. Unseen in English, a collision in German.
	//
	// Live, and checked: narrowing the row to 180px trips it on "Rüstung", which is the width at
	// which a third of the row is narrower than the German word in it. It is NOT sensitive to the
	// row's track RATIO any more, and deliberately so — the caps below mean a frame never exceeds
	// the width its art was cut for however the tracks are divided, so that failure is designed out
	// rather than watched for. The claim here is the one about the WORDS.
	it("keeps every label inside the tile it names", () => {
		for (const [label, tile] of [["hpLabel", "hp"], ["armorLabel", "armor"], ["damageLabel", "damage"],
			["strRoll", "str"], ["chaRoll", "cha"]]) {
			const l = el(label), t = el(tile);
			expect(l.boxLeft, `the ${tile} label spills off its left edge`).toBeGreaterThanOrEqual(t.boxLeft - 1);
			expect(right(l), `the ${tile} label spills off its right edge`).toBeLessThanOrEqual(right(t) + 1);
		}
	});

	// What makes the above ratio-proof, and what keeps the tiles looking like the stat tiles beside
	// them: the frame art is a mask at `mask-size: 100% 100%`, so a frame given a track wider than
	// itself stretches the woodcut instead of sitting at the size it was cut for.
	it("never draws a frame wider than the art it is cut from", () => {
		expect(el("armor").boxWidth, "the square frame stretched").toBeLessThanOrEqual(96 + 1);
		expect(el("damage").boxWidth, "the square frame stretched").toBeLessThanOrEqual(96 + 1);
		expect(el("hp").boxWidth, "the wide frame stretched").toBeLessThanOrEqual(146 + 1);
	});

	// ── The column's edges ──────────────────────────────────────────────────────────
	// Everything that CAN be as wide as the six tiles is exactly as wide as them, masthead included.
	// The masthead's own content measured 455px against the tiles' 452 and, being a flex item, set the
	// column's width with it — so the numbers sat three pixels shy of the name above them, which is
	// the kind of miss that reads as nothing quite lining up without being nameable.
	it("lines the masthead's right edge up with the six tiles", () => {
		for (const name of ["header", "debilities"])
			expect(right(el(name)), `${name} does not end where the stats row does`)
				.toBeCloseTo(right(el("statsRow")), 0);
		expect(right(el("bandCol")), "the column grew past its six tiles")
			.toBeLessThanOrEqual(right(el("statsRow")) + 1);
	});

	// HP/Armor/Damage cannot reach that width — three packed frames are 126px short of six tiles at
	// the default step, and nothing on this sheet earns the difference (XP and Level are one mechanism
	// with the rail, and the inline roll mode is wider than the gap). They keep the column's LEFT
	// edge, and what is left over is not a hole: the roll mode and the fold control end that same line
	// from the band's right edge, so it reads as the gap in a line rather than a notch under a column.
	// Centring the three would halve the gap at both ends and put the notes within reach of the mode
	// at the sheet's floor width — see the floor case at the bottom of this file.
	it("starts the vitals row on the stats row's left edge", () => {
		expect(el("hp").boxLeft, "HP is inset from the first stat tile")
			.toBeCloseTo(el("statsRow").boxLeft, 0);
	});

	it("packs the three vitals together rather than spreading them over the stats row", () => {
		expect(right(el("damage")), "the vitals are still stretched to the stats row's width")
			.toBeLessThan(right(el("statsRow")) - 40);

		// Adjacent, with a gap no wider than a frame: the three read as one group. Measured between
		// the boxes rather than declared, so a gap that grows with the frame token still has to pass.
		const gapAfter = (a, b) => el(b).boxLeft - right(el(a));
		for (const [a, b] of [["hp", "armor"], ["armor", "damage"]]) {
			expect(gapAfter(a, b), `${a} and ${b} are adrift of each other`).toBeGreaterThan(0);
			expect(gapAfter(a, b), `${a} and ${b} do not read as one group`)
				.toBeLessThanOrEqual(el("armor").boxWidth);
		}
	});

	it("crops no label", () => {
		for (const name of ["hpLabel", "armorLabel", "damageLabel", "strRoll", "chaRoll", "weakenedName"]) {
			expect(m.get(name).overflowX, `${name} is cropped horizontally`).toBe(0);
			expect(m.get(name).overflowY, `${name} is cropped vertically`).toBe(0);
		}
	});

	// ── The values ──────────────────────────────────────────────────────────────────
	// The failure this replaced a container check for: the HP split did not overflow, and the input
	// INSIDE it was 16px wide holding 21px numerals. Assert on the leaf that holds the text.
	it("leaves HP's two numbers wide enough to read", () => {
		for (const name of ["hpCurrent", "hpMax"]) {
			expect(el(name).boxWidth, `${name} is too narrow for its numerals`).toBeGreaterThan(40);
			expect(m.get(name).overflowX, `${name} is clipped`).toBe(0);
		}
	});

	// ── The notes ───────────────────────────────────────────────────────────────────
	// The note goes BELOW the frame. Inside it, the label chip straddling the bottom rule would be
	// drawn straight over it — which is exactly why the tile has a wrapper.
	it("puts each note below its frame, clear of the label chip", () => {
		for (const [note, tile] of [["hpNote", "hp"], ["armorNote", "armor"], ["damageNote", "damage"]])
			expect(el(note).boxTop, `${note} rides its frame`)
				.toBeGreaterThanOrEqual(el(tile).boxTop + el(tile).boxHeight - 1);
	});

	it("crops no note", () => {
		for (const name of ["hpNote", "armorNote", "damageNote"]) {
			expect(m.get(name).overflowY, `${name} is cropped vertically`).toBe(0);
			expect(m.get(name).overflowX, `${name} is cropped horizontally`).toBe(0);
		}
	});

	// ── The debility's effect ───────────────────────────────────────────────────────
	// Carried, and drawn nowhere. Ticking a debility used to write a sentence of rules text under its
	// name, and three of those took the band from one line to three — shoving the picture, the tabs
	// and everything below them down at the moment a fight is going badly. The hover is pointer-bound
	// and invisible to assistive tech, so the sentence stays in the DOM, clipped.
	it("says what a marked debility does without drawing it", () => {
		const effect = el("weakenedEffect");
		expect(effect.boxWidth, "the effect is drawn on the band").toBeLessThan(3);
		expect(effect.boxHeight, "the effect is drawn on the band").toBeLessThan(3);
		// The art keeps the height its own rule gives it, whatever is marked.
		expect(el("weakenedArt").boxHeight).toBeCloseTo(18, 0);
	});

	// And so every band is the same height whatever is marked — the row cannot jump under the pointer
	// that just ticked it.
	it("keeps the three bands one height, marked or not", () => {
		expect(el("miserable").boxHeight).toBeCloseTo(el("weakened").boxHeight, 0);
	});

	// The tick sits in the gap the divider art leaves for it — centred across (the gap is columns
	// 105-124 of the art's 230) and ON the rule down, which that art draws at 66% rather than halfway.
	// Only a renderer can catch what broke this: `left`/`top` place the MARGIN box, and core gives
	// every checkbox `margin: 3px 3px 3px 4px`, so the tick sat 4px right and 3px low inside its own
	// bracket at every font step while the stylesheet read as if it were placed.
	//
	// The vertical ratio is read off the band's own token, not restated here: it is a fact about the
	// PNG, and two copies of it would drift the moment the art was recut.
	it("sits each tick in the gap its bracket leaves, on the rule", () => {
		const art = el("weakenedArt"), tick = el("weakenedTick");
		const centre = (v, axis) => axis === "x"
			? v.boxLeft + v.boxWidth / 2
			: v.boxTop + v.boxHeight / 2;
		expect(Math.abs(centre(tick, "x") - centre(art, "x")), "the tick is off its bracket across")
			.toBeLessThanOrEqual(0.5);

		const ruleY = parseFloat(probe.render({
			bodyHtml: BAND, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: { band: { selector: ".stonetop-debility-band", properties: ["--debility-rule-y"] } },
		}).get("band").get("--debility-rule-y")) / 100;
		expect(ruleY, "the band declares no rule position").toBeGreaterThan(0);
		expect(Math.abs(centre(tick, "y") - (art.boxTop + art.boxHeight * ruleY)),
			"the tick is off the rule it interrupts").toBeLessThanOrEqual(0.5);
	});

	// ── The rhythm ──────────────────────────────────────────────────────────────────
	// One token, not per-block margins. The blocks used to space themselves — 0.625rem here, 2px
	// there, 0.2rem somewhere else — which came out as 10px in two gaps and 3px in the third, and
	// read as mis-set without anything being nameable. Measured, because a margin that is correct in
	// the stylesheet is still wrong when the block above it carries one too.
	//
	// Live, and checked: a per-block `margin-top` written later in the file at the same specificity
	// trips it. A block's OWN margin no longer can — the column's `> * + *` outranks it — which is
	// the difference between a rule enforced and a rule watched for.
	it("spaces every block in the column by the same gap", () => {
		const bottom = n => el(n).boxTop + el(n).boxHeight;
		const gaps = [
			el("statsRow").boxTop - bottom("headingRule"),
			el("debilities").boxTop - bottom("statsRow"),
			el("vitalsRow").boxTop - bottom("debilities"),
		];
		expect(Math.max(...gaps) - Math.min(...gaps), `uneven: ${gaps.map(g => g.toFixed(1))}`)
			.toBeLessThan(1);
	});

	// The band's heading starts at the band's top — an h3's user-agent margin is what set it adrift.
	it("starts the heading at the top of the column it heads", () => {
		expect(el("heading").boxTop - el("column").boxTop).toBeLessThan(1);
	});

	// ── The band's own furniture ────────────────────────────────────────────────────
	// The fold control is the last item of the foot, in flow. It was positioned onto the seam once,
	// half in and half out of the band — and what that actually drew was the band's own rule running
	// straight through the word inside it, with the control half a line below the mode beside it. In
	// flow it clears the rule, it is level with the mode, and nothing has to reserve room for it.
	const centreY = v => v.boxTop + v.boxHeight / 2;

	it("sits inside the band, clear of its rule", () => {
		const seam = el("bandBox").boxTop + el("bandBox").boxHeight;
		const toggleBottom = el("toggle").boxTop + el("toggle").boxHeight;
		expect(toggleBottom, "the fold control hangs through the band's rule").toBeLessThan(seam);
		expect(seam - toggleBottom, "the fold control is flush against the rule").toBeGreaterThan(1);
	});

	// On the line with the mode, not centred against it: the chip is a bordered box among words, and
	// it holds a hair of clearance below itself so the band's rule passes under it rather than through
	// its border. So "level" is stated as what it has to be — inside the mode's own band of the line.
	it("rides the foot line, level with the roll mode", () => {
		const mode = el("mode"), chip = el("toggle");
		const within = (v, box) => v >= box.boxTop && v <= box.boxTop + box.boxHeight;
		expect(within(centreY(chip), mode), "the fold control is off the mode's line").toBe(true);
		expect(within(centreY(mode), chip), "the mode is off the fold control's line").toBe(true);
	});

	it("keeps the fold control at the band's right edge, with the mode before it", () => {
		expect(right(el("toggle")), "the fold control hangs off the band")
			.toBeLessThanOrEqual(right(el("bandBox")) + 1);
		expect(right(el("toggle")), "the fold control drifted in from the edge")
			.toBeGreaterThan(right(el("bandBox")) - 2);
		expect(el("toggle").boxLeft, "the mode runs under the fold control")
			.toBeGreaterThanOrEqual(right(el("mode")));
	});

	// The reason the mode is down here at all: expanded, the foot is a row of its own BELOW the
	// numbers, so the one control on this line cannot land on the frames' notes however narrow the
	// sheet gets. In the picture's column it overflowed that column at 760px and closed on the notes
	// at the sheet's floor.
	it("keeps the mode below the frames' notes rather than beside them", () => {
		expect(el("mode").boxTop, "the mode rides the notes")
			.toBeGreaterThanOrEqual(el("hpNote").boxTop + el("hpNote").boxHeight - 1);
	});

	// It hangs into the gap above the tabs, which is empty — but the tabs themselves are a row of
	// controls, and a handle sitting on one of them is two targets in one place.
	it("covers no tab", () => {
		const handleBottom = el("toggle").boxTop + el("toggle").boxHeight;
		const tabOverlapsVertically = handleBottom > el("firstTab").boxTop;
		const tabOverlapsHorizontally = right(el("firstTab")) > el("toggle").boxLeft;
		expect(tabOverlapsVertically && tabOverlapsHorizontally, "the handle sits on a tab").toBe(false);
	});

	it("gives the portrait the width the six tiles leave over", () => {
		expect(el("portrait").boxLeft).toBeGreaterThanOrEqual(right(el("column")) - 1);
		expect(el("portrait").boxWidth, "the portrait has no room").toBeGreaterThan(100);
	});

	// ── Advancement, in the rail ────────────────────────────────────────────────────
	it("keeps XP and Level inside the rail, level and equal", () => {
		for (const name of ["xpTile", "levelTile"]) {
			expect(right(el(name)), `${name} runs past the rail`).toBeLessThanOrEqual(right(el("rail")) + 1);
			expect(el(name).boxLeft, `${name} starts left of the rail`)
				.toBeGreaterThanOrEqual(el("rail").boxLeft - 1);
		}
		expect(Math.abs(el("xpTile").boxWidth - el("levelTile").boxWidth)).toBeLessThan(2);
		expect(Math.abs(el("xpTile").boxTop - el("levelTile").boxTop)).toBeLessThan(4);
	});

	it("leaves XP's number wide enough to read in the rail", () => {
		expect(el("xp").boxWidth, "XP's field is too narrow for its numerals").toBeGreaterThan(24);
		expect(m.get("xp").overflowX, "XP's field is clipped").toBe(0);
	});
});

/**
 * The band at the sheet's declared floor.
 *
 * A `min-width` is a promise that the sheet still works at that width, and nothing checks a promise
 * like that on its own — it was 813px, written for an arrangement where the portrait could not
 * shrink, and stayed there through two redesigns of the thing it was measured against.
 *
 * The floor is read off the stylesheet rather than written here, so lowering one without the other
 * is what fails.
 */
describe.skipIf(!canProbe())("the band at the sheet's own minimum width", () => {
	const declared = () => {
		const m = probe.render({
			bodyHtml: `<div class="application stonetop sheet actor character themed theme-light"
			  id="floor" style="height: 100px"></div>`,
			bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: { floor: { selector: "#floor", properties: ["min-width"] } },
		});
		return parseFloat(m.get("floor").get("min-width"));
	};

	it("fits the six stat frames and the fold toggle inside the declared floor", () => {
		const floor = declared();
		expect(floor, "the sheet declares no floor at all").toBeGreaterThan(0);

		const m = probe.measure({
			bodyHtml: BAND.replace("width: 1160px", `width: ${floor}px`),
			bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: { ...TARGETS, content: ".window-content" },
			// Below 900 the rail is a drawer, which is the state a floor-width sheet is actually in.
			chromeFlags: [`--window-size=${Math.round(floor) + 60},960`],
		});
		const v = n => m.get(n).values;
		expect(right(v("statsRow")), `the stats row overruns the band at ${floor}px`)
			.toBeLessThanOrEqual(right(v("bandBox")) + 1);
		expect(right(v("toggle")), "the fold toggle is pushed off the band")
			.toBeLessThanOrEqual(right(v("bandBox")) + 1);
		// The foot's two controls still fit ON the foot at the floor, side by side and in that order.
		// This is the width at which the mode used to overflow the picture's column and reach for the
		// frames' notes; it is a row of its own now, so the notes are simply not on its line.
		expect(v("mode").boxLeft, `the mode is pushed off the band at ${floor}px`)
			.toBeGreaterThanOrEqual(v("bandBox").boxLeft - 1);
		expect(v("toggle").boxLeft, "the mode runs under the fold toggle")
			.toBeGreaterThanOrEqual(right(v("mode")));
		expect(v("mode").boxTop, "the mode rides the frames' notes at the floor")
			.toBeGreaterThanOrEqual(v("hpNote").boxTop + v("hpNote").boxHeight - 1);
		// The stats row is NOT asked to clear the fold control any more: the control is the last item
		// of the foot, below the band's contents rather than in a column beside them, so the row is
		// free to run the full width — which is why the band stopped reserving 2rem of its right edge.
	});
});
