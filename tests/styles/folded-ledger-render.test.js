import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { StatPairSnapshot } from "../../src/model/snapshot/character/StatPairSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";
import { RollModes } from "../../src/actors/RollModes.js";

/**
 * One component, two densities — and nothing unreachable in any combination of the two.
 *
 * The band and the rail are both the reader's to put away, independently, and below 900px the rail
 * is a drawer that starts shut with no class in the markup saying so. Every number each of them
 * carries is therefore rendered a second time as a line, and each GROUP of that line stands down
 * while its own full-density home is on screen. Folding REVEALS a group rather than moving anything,
 * so nothing runs to make it true.
 *
 * Only layout can answer this. Both copies are in the DOM at every width and in every state, and no
 * computed value on either one says whether the reader can currently see a number.
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
	["weakened",  "Weakened",  ["str", "dex"], false],
	["dazed",     "Dazed",     ["int", "wis"], true],
	["miserable", "Miserable", ["con", "cha"], false],
].map(([key, name, stats, active]) => new DebilitySnapshotBuilder()
	.withKey(key).withName(name).withStats(stats).withActive(active)
	.withDescription("Take disadvantage when rolling.").build());

const VITALS = new VitalsSnapshotBuilder()
	.withHp(new ValueMax(16, 16)).withDamage({ value: "d6" }).withArmor(1)
	.withLevel(4).withXp(new ValueMax(14, 14))
	.withSources(new VitalsSourcesSnapshot("hp", "damage", "armor"))
	.withNotes(new VitalsNotesSnapshot("playbook", "playbook", "leather"))
	.build();

const ROOT = {
	stonetop: {
		vitals: VITALS, statPairs: StatPairSnapshot.pairsFrom(DEBILITIES, STATS),
		rollModes: RollModes.options("normal"),
	},
	editable: true, sheetIdPrefix: "s1", viewFlags: {},
};

// The REAL partials. The band, the rail's Advancement and the line are three renderings of the same
// five numbers, and a hand-copied fixture is a fourth that nothing keeps in step.
const LEDGER = renderLocalized("stonetop.folded-ledger", ROOT);
const STATS_ROW = renderLocalized("stonetop.actor-stats", { stats: STATS, editable: true });
const VITALS_ROW = renderLocalized("stonetop.actor-attributes", ROOT);
const ADVANCEMENT = renderLocalized("stonetop.advancement", ROOT);
// The sheet's ONE roll mode. It is the band foot's, not either density's — see the fixture.
const MODE = renderLocalized("stonetop.roll-mode-picker", {
	modes: ROOT.stonetop.rollModes, name: "stonetop-roll-mode",
	changeAction: "rollMode", variant: "inline",
});

// The band's real nesting, which the assertions below are entirely about: a main row of
// column-and-picture, and a FOOT that carries the folded line, the mode and the fold control.
const fixture = ({ folded, railShut, width }) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 700px">
 <div class="window-content">
  <div class="sheet-wrapper${folded ? " top-collapsed" : ""}">
   <div class="stonetop-rail-layout${railShut ? " rail-shut" : ""}" data-side="left">
    <button type="button" class="stonetop-rail-toggle" aria-label="Rail">
      <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
      <span class="stonetop-rail-fold" aria-hidden="true"><i class="fas fa-bolt stonetop-rail-mark"></i></span>
    </button>
    <div class="stonetop-rail stonetop-moves-rail">${ADVANCEMENT}</div>
    <div class="stonetop-rail-main character-main">
     <div class="stonetop-band">
      <div class="stonetop-band-main">
       <div class="stonetop-band-col">
        <header class="sheet-header flexrow"><div class="header-fields"><h1 class="charname">
          <input name="name" type="text" value="Blodwen"></h1>
          <ul class="stonetop-masthead-debilities stonetop-unmarked">
           <li class="stonetop-masthead-debility">Dazed</li></ul></div></header>
        <section class="sheet-top flexrow" id="s1-band">
         <div class="stonetop-stats-column">${STATS_ROW}${VITALS_ROW}</div>
        </section>
       </div>
       <div class="stonetop-actor-portrait">
        <button type="button" class="stonetop-image-btn"><img class="stonetop-actor-portrait-img" alt="p"></button>
       </div>
      </div>
      <div class="stonetop-band-foot">
       ${LEDGER}
       ${MODE}
       <button type="button" class="stonetop-top-toggle"><i class="fas fa-chevron-up stonetop-top-caret"></i><span class="stonetop-top-toggle-label">Attribute</span></button>
      </div>
     </div>
     <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Moves</button></nav>
     <section class="sheet-body"><div class="tab active">a tab</div></section>
    </div>
   </div>
  </div>
 </div>
</div>`;

const TARGETS = {
	ledger: ".stonetop-folded-ledger",
	lineStats: ".stonetop-folded-ledger .stonetop-folded-stats",
	lineVitals: ".stonetop-folded-ledger .stonetop-folded-vitals",
	handle: ".stonetop-top-toggle",
	band: ".stonetop-band",
	lastLineItem: ".stonetop-folded-ledger .stonetop-folded-vitals li:last-child",
	firstAbbr: ".stonetop-folded-ledger .stonetop-folded-stats li:first-child .stonetop-folded-abbr",
	mode: ".stonetop-band-foot > .stonetop-rollmode",
	portrait: ".stonetop-actor-portrait",
	mastheadDebilities: ".stonetop-masthead-debilities",
	statsColumn: ".stonetop-stats-column",
	firstValue: ".stonetop-folded-ledger .stonetop-folded-stats li:first-child .stonetop-folded-value",
	lineSr: ".stonetop-folded-sr",
	bandStats: ".stonetop-stats-row",
	bandHp: ".stonetop-resource-row--vitals .stonetop-char-hp",
	damageNote: ".stonetop-resource-row--vitals .stonetop-vital:nth-child(3) .stonetop-resource__note",
	tabs: ".sheet-tabs",
};

const measure = opts => probe.measure({
	bodyHtml: fixture(opts), bodyClass: "game themed theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: [`--window-size=${opts.width + 60},800`],
});

/** Drawn, in the only terms "the reader can see this" has. */
const shown = v => v.boxWidth > 0 && v.boxHeight > 0;
const showing = (m, name) => shown(m.get(name).values);

describe.skipIf(!canProbe())("the band and the line are two densities of one thing", () => {
	// ── The band's half ─────────────────────────────────────────────────────────────
	it("keeps the stats off the line while the band is showing them", () => {
		const m = measure({ folded: false, railShut: false, width: 1400 });
		expect(showing(m, "bandStats"), "the band is not showing the stats").toBe(true);
		expect(showing(m, "lineStats"), "both densities are on screen at once").toBe(false);
		expect(showing(m, "lineVitals"), "both densities are on screen at once").toBe(false);
	});

	// The requirement the whole redesign exists for: folding must not take a number off the sheet.
	it("puts the stats and HP on the line the moment the band is folded", () => {
		const m = measure({ folded: true, railShut: false, width: 1400 });
		expect(showing(m, "bandStats"), "the band did not fold").toBe(false);
		expect(showing(m, "lineStats"), "folding the band took the stats with it").toBe(true);
		expect(showing(m, "lineVitals"), "folding the band took HP with it").toBe(true);
	});

	// ── The rail is not this line's business ────────────────────────────────────────
	// XP and Level used to hand off here as a second, independent fold, and it was the wrong trade: a
	// shut rail with an open band left the line holding a row for two numbers under the whole band.
	// They live in the rail and nowhere else, so putting the rail away puts them away — asserted at
	// both widths, because the drawer below the breakpoint starts shut with nothing in the markup
	// saying so and used to be the case that forced them onto the line.
	for (const [label, opts] of [
		["with the rail put away", { folded: false, railShut: true, width: 1400 }],
		["at a drawer's width, untouched", { folded: false, railShut: false, width: 760 }],
	]) {
		it(`leaves the line empty ${label}`, () => {
			const m = measure(opts);
			expect(showing(m, "lineStats"), "the rail dragged the stats onto the line").toBe(false);
			expect(showing(m, "lineVitals"), "the rail dragged HP onto the line").toBe(false);
			expect(m.get("ledger").values.boxHeight, "a shut rail is holding the line open").toBe(0);
		});
	}

	// The band's fold is the only thing that reaches this line, in either direction.
	it("folds the band whatever the rail is doing", () => {
		for (const railShut of [false, true]) {
			const m = measure({ folded: true, railShut, width: 1400 });
			expect(showing(m, "lineStats"), `stats missing with railShut=${railShut}`).toBe(true);
			expect(showing(m, "lineVitals"), `HP missing with railShut=${railShut}`).toBe(true);
		}
	});

	// ── The line itself ─────────────────────────────────────────────────────────────
	// While the band is at full density the line has nothing to say, and a box that still holds its
	// own padding leaves a stripe of empty parchment between the band and the tabs.
	it("collapses to nothing while the band is at full density", () => {
		const m = measure({ folded: false, railShut: false, width: 1400 });
		expect(m.get("ledger").values.boxHeight, "the folded line is holding open a gap").toBe(0);
	});

	it("keeps the line inside the sheet rather than spilling out of it", () => {
		const m = measure({ folded: true, railShut: true, width: 1400 });
		expect(m.get("ledger").overflowX, "the line is cropped horizontally").toBe(0);
	});

	// Swapping densities must not make the tabs jump: the line stands in for the band IN PLACE.
	it("keeps the tabs above the fold in both densities", () => {
		const open = measure({ folded: false, railShut: false, width: 1400 }).get("tabs").values;
		const shut = measure({ folded: true, railShut: false, width: 1400 }).get("tabs").values;
		expect(shut.boxTop, "folding the band pushed the tabs DOWN").toBeLessThan(open.boxTop);
	});

	// ── The roll mode is ONE control, and the fold does not reach it ────────────────
	// Advantage is the last thing you set before rolling, and the band folds precisely so you can roll
	// moves from the rail — so this control has to survive the fold. It is not rendered twice to
	// manage that: it lives in the FOOT, which is the line the numbers fold to, so it ends that line
	// at both densities without moving. Two copies sharing a `name` are one radio group with one
	// checked member, and the copy you could not see was the one the browser kept.
	it("keeps the one mode on screen at both densities", () => {
		for (const folded of [false, true]) {
			const m = measure({ folded, railShut: false, width: 1400 });
			expect(showing(m, "mode"), `the mode is not drawn with folded=${folded}`).toBe(true);
		}
	});

	it("leaves the mode where it was when the band folds", () => {
		const right = v => v.boxLeft + v.boxWidth;
		const open = measure({ folded: false, railShut: false, width: 1400 }).get("mode").values;
		const shut = measure({ folded: true, railShut: false, width: 1400 }).get("mode").values;
		expect(right(shut), "the mode moved sideways when the band folded").toBeCloseTo(right(open), 0);
	});

	// Folded, the numbers and the mode are the same line: that is the whole requirement the fold
	// exists for — the stats, HP/Armor/Damage and the advantage you are about to roll with, on one
	// line, with the moves beside them. Measured with room to hold it; what happens when there is not
	// is the test below.
	it("puts the numbers and the mode on one line once folded", () => {
		const m = measure({ folded: true, railShut: true, width: 1600 });
		const line = m.get("lineStats").values;
		const mode = m.get("mode").values;
		// One line, said as the two boxes sharing it rather than as a delta between their centres: the
		// numbers and the small caps are set at different sizes and hang off a shared BASELINE, so
		// their centres are a couple of pixels apart while sitting on exactly the same line.
		const centre = v => v.boxTop + v.boxHeight / 2;
		const within = (v, box) => v >= box.boxTop && v <= box.boxTop + box.boxHeight;
		expect(within(centre(mode), line), "the mode is on its own row under the numbers").toBe(true);
		expect(within(centre(line), mode), "the numbers are on their own row above the mode").toBe(true);
		expect(mode.boxLeft, "the numbers run past the mode")
			.toBeGreaterThanOrEqual(line.boxLeft + line.boxWidth);
	});

	// And when there is not room — a German sheet with the rail open is already short of it at 1400 —
	// the NUMBERS take the second row and the two controls stay exactly where they were. The foot does
	// not wrap as a row of three: that put the fold chip alone on a second row under the numbers, and
	// a control whose value is being in the same place every time is the worst item on the line to
	// move.
	it("wraps the numbers rather than the controls", () => {
		const m = measure({ folded: true, railShut: false, width: 1400 });
		const right = v => v.boxLeft + v.boxWidth;
		const ledger = m.get("ledger").values;
		expect(ledger.boxHeight, "the numbers did not take a second row")
			.toBeGreaterThan(m.get("mode").values.boxHeight);
		expect(right(m.get("handle").values), "the fold control left the line's end")
			.toBeCloseTo(right(m.get("band").values), 0);
		expect(m.get("mode").values.boxLeft, "the numbers ran into the mode")
			.toBeGreaterThanOrEqual(right(ledger));
	});

	// Expanded, the foot is a row of its own below the numbers — so the mode cannot land on the
	// frames' notes however narrow the sheet gets. It used to sit in the picture's column with a
	// reserved lane to dodge, and it overflowed that column and closed on the notes at the floor.
	it("keeps the mode clear of the frames' notes at every width", () => {
		for (const width of [760, 1400]) {
			const m = measure({ folded: false, railShut: false, width });
			const notes = m.get("damageNote").values;
			expect(m.get("mode").values.boxTop, `the mode rides the notes at ${width}px`)
				.toBeGreaterThanOrEqual(notes.boxTop + notes.boxHeight - 1);
		}
	});

	// The band's three bracketed ticks go with the numbers, so folded there is nothing left saying
	// WHICH debility dimmed the stat whose number just turned red. The masthead's strip is that
	// answer, and it is the same handoff: both densities in the markup, one of them standing down.
	it("names the debilities in the masthead only once the band is folded", () => {
		expect(showing(measure({ folded: false, railShut: false, width: 1400 }), "mastheadDebilities"),
			"both densities of the debilities are on screen at once").toBe(false);
		expect(showing(measure({ folded: true, railShut: false, width: 1400 }), "mastheadDebilities"),
			"folding the band took the debilities with it").toBe(true);
	});

	// In flow under the name, so a wrapped strip grows the masthead instead of running over the line
	// below it — which is what an out-of-flow one did as soon as a font step or a translation made it
	// two lines.
	it("keeps the strip clear of the line below it", () => {
		const m = measure({ folded: true, railShut: false, width: 1400 });
		const strip = m.get("mastheadDebilities").values;
		expect(strip.boxTop + strip.boxHeight, "the strip runs over the folded line")
			.toBeLessThanOrEqual(m.get("ledger").values.boxTop + 1);
	});

	// The picture is the band's other half and the fold takes it whole. Left in, it kept its column
	// and shrank to the masthead's height — a letterbox of a portrait on a line that is there to be
	// one line.
	it("takes the picture off the sheet when the band folds", () => {
		expect(showing(measure({ folded: false, railShut: false, width: 1400 }), "portrait"),
			"the open band has no picture").toBe(true);
		expect(showing(measure({ folded: true, railShut: false, width: 1400 }), "portrait"),
			"folding the band left the picture behind").toBe(false);
	});

	// ── The abbreviations are buttons, and still read as words ──────────────────────
	// Making them roll is markup; keeping them ON the line is layout, and only a renderer can tell the
	// difference. The first attempt reused the tile's `.stonetop-stat-roll`, which is `position:
	// absolute` — a chip punched into the frame's top rule — so all six abbreviations left the flow
	// and the line rendered as six bare zeroes with a stray chip floating over the tabs. Every
	// template assertion still passed: the buttons were there, correctly wired, and invisible.
	it("keeps each abbreviation beside its own value", () => {
		const m = measure({ folded: true, railShut: false, width: 1400 });
		const abbr = m.get("firstAbbr").values;
		const value = m.get("firstValue").values;
		expect(shown(abbr), "the abbreviation is not drawn").toBe(true);
		expect(abbr.boxLeft, "the abbreviation is not on the line with its value")
			.toBeLessThan(value.boxLeft);
		expect(Math.abs(abbr.boxTop - value.boxTop), "the abbreviation left the line's flow")
			.toBeLessThanOrEqual(2);
	});

	// ── The fold control, which is the line's own last item ─────────────────────────
	// It is in flow at the end of the foot, so the line cannot run under it and nothing has to reserve
	// room for it — which is what a 7rem allowance measured against the German word used to do. The
	// German word is still the one that has to fit ("Attribute" for "Stats"), and renderLocalized puts
	// it in the fixture.
	it("keeps the folded line clear of the fold control", () => {
		const m = measure({ folded: true, railShut: true, width: 1400 });
		const rightOf = v => v.boxLeft + v.boxWidth;
		expect(rightOf(m.get("lastLineItem").values), "the line runs under the fold control")
			.toBeLessThanOrEqual(m.get("handle").values.boxLeft);
		expect(m.get("handle").overflowX, "the fold control's own word is cropped").toBe(0);
	});

	// The reader folds the band to get the moves and the numbers on screen together, and then has to
	// be able to put it back. A control that moved between the two densities is a control you have to
	// find again every time you use it.
	it("leaves the handle in one place in both densities", () => {
		const open = measure({ folded: false, railShut: false, width: 1400 }).get("handle").values;
		const shut = measure({ folded: true, railShut: false, width: 1400 }).get("handle").values;
		const rightOf = v => v.boxLeft + v.boxWidth;
		expect(open.boxWidth, "the handle is not drawn while the band is open").toBeGreaterThan(0);
		expect(shut.boxWidth, "folding the band took the handle with it").toBeGreaterThan(0);
		expect(rightOf(shut), "the handle moved sideways when the band folded")
			.toBeCloseTo(rightOf(open), 0);
	});

	// A colour is never the only carrier of anything: a hindered stat says which debility in text,
	// clipped rather than removed so it is still announced.
	it("names the debility in text for a stat it has dimmed", () => {
		const sr = measure({ folded: true, railShut: false, width: 1400 }).get("lineSr").values;
		expect(sr.boxWidth, "the debility's name was removed rather than clipped").toBeLessThan(3);
	});
});
