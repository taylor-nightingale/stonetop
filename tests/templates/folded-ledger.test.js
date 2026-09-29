// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { StatPairSnapshot } from "../../src/model/snapshot/character/StatPairSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";

/**
 * The folded line: its ROLLS, and its conditions.
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

const line = () => renderPartialInto(document.createElement("div"), "stonetop.folded-ledger", {
	stonetop: { statPairs: StatPairSnapshot.pairsFrom(DEBILITIES, STATS) },
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
		for (const b of rollables(line()))
			expect(b.textContent.trim()).toBe(STATS[b.dataset.roll].abbr);
	});

	// HP, Armor and Damage are the rail's (D7): the line is the six stats and their conditions.
	it("carries no vitals", () => {
		const doc = line();
		expect(rollables(doc).map(b => b.dataset.roll)).not.toContain("damage");
		expect(doc.querySelector("[data-change-action='hp'], .stonetop-folded-vitals")).toBeNull();
	});

	// The only field on the line is each pair's condition: this is the density on screen in play,
	// which is when conditions are marked.
	it("offers the three conditions, and nothing else, to change", () => {
		const fields = [...line().querySelectorAll("input, select, textarea")];
		expect(fields.map(el => [el.dataset.changeAction, el.dataset.slug]))
			.toEqual([["debility", "weakened"], ["debility", "dazed"], ["debility", "miserable"]]);
		expect(fields.map(el => el.checked)).toEqual([false, true, false]);
	});

	it("puts each condition after the pair it hinders", () => {
		const pairs = [...line().querySelectorAll(".stonetop-folded-pair")].map(pair => [
			[...pair.querySelectorAll(".stonetop-folded-stat")].map(el => el.dataset.stat),
			pair.querySelector(".stonetop-folded-cond input").dataset.slug,
		]);
		expect(pairs).toEqual([[["str", "dex"], "weakened"], [["int", "wis"], "dazed"], [["con", "cha"], "miserable"]]);
	});

	// The mark is colour on the numbers; the words say it too.
	it("names a marked condition on the stats it hinders, for assistive tech as well", () => {
		const doc = line();
		const pair = doc.querySelectorAll(".stonetop-folded-pair")[1];
		expect(pair.classList.contains("is-active")).toBe(true);
		expect([...pair.querySelectorAll(".stonetop-folded-stat.is-hindered .stonetop-folded-sr")].map(el => el.textContent))
			.toEqual(["Dazed", "Dazed"]);
		expect(pair.querySelector(".stonetop-folded-cond .stonetop-visually-hidden").textContent).toBe("Take disadvantage.");
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
		for (const b of rollables(line()))
			expect(b.getAttribute("aria-label")).toContain(STATS[b.dataset.roll].name);
	});
});
