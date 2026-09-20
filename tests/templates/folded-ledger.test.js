// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { StatPairSnapshot } from "../../src/model/snapshot/character/StatPairSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";

/**
 * The folded line's ROLLS.
 *
 * The band is folded precisely to get the numbers and the moves on screen together, so a line you
 * cannot roll from costs the fold the thing it was for — which is what it did: the abbreviations
 * were plain <span>s while the steading's own line kept every rating rollable, because over there the
 * line is the same partial at another density rather than a second one.
 *
 * Nothing new runs to make this work. StonetopActorSheetV2 delegates every `.rollable[data-roll]`
 * click in the sheet to the actor, so the whole of "the line rolls" is the markup asserted here —
 * which is exactly the half that can rot silently, since a <span> that lost its button looks
 * identical and simply stops responding.
 */
const STATS = {
	str: new StatSnapshot("str",  1, "Strength",     "STR", "Raw physical power."),
	dex: new StatSnapshot("dex", -1, "Dexterity",    "DEX", "Agility and reflexes."),
	int: new StatSnapshot("int",  2, "Intelligence", "INT", "Book learning."),
	wis: new StatSnapshot("wis",  0, "Wisdom",       "WIS", "Perception and insight."),
	con: new StatSnapshot("con",  0, "Constitution", "CON", "Health and stamina."),
	cha: new StatSnapshot("cha", -1, "Charisma",     "CHA", "Force of personality."),
};

const DEBILITIES = [
	["weakened",  "Weakened",  ["str", "dex"], false],
	["dazed",     "Dazed",     ["int", "wis"], true],
	["miserable", "Miserable", ["con", "cha"], false],
].map(([key, name, stats, active]) => new DebilitySnapshotBuilder()
	.withKey(key).withName(name).withStats(stats).withActive(active)
	.withDescription("Take disadvantage.").build());

const VITALS = new VitalsSnapshotBuilder()
	.withHp(new ValueMax(16, 16)).withDamage({ value: "d6" }).withArmor(1)
	.withLevel(4).withXp(new ValueMax(14, 14))
	.withSources(new VitalsSourcesSnapshot("hp sentence", "damage sentence", "armor sentence"))
	.withNotes(new VitalsNotesSnapshot("playbook", "playbook", "leather"))
	.build();

const line = () => renderPartialInto(document.createElement("div"), "stonetop.folded-ledger", {
	stonetop: { vitals: VITALS, statPairs: StatPairSnapshot.pairsFrom(DEBILITIES, STATS) },
	editable: true, sheetIdPrefix: "s1", viewFlags: {},
});

describe("the folded line rolls", () => {
	// The selector the sheet's delegation actually listens for. Asserted as one string rather than as
	// "is a button" and "has data-roll" separately, because either half alone is silently inert.
	const rollables = doc => [...doc.querySelectorAll("button.rollable[data-roll]")];

	it("makes every stat's abbreviation its roll button", () => {
		expect(rollables(line()).map(b => b.dataset.roll))
			.toEqual(expect.arrayContaining(["str", "dex", "int", "wis", "con", "cha"]));
	});

	it("rolls the same stat the abbreviation names", () => {
		for (const b of rollables(line()).filter(b => b.dataset.roll !== "damage"))
			expect(b.textContent.trim()).toBe(STATS[b.dataset.roll].abbr);
	});

	it("carries the damage die too", () => {
		expect(rollables(line()).map(b => b.dataset.roll)).toContain("damage");
	});

	// HP and Armor are numbers you read, not rolls you make — at either density.
	it("offers no roll for HP or Armor", () => {
		expect(rollables(line()).map(b => b.dataset.roll)).not.toContain("hp");
		expect(rollables(line()).map(b => b.dataset.roll)).not.toContain("armor");
	});

	// A roll is not an edit, and this line is readouts — with ONE exception, argued for by the fold
	// itself: HP is the number that changes while you are looking at the moves you folded the band to
	// see. Everything else stays a readout, and "HP got steppers" must not become "the line grew a
	// second copy of the band".
	it("offers HP, and only HP, to edit", () => {
		const fields = [...line().querySelectorAll("input, select, textarea")];
		expect(fields.map(el => el.dataset.changeAction)).toEqual(["hp"]);
		expect(fields[0].value).toBe(String(VITALS.hp.value));
	});

	// Two carets, not a field to type in — it is still a readout you can see at a glance. They are
	// the shared stepper component, so the one delegated handler in stepper.js drives them; a pair of
	// hand-rolled buttons here would be a second implementation to keep in step.
	it("gives HP the shared stepper, both directions", () => {
		const stepper = line().querySelector(".stonetop-folded-hp .stonetop-stepper");
		expect(stepper.querySelector("input.stonetop-step"), "the stepper has no input to drive")
			.not.toBeNull();
		expect([...stepper.querySelectorAll(".stonetop-stepper-btn")].map(b => b.dataset.stepDir))
			.toEqual(["1", "-1"]);
	});

	// HP cannot go below zero from here any more than it can in the band.
	it("floors HP at zero", () => {
		expect(line().querySelector(".stonetop-folded-input").getAttribute("min")).toBe("0");
	});

	// Where each number came from travels with it. The hover is pointer-bound and invisible to
	// assistive tech, so the sentence is in the DOM as well — clipped, the way the hindered stat's
	// debility name is.
	it("says where HP, Armor and Damage came from, in text as well as on hover", () => {
		const doc = line();
		const said = [...doc.querySelectorAll(".stonetop-folded-vitals .stonetop-folded-sr")]
			.map(el => el.textContent.trim());
		expect(said).toEqual(["hp sentence", "armor sentence", "damage sentence"]);
		const hovers = [...doc.querySelectorAll(".stonetop-folded-vitals [data-tooltip]")]
			.map(el => el.dataset.tooltip);
		expect(hovers).toEqual(["hp sentence", "armor sentence", "damage sentence"]);
	});

	// It has to BE a <button>: core binds only `click` for these, so a rollable <span> is keyboard
	// dead, and nothing about a span says so.
	it("leaves no rollable that a keyboard cannot reach", () => {
		const doc = line();
		expect([...doc.querySelectorAll(".rollable")].filter(el => el.tagName !== "BUTTON")).toHaveLength(0);
	});

	// The full density names the button for assistive tech rather than leaving it as three letters;
	// the line does the same, from the same key. "STR" spoken aloud is not a word.
	it("names each stat button in full, not by its abbreviation", () => {
		for (const b of rollables(line()).filter(b => b.dataset.roll !== "damage"))
			expect(b.getAttribute("aria-label")).toContain(STATS[b.dataset.roll].name);
	});
});
