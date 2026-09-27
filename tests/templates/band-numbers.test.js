// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";
import { LevelUpSnapshotBuilder } from "../../src/model/snapshot/character/LevelUpSnapshot.js";

/**
 * The five framed numbers, in the two places they are actually consulted from.
 *
 * HP, Armor and Damage are read every time a blow lands, so they are in the top band beside the
 * stats. XP and Level are read once a session, so they are in the rail under Advancement — and they
 * are not merely a tidy pair: VitalsSnapshot derives XP's ceiling as 6 + level × 2, so Level
 * computes XP's max. They are one mechanism.
 *
 * What this file holds is that split, and that nothing was lost to it.
 */
const vitals = ({ xp = 4, xpMax = 14, ready = false, notes = {}, sources = {} } = {}) => new VitalsSnapshotBuilder()
	.withHp(new ValueMax(16, 16))
	.withDamage({ value: "d6" })
	.withArmor(1)
	.withLevel(4)
	.withXp(new ValueMax(ready ? xpMax : xp, xpMax))
	.withSources(new VitalsSourcesSnapshot(
		sources.hp ?? "hp sentence", sources.damage ?? "damage sentence", sources.armor ?? "armor sentence"))
	.withNotes(new VitalsNotesSnapshot(notes.hp ?? "playbook", notes.damage ?? "playbook", notes.armor ?? "leather"))
	.build();

const render = (partial, opts = {}, levelUp = null) => renderPartialInto(
	document.createElement("div"), partial,
	{ stonetop: { vitals: vitals(opts), levelUp }, editable: true, sheetIdPrefix: "s1", viewFlags: {} },
);

const band = (opts = {}) => render("stonetop.actor-attributes", opts);
const rail = (opts = {}, levelUp = null) => render("stonetop.advancement", opts, levelUp);

const labelsIn = doc => [...doc.querySelectorAll(".stonetop-resource__label")].map(el => el.textContent.trim());

describe("the band's numbers", () => {
	// The harness's localize() returns the key, by design — so this pins the KEYS the template asks
	// for, which is the half that can silently rot. localization-keys.test.js proves they resolve.
	it("holds what a fight consults, and only that", () => {
		expect(labelsIn(band())).toEqual([
			"HP", "stonetop.character.attributes.armor", "stonetop.character.attributes.damage",
		]);
	});

	// The user rejected "Harm" as a name, and with XP gone there is nothing left for a heading to
	// distinguish this group FROM — the three tiles name themselves, and the band is one region with
	// one heading ("Stats") rather than two idioms side by side.
	it("carries no heading of its own", () => {
		expect(band().querySelector("h3, h4")).toBeNull();
	});

	it("keeps XP and Level out of the band entirely", () => {
		const doc = band();
		expect(doc.querySelector(".stonetop-char-xp")).toBeNull();
		expect(doc.querySelector(".stonetop-char-level")).toBeNull();
	});

	// ── The provenance ──────────────────────────────────────────────────────────────
	// Where each number came from, said to everyone and drawn to no one. It used to be a printed
	// note under each tile — 32px of this row for a word the label's hover already carried — but the
	// hover binds pointer events only, so deleting the note without a replacement would have taken
	// the sentence from assistive tech entirely. The FULL sentence now names the field through
	// aria-describedby; the short note is no longer rendered anywhere.
	describe("the provenance", () => {
		it("names each input with the sentence that explains it", () => {
			const doc = band();
			for (const [cls, sentence] of [
				["stonetop-char-max-hp", "hp sentence"],
				["stonetop-char-armor", "armor sentence"],
				["stonetop-char-damage", "damage sentence"],
			]) {
				const input = doc.querySelector(`.${cls}`);
				// `doc` is the wrapper the partial rendered into, not a Document — so the reference is
				// resolved by id within it, the way the browser would inside the sheet's own subtree.
				const described = doc.querySelector(`#${input.getAttribute("aria-describedby")}`);
				expect(described, `${cls} points at nothing`).not.toBeNull();
				expect(described.textContent.trim()).toBe(sentence);
			}
		});

		// Drawn nowhere: the class is what keeps it out of the picture, and the sheet's own
		// screen-reader-only rule is what makes that true.
		it("draws the sentence nowhere", () => {
			for (const span of band().querySelectorAll(".stonetop-visually-hidden"))
				expect(span.className).toContain("stonetop-visually-hidden");
			expect(band().querySelector(".stonetop-resource__note")).toBeNull();
		});

		// The hover is unchanged and still carries the same sentence, so a mouse user loses nothing.
		it("keeps the full sentence on the label's hover", () => {
			expect(band().querySelector(".stonetop-resource__label").getAttribute("data-tooltip"))
				.toBe("hp sentence");
		});

		it("names nothing where there is nothing to say", () => {
			const armor = band({ sources: { armor: "" } }).querySelectorAll(".stonetop-vital")[1];
			expect(armor.querySelector(".stonetop-visually-hidden")).toBeNull();
			expect(armor.querySelector(".stonetop-char-armor").getAttribute("aria-describedby")).toBeNull();
		});
	});
});

describe("Advancement, in the rail", () => {
	it("puts XP and Level together, and nothing else", () => {
		expect(labelsIn(rail())).toEqual([
			"stonetop.character.attributes.xp", "stonetop.character.attributes.level",
		]);
	});

	it("still renders all five values across the two homes, with none lost to the split", () => {
		const both = band().innerHTML + rail().innerHTML;
		for (const cls of ["stonetop-char-hp", "stonetop-char-armor", "stonetop-char-damage",
			"stonetop-char-xp", "stonetop-char-level"])
			expect(both, `${cls} is missing`).toContain(cls);
	});

	// Level's only candidate — "next at 14" — restates the XP track's own max one tile away.
	it("gives Level no note, because its only candidate restates XP's max", () => {
		const level = rail().querySelectorAll(".stonetop-vital")[1];
		expect(level.querySelector(".stonetop-resource__note")).toBeNull();
	});

	it("marks XP as ready only once the track is full", () => {
		expect(rail().querySelector(".stonetop-resource__note--ready")).toBeNull();
		expect(rail({ ready: true }).querySelector(".stonetop-resource__note--ready").textContent.trim())
			.toBe("stonetop.character.attributes.note.readyToLevel");
	});

	describe("the Level Up strip", () => {
		it("renders nothing at all when the move has not triggered", () => {
			expect(rail().querySelector(".stonetop-levelup")).toBeNull();
		});

		// Directly under the XP track it is about: levelling up is what XP and Level are FOR, and the
		// move spends the one and raises the other.
		it("follows the XP track when it is offered", () => {
			// `isOffered` is derived: the strip shows when it is ready OR something is still owed, and
			// either way it needs rows. One advance row is the minimum that offers itself.
			const offered = new LevelUpSnapshotBuilder().withIsReady(true).withLevel(4).withNewLevel(5)
				.withCost(14)
				.withRows([{ kind: "advance", done: false, isOwed: false, hasControl: true,
					labelKey: "stonetop.character.levelUp.advanceStep" }])
				.build();
			const doc = rail({ ready: true }, offered);

			const strip = doc.querySelector(".stonetop-levelup");
			expect(strip).not.toBeNull();
			const row = doc.querySelector(".stonetop-resource-row--advancement");
			expect(row.contains(strip), "the strip is inside the numbers rather than under them").toBe(false);
			expect(row.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING,
				"the strip is not after the XP track").toBeTruthy();
		});
	});
});
