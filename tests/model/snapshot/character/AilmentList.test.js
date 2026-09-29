import { describe, it, expect } from "vitest";
import { AilmentList, AilmentRow } from "../../../../src/model/snapshot/character/AilmentList.js";
import { DebilitySnapshotBuilder } from "../../../../src/model/snapshot/character/DebilitySnapshot.js";
import { Wound } from "../../../../src/model/data/character/Wound.js";

// D7: what is wrong with you, as one region — the marked debilities as readouts, then the wounds.
// Three rows always; the rest counted on the bar.
const debility = (key, name, active) => new DebilitySnapshotBuilder().withKey(key).withName(name)
	.withActive(active).withStats([]).withDescription(`${name} for now. Take disadvantage.`).build();
const DEBILITIES = [debility("weakened", "Weakened", false), debility("dazed", "Dazed", true), debility("miserable", "Miserable", true)];
const wound = (id, name, state) => new Wound(id, name, state);

describe("AilmentList.from", () => {
	it("lists only the marked debilities, each by name and its first sentence", () => {
		const list = AilmentList.from(DEBILITIES, []);
		expect(list.shown.map(r => [r.kind, r.name, r.note])).toEqual([
			["debility", "Dazed", "Dazed for now."], ["debility", "Miserable", "Miserable for now."],
		]);
	});

	it("puts the wounds after them, each carrying its state", () => {
		const list = AilmentList.from([], [wound("w1", "broken arm", "stabilized")]);
		const [row] = list.shown;
		expect([row.kind, row.name, row.woundId, row.state]).toEqual(["wound", "broken arm", "w1", "stabilized"]);
		expect(row.stateKey).toBe("stonetop.character.wounds.state.stabilized");
	});

	it("says nothing about a wound that is simply active", () => {
		expect(AilmentList.from([], [wound("w1", "cut", "active")]).shown[0].stateKey).toBeNull();
	});

	it("shows three rows and counts the rest", () => {
		const list = AilmentList.from(DEBILITIES, [wound("a", "a", "active"), wound("b", "b", "active"), wound("c", "c", "active")]);
		expect(list.shown).toHaveLength(3);
		expect(list.moreCount).toBe(2);
	});

	// The editor's + writes an empty line to type into; until something is typed, nothing ails you.
	it("leaves out a wound with no name", () => {
		const list = AilmentList.from([], [wound("w1", "", "active"), wound("w2", "cut", "active")]);
		expect(list.shown.map(r => r.woundId)).toEqual(["w2"]);
		expect(AilmentList.from([], [wound("w1", " ", "active")]).isEmpty).toBe(true);
	});

	it("counts nothing while everything fits", () => {
		expect(AilmentList.from(DEBILITIES, []).moreCount).toBe(0);
	});

	it("is empty with nothing marked and no wounds", () => {
		expect(AilmentList.from([debility("weakened", "Weakened", false)], []).isEmpty).toBe(true);
		expect(AilmentList.from(DEBILITIES, []).isEmpty).toBe(false);
	});

	it("is built of typed rows with own fields", () => {
		const [row] = AilmentList.from(DEBILITIES, []).shown;
		expect(row).toBeInstanceOf(AilmentRow);
		expect(Object.keys(row)).toEqual(expect.arrayContaining(["kind", "name", "note", "woundId", "state", "stateKey"]));
	});
});

describe("CharacterSnapshot's band readouts", () => {
	it("derives the instinct, the appearance and the ailments from what it was given", async () => {
		const { CharacterSnapshotBuilder } = await import("../../../../src/model/snapshot/character/CharacterSnapshot.js");
		const { PlaybookSnapshotBuilder } = await import("../../../../src/model/snapshot/character/PlaybookSnapshot.js");
		const { InstinctReadout } = await import("../../../../src/model/snapshot/character/InstinctReadout.js");
		const { AppearanceLine } = await import("../../../../src/model/snapshot/character/AppearanceLine.js");
		const snap = new CharacterSnapshotBuilder()
			.withPlaybook(new PlaybookSnapshotBuilder().withName("The Marshal").withInstinctSelected("Duty").build())
			.withDebilities(DEBILITIES).withStats({}).withWounds([wound("w1", "bad knee", "permanent")])
			.build();
		expect(snap.instinct).toBeInstanceOf(InstinctReadout);
		expect(snap.instinct.label).toBe("Duty");
		expect(snap.appearance).toBeInstanceOf(AppearanceLine);
		expect(snap.appearance.isEmpty).toBe(true);
		expect(snap.ailments.shown.map(r => r.name)).toEqual(["Dazed", "Miserable", "bad knee"]);
	});
});
