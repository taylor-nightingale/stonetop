import { renderLocalized } from "./localizedPartial.js";
import { CharacterSnapshotBuilder } from "../../src/model/snapshot/character/CharacterSnapshot.js";
import { PlaybookSnapshotBuilder } from "../../src/model/snapshot/character/PlaybookSnapshot.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";
import { MoveCategorySnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { MovelistBuilder } from "../../src/model/snapshot/character/Movelist.js";
import { buildChoiceGroup } from "../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../src/model/snapshot/character/ChoiceGroup.js";
import { Wound } from "../../src/model/data/character/Wound.js";

/**
 * The character's top band, as the sheet draws it: the REAL `character-band` partial over a REAL
 * CharacterSnapshot, in German, where the words are longest. Shared by the band's render tests, so
 * none of them measures a hand-copied description of what the template emits.
 */

export const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const stat = (key, value, name, abbr) => new StatSnapshot(key, value, name, abbr, `${name}.`);
const STATS = {
	str: stat("str",  1, "Stärke",           "STR"),
	dex: stat("dex", -1, "Geschicklichkeit", "DEX"),
	int: stat("int",  2, "Intelligenz",      "INT"),
	wis: stat("wis",  0, "Weisheit",         "WIS"),
	con: stat("con",  0, "Konstitution",     "CON"),
	cha: stat("cha", -1, "Charisma",         "CHA"),
};

const debilities = marked => [
	["weakened",  "Weakened",  ["str", "dex"], "Fatigued, tired, sluggish, shaky. Take disadvantage when rolling +STR or +DEX."],
	["dazed",     "Dazed",     ["int", "wis"], "Out of it, befuddled, not thinking clearly. Take disadvantage when rolling +INT or +WIS."],
	["miserable", "Miserable", ["con", "cha"], "Greatly distressed, angry, unwell, in pain. Take disadvantage when rolling +CON or +CHA."],
].map(([key, name, stats, description]) => new DebilitySnapshotBuilder()
	.withKey(key).withName(name).withStats(stats).withDescription(description)
	.withActive(marked.includes(key)).build());

const APPEARANCE = { slug: "appearance", list: [
	{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "grizzled", text: "grizzled and weather-worn" }] },
	{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "voice", text: "a rumbling voice" }] },
	{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "badge", text: "a badge of office, polished daily" }] },
]};

const playbook = () => new PlaybookSnapshotBuilder()
	.withSlug("the-marshal").withName("The Marshal").withTitle("The Marshal")
	.withStatsNote("Assign these scores: +2, +1, +1, 0, 0, -1")
	.withInstinctSelected("Duty — to see the job done, whatever it costs you and yours")
	.withAppearanceGroup(buildChoiceGroup(APPEARANCE, new ChoiceValues({ appearance: { grizzled: 1, voice: 1, badge: 1 } })))
	.build();

const ADVANTAGE = { slug: "advantage-disadvantage", name: "Advantage/Disadvantage", replaces: null };

const moves = () => new MovelistBuilder()
	.withCategories([new MoveCategorySnapshotBuilder().withKey("special").withLabel("special").withMoves([ADVANTAGE]).build()])
	.withBySlug({}).build();

/**
 * @param {object} [options]
 * @param {string[]} [options.marked] debility keys to mark
 * @param {Array<[string, string]>} [options.wounds] [name, state] pairs
 */
export const bandSnapshot = ({ marked = ["weakened"], wounds = [["broken arm", "stabilized"]] } = {}) =>
	new CharacterSnapshotBuilder()
		.withPlaybook(playbook()).withStats(STATS).withDebilities(debilities(marked))
		.withWounds(wounds.map(([name, state], i) => new Wound(`w${i}`, name, state)))
		.withRollMode("normal").withMoves(moves())
		.build();

/** The band's markup, from the real partial, in `lang` (German unless asked). */
export const bandHtml = ({ ailmentsOpen = false, lang = "de", ...options } = {}) => renderLocalized("stonetop.character-band", {
	stonetop: bandSnapshot(options),
	actor: { name: "Blodwen", img: "p.webp" },
	editable: true, sheetIdPrefix: "s1", viewFlags: {}, ailmentsOpen,
}, lang);

/** The band with the classes BandFootFit would have put on it. */
export const withFoot = (html, ...classes) => {
	const marked = html.replace(/class="stonetop-band\b/, `class="stonetop-band ${classes.join(" ")}`);
	if (marked === html) throw new Error("withFoot: no band in the markup");
	return marked;
};

/**
 * The band where the sheet puts it: beside the rail, over the tabs. `wrapper` is the class list the
 * sheet wrapper carries (`top-collapsed` when folded), `layout` the rail layout's (`rail-shut`).
 */
export const sheetWithBand = ({ width = 1160, wrapper = "", layout = "", band = bandHtml() } = {}) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 900px">
 <div class="window-content"><div class="sheet-wrapper ${wrapper}">
  <div class="stonetop-rail-layout ${layout}">
   <button type="button" class="stonetop-rail-toggle"><i class="fas fa-chevron-left stonetop-rail-caret"></i></button>
   <div class="stonetop-rail stonetop-moves-rail" id="s1-moves-rail"><p>rail</p></div>
   <div class="stonetop-rail-main character-main">
    ${band}
    <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Moves</button></nav>
    <section class="sheet-body"><div class="tab active">a tab</div></section>
   </div>
  </div>
 </div></div>
</div>`;

/** The window has to be wider than the sheet, or the rail's layout is a drawer whatever it says. */
export const windowFor = width => [`--window-size=${width + 60},960`];
