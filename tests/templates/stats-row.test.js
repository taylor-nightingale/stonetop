// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";

/**
 * The stats row and the debility bands under it, rendered from the REAL partials.
 *
 * Six across, one label per tile. Measured in Chrome at the shipped geometry, "Constitution" is 96px
 * in a 96px tile and German's "Geschicklichkeit" is 118px — so a tile that showed the full name
 * either clipped it or shipped it beside the abbreviation, which is what put six redundant lines on
 * the sheet. The abbreviation is the one label, and it is the roll button.
 */
const stat = (key, value, name, abbr) =>
	new StatSnapshot(key, value, name, abbr, `${name} covers this and that.`);

const STATS = {
	str: stat("str",  1, "Strength",     "STR"),
	dex: stat("dex", -1, "Dexterity",    "DEX"),
	int: stat("int",  2, "Intelligence", "INT"),
	wis: stat("wis",  0, "Wisdom",       "WIS"),
	con: stat("con",  0, "Constitution", "CON"),
	cha: stat("cha", -1, "Charisma",     "CHA"),
};

const DEBILITIES = [
	["weakened",  "Weakened",  ["str", "dex"], "Fatigued, tired, sluggish, shaky. Take disadvantage when rolling +STR or +DEX."],
	["dazed",     "Dazed",     ["int", "wis"], "Out of it, befuddled, not thinking clearly. Take disadvantage when rolling +INT or +WIS."],
	["miserable", "Miserable", ["con", "cha"], "Greatly distressed, angry, unwell, in pain. Take disadvantage when rolling +CON or +CHA."],
];

const debilities = (...active) => DEBILITIES.map(([key, name, stats, description]) =>
	new DebilitySnapshotBuilder()
		.withKey(key).withName(name).withStats(stats).withDescription(description)
		.withActive(active.includes(key))
		.build());

const stats = (editable = true) =>
	renderPartialInto(document.createElement("div"), "stonetop.actor-stats", { stats: STATS, editable });

const bands = (...active) =>
	renderPartialInto(document.createElement("div"), "stonetop.debility-bands", { debilities: debilities(...active) });

describe("the stats row", () => {
	it("draws all six stats in one row, in the book's order", () => {
		const keys = [...stats().querySelectorAll(".stonetop-stat")].map(el => el.dataset.stat);
		expect(keys).toEqual(["str", "dex", "int", "wis", "con", "cha"]);
		expect(stats().querySelectorAll(".stonetop-stats-row")).toHaveLength(1);
	});

	// A tile carried BOTH "Strength" and "STR" once. One label, and it is the one that fits.
	it("gives each tile exactly one label, and it is the abbreviation", () => {
		const str = stats().querySelector('.stonetop-stat[data-stat="str"]');
		expect(str.querySelector(".stonetop-stat-roll").textContent.trim()).toBe("STR");
		expect(str.querySelectorAll(".stonetop-stat-abbr")).toHaveLength(0);
		expect(str.textContent).not.toContain("Strength");
	});

	// Core binds `click` only, so a non-button here is keyboard-dead and nothing says so.
	it("makes the label a real roll button", () => {
		const roll = stats().querySelector(".stonetop-stat-roll");
		expect(roll.tagName).toBe("BUTTON");
		expect(roll.getAttribute("type")).toBe("button");
		expect(roll.dataset.roll).toBe("str");
	});

	// The full name is not lost with the line: it is what the button is CALLED, so a screen reader
	// hears "Roll Strength" rather than "S T R".
	it("names the button with the full stat name, and keeps the hover", () => {
		const roll = stats().querySelector(".stonetop-stat-roll");
		expect(roll.getAttribute("aria-label")).toContain("Strength");
		expect(roll.dataset.tooltip).toContain("Strength covers this");
	});

	it("carries each value on a field bound to its own stat", () => {
		const int = stats().querySelector('.stonetop-stat[data-stat="int"] .stonetop-stat-input');
		expect(int.getAttribute("value")).toBe("2");
		expect(int.getAttribute("name")).toBe("system.stats.int.value");
	});

	// A negative stat is the case a naive `{{#if value}}` drops, and −1 is a score the book hands out
	// at character creation.
	it("renders a negative score rather than an empty box", () => {
		expect(stats().querySelector('.stonetop-stat[data-stat="dex"] .stonetop-stat-input')
			.getAttribute("value")).toBe("-1");
	});

	// Every other write on the sheet is edit-gated; a score a view-only reader can retype is not.
	it("disables the score inputs when the sheet is not editable", () => {
		for (const input of stats(false).querySelectorAll(".stonetop-stat-input"))
			expect(input.hasAttribute("disabled")).toBe(true);
	});
});

describe("the debility bands", () => {
	it("draws one band per debility, in the order the rules pair the stats", () => {
		const names = [...bands().querySelectorAll(".stonetop-debility-label")].map(el => el.textContent.trim());
		expect(names).toEqual(["Weakened", "Dazed", "Miserable"]);
	});

	// The bracket: divider art with the tick framed inside it. It was replaced with a plain circle
	// once, which left the art unreferenced — and the art is the band.
	it("frames each tick in the divider art", () => {
		const band = bands().querySelector(".stonetop-debility-band");
		expect(band.querySelector(".stonetop-debility-divider")).not.toBeNull();
		expect(band.querySelector("input.stonetop-debility-check")).not.toBeNull();
	});

	it("wires the tick to the debility change action, by slug", () => {
		const check = bands().querySelector(".stonetop-debility-check");
		expect(check.dataset.changeAction).toBe("debility");
		expect(check.dataset.slug).toBe("weakened");
	});

	it("ticks and marks only the debility the character has", () => {
		const doc = bands("dazed");
		const [weakened, dazed] = doc.querySelectorAll(".stonetop-debility");
		expect(dazed.querySelector(".stonetop-debility-check").hasAttribute("checked")).toBe(true);
		expect(dazed.className).toContain("is-active");
		expect(weakened.querySelector(".stonetop-debility-check").hasAttribute("checked")).toBe(false);
		expect(weakened.className).not.toContain("is-active");
	});

	// The effect is carried in both states and DRAWN in neither: the band is a row of bracket art one
	// line tall, and three sentences of rules text took it from 34px to 98px — shoving the picture,
	// the tabs and the whole sheet down at the moment a fight is going badly. What it must not do is
	// vanish: the hover is pointer-bound and invisible to assistive tech, so the sentence stays and
	// the tick is described by it. (That it is clipped rather than drawn is band-render's to measure.)
	it("carries every effect in words, marked or not", () => {
		const effects = [...bands("dazed").querySelectorAll(".stonetop-debility-effect")]
			.map(el => el.textContent.trim());
		expect(effects).toHaveLength(3);
		expect(effects[1]).toContain("Take disadvantage when rolling +INT or +WIS.");
	});

	it("describes each tick by the sentence that says what it does", () => {
		for (const band of bands("dazed").querySelectorAll(".stonetop-debility")) {
			const described = band.querySelector(".stonetop-debility-check").getAttribute("aria-describedby");
			expect(described, "the tick is described by nothing").toBeTruthy();
			expect(band.querySelector(`#${described}`), "the tick names an id that is not here")
				.not.toBeNull();
		}
	});

	// The hover is a convenience now rather than the only carrier, which was the accessibility fault.
	it("keeps the hover in both states", () => {
		for (const doc of [bands(), bands("weakened")]) {
			expect(doc.querySelector(".stonetop-debility-control").dataset.tooltip)
				.toContain("Take disadvantage when rolling +STR or +DEX.");
		}
	});
});

/**
 * The masthead's debility strip: the folded density of the same three ticks.
 *
 * The band's brackets are off the sheet when it is folded, and a hindered stat's red number is left
 * asking which debility dimmed it. The strip answers that in the room the crest's overhang already
 * owns under the name. Whether it is DRAWN is the fold's business and folded-ledger-render's to
 * measure; what is here is that it says the right thing, and says it nowhere else.
 */
describe("the masthead's debility strip", () => {
	const header = (...active) => renderPartialInto(document.createElement("div"), "stonetop.actor-header", {
		stonetop: { debilities: debilities(...active) },
		actor: { name: "Blodwen", img: "p.png" }, editable: true,
	});
	const rows = doc => [...doc.querySelectorAll(".stonetop-masthead-debility")];

	// All three, in the book's order, marked or not — the steading's own rule for its ledger line.
	// Drawing only the ones you have would move the rest under the pointer the moment you marked one,
	// and there would be nothing to click to mark them in the first place.
	it("lists all three in the book's order", () => {
		expect(rows(header("dazed")).map(li => li.querySelector(".stonetop-masthead-debility-name").textContent.trim()))
			.toEqual(["Weakened", "Dazed", "Miserable"]);
	});

	it("marks the ones the character has", () => {
		const [weakened, dazed] = rows(header("dazed"));
		expect(dazed.className).toContain("is-active");
		expect(weakened.className).not.toContain("is-active");
	});

	// The same control the band's tick is: one change action, one handler, nothing to keep in step.
	it("ticks from here, through the band's own change action", () => {
		const [weakened, dazed] = rows(header("dazed"));
		const check = li => li.querySelector(".stonetop-masthead-debility-check");
		expect(check(weakened).dataset.changeAction).toBe("debility");
		expect(check(weakened).dataset.slug).toBe("weakened");
		expect(check(dazed).hasAttribute("checked")).toBe(true);
		expect(check(weakened).hasAttribute("checked")).toBe(false);
	});

	// What it IS, after a dash — the shape the steading writes a condition in, cut to the first
	// sentence. The clause that names the stats is not dropped so much as already said: those two
	// numbers are the red ones on the line directly below this. The two debilities you do not have
	// keep their names and drop their sentences (a stylesheet's job — both are in the markup either
	// way, so nothing has to re-render when one is ticked).
	it("says what each one is, in its first sentence", () => {
		const effect = li => li.querySelector(".stonetop-masthead-debility-effect").textContent.trim();
		const [, dazed] = rows(header("dazed"));
		expect(effect(dazed)).toContain("Out of it, befuddled, not thinking clearly.");
		expect(effect(dazed), "the whole description is on the line")
			.not.toContain("Take disadvantage");
	});

	// `actor-header.hbs` is the NPC card's masthead too, and an NPC has none — so the strip has to be
	// absent rather than empty there, which is what keying it on the context buys.
	it("is not in an NPC's masthead at all", () => {
		const npc = renderPartialInto(document.createElement("div"), "stonetop.actor-header", {
			stonetop: {}, actor: { name: "Cadi", img: "p.png" }, editable: true,
		});
		expect(npc.querySelector(".stonetop-masthead-debilities")).toBeNull();
	});
});
