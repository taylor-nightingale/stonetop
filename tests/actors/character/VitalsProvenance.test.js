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
