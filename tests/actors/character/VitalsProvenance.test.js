import { describe, it, expect } from "vitest";
import { VitalsProvenance } from "../../../src/actors/character/VitalsProvenance.js";
import { ArmorBreakdown } from "../../../src/model/data/character/ArmorBreakdown.js";
import { VitalsSourcesSnapshot } from "../../../src/model/snapshot/character/VitalsSnapshot.js";
import { OutfitItemBuilder } from "../../../src/model/data/character/OutfitItem.js";

// The playbook item's system data, as CharacterPlaybook.getData() hands it over.
const BLESSED = { name: "The Blessed", hp: 18, damage: { value: "d6" } };

function armorFrom(...entries) {
	return ArmorBreakdown.fromItems(entries.map(([name, armor]) =>
		new OutfitItemBuilder().withSlug(name).withName(name).withArmor(armor).build()));
}

function provenance(playbook = BLESSED, armor = ArmorBreakdown.empty()) {
	return new VitalsProvenance(playbook, armor);
}

describe("VitalsProvenance.describeHp", () => {
	it("credits the playbook when max HP still matches it", () => {
		expect(provenance().describeHp(18)).toBe("Max HP 18 comes from your playbook, The Blessed.");
	});

	it("reports a hand-edited max HP and what the playbook grants", () => {
		expect(provenance().describeHp(20))
			.toBe("Manually set to 20. Your playbook, The Blessed, grants 18.");
	});

	it("points at picking a playbook when there is none", () => {
		expect(provenance(null).describeHp(8))
			.toBe("Manually set to 8. Pick a playbook to inherit its max HP.");
	});
});

describe("VitalsProvenance.describeDamage", () => {
	it("credits the playbook when the die still matches it", () => {
		expect(provenance().describeDamage("d6"))
			.toBe("Damage die d6 comes from your playbook, The Blessed. It's rolled on its own — add anything moves or the fiction grant.");
	});

	it("reports a hand-edited die and what the playbook grants", () => {
		expect(provenance().describeDamage("d8"))
			.toBe("Manually set to d8. Your playbook, The Blessed, grants d6.");
	});

	it("points at picking a playbook when a die is set without one", () => {
		expect(provenance(null).describeDamage("d8"))
			.toBe("Manually set to d8. Pick a playbook to inherit its damage die.");
	});

	it("names the playbook's die when no die is set yet", () => {
		expect(provenance().describeDamage(null))
			.toBe("No damage die set. Your playbook, The Blessed, grants d6.");
	});

	it("points at picking a playbook when neither a die nor a playbook is set", () => {
		expect(provenance(null).describeDamage(null))
			.toBe("No damage die set. Pick a playbook to inherit its damage die.");
	});

	it("treats a playbook with no damage die as no source", () => {
		expect(provenance({ name: "The Seeker", hp: 16, damage: null }).describeDamage("d4"))
			.toBe("Manually set to d4. Pick a playbook to inherit its damage die.");
	});
});

describe("VitalsProvenance.describeArmor", () => {
	it("lists the gear behind the value, base first", () => {
		const armor = armorFrom(["Chain mail", { base: 2 }], ["Shield", { modifier: 1 }]);
		expect(provenance(BLESSED, armor).describeArmor(3))
			.toBe("Armor 3 from your checked gear: Chain mail 2 (base), Shield +1. Only the highest base counts, plus every modifier.");
	});

	it("reports a hand-edited value against what the gear adds up to", () => {
		const armor = armorFrom(["Chain mail", { base: 2 }], ["Shield", { modifier: 1 }]);
		expect(provenance(BLESSED, armor).describeArmor(4))
			.toBe("Manually set to 4. Your checked gear adds up to 3: Chain mail 2 (base), Shield +1.");
	});

	it("signs a negative modifier", () => {
		const armor = armorFrom(["Chain mail", { base: 2 }], ["Cracked helm", { modifier: -1 }]);
		expect(provenance(BLESSED, armor).describeArmor(1))
			.toContain("Cracked helm -1");
	});

	it("says so when armor is set by hand with no gear behind it", () => {
		expect(provenance(BLESSED).describeArmor(2))
			.toBe("Manually set to 2. No checked item grants armor.");
	});

	it("reports plain 0 armor without calling it a hand edit", () => {
		expect(provenance(BLESSED).describeArmor(0)).toBe("No checked item grants armor.");
	});
});

describe("VitalsProvenance.build", () => {
	it("returns a VitalsSourcesSnapshot carrying all three descriptions", () => {
		const armor    = armorFrom(["Shield", { modifier: 1 }]);
		const snapshot = provenance(BLESSED, armor).build(18, "d6", 1);
		expect(snapshot).toBeInstanceOf(VitalsSourcesSnapshot);
		expect(snapshot.hp).toContain("Max HP 18");
		expect(snapshot.damage).toContain("Damage die d6");
		expect(snapshot.armor).toContain("Shield +1");
	});
});

/**
 * The same provenance, short enough to print.
 *
 * The `describe*` sentences are hover text, and Foundry's tooltips are pointer-only and invisible to
 * assistive tech — so where a number came from was never actually stated on the sheet. The notes are
 * what the vitals tiles print beside the value, the way a steading rating prints its band, and they
 * are derived from the same comparison so the two can never disagree.
 */
describe("VitalsProvenance notes", () => {
	describe("HP", () => {
		it("credits the playbook while max HP still matches it", () => {
			expect(provenance().noteForHp(18)).toBe("playbook");
		});

		it("says so when the max was typed in instead", () => {
			expect(provenance().noteForHp(20)).toBe("by hand");
		});

		it("says so when there is no playbook to credit", () => {
			expect(provenance(null).noteForHp(12)).toBe("by hand");
		});
	});

	describe("damage", () => {
		it("credits the playbook while the die still matches it", () => {
			expect(provenance().noteForDamage("d6")).toBe("playbook");
		});

		it("says so when the die was typed in instead", () => {
			expect(provenance().noteForDamage("d10")).toBe("by hand");
		});

		// A character with no die set at all — the state a fresh actor is in before a playbook drops.
		it("reports an unset die rather than crediting anything", () => {
			expect(provenance().noteForDamage(null)).toBe("none set");
			expect(provenance(null).noteForDamage(null)).toBe("none set");
		});
	});

	describe("armor", () => {
		it("names the gear the value adds up from", () => {
			expect(provenance(BLESSED, armorFrom(["leather", { base: 1 }])).noteForArmor(1)).toBe("leather");
		});

		// "why is my armour 2?" is the question, and the two item names are the whole answer.
		it("names every contributing item, not just the base", () => {
			const note = provenance(BLESSED, armorFrom(["leather", { base: 1 }], ["shield", { modifier: 1 }])).noteForArmor(2);
			expect(note).toContain("leather");
			expect(note).toContain("shield");
		});

		it("says nothing is worn when no checked gear grants armor and the value is 0", () => {
			expect(provenance().noteForArmor(0)).toBe("none worn");
		});

		it("says so when armor was typed in with no gear behind it", () => {
			expect(provenance().noteForArmor(2)).toBe("by hand");
		});

		// Gear that adds up to 1 while the stored value says 3: the gear is not the explanation.
		it("says so when the stored value disagrees with the gear", () => {
			expect(provenance(BLESSED, armorFrom(["leather", { base: 1 }])).noteForArmor(3)).toBe("by hand");
		});
	});

	// The constraint these live under: a Damage tile can be a third of a 244px rail, and a note longer
	// than a word or two wraps to three lines and makes the row taller than the frames in it.
	it("keeps every note short enough for the narrowest tile", () => {
		const notes = provenance(BLESSED, armorFrom(["leather", { base: 1 }])).buildNotes(18, "d6", 1);
		for (const note of [notes.hp, notes.damage, notes.armor])
			expect(note.length, `"${note}" is too long to sit under a tile`).toBeLessThanOrEqual(16);
	});

	it("builds all three notes together", () => {
		const notes = provenance(BLESSED, armorFrom(["leather", { base: 1 }])).buildNotes(18, "d6", 1);
		expect(notes.hp).toBe("playbook");
		expect(notes.damage).toBe("playbook");
		expect(notes.armor).toBe("leather");
	});

	// The note and the sentence are two lengths of one derivation; a note that credited the playbook
	// while the sentence said "manually set" would be the drift this pairing exists to prevent.
	it("agrees with the sentence about whether a value came from the playbook", () => {
		const p = provenance();
		expect(p.describeHp(18)).toContain("The Blessed");
		expect(p.noteForHp(18)).toBe("playbook");

		expect(p.describeHp(20)).toContain("Manually set");
		expect(p.noteForHp(20)).toBe("by hand");
	});
});
