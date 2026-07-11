import { describe, it, expect } from "vitest";
import { buildArcanumSnapshot, buildArcanumOutfitItem, buildArcanumMoveSnapshot } from "../../../src/actors/character/arcanumSnapshot.js";
import { MoveSnapshot } from "../../../src/model/snapshot/character/MoveSnapshot.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";
import { Arcanum } from "../../../src/model/data/character/Arcanum.js";

const richArcanum = () => new Arcanum({
	slug: "azure", major: true, name: "Azure Hand", img: null,
	front: {
		title: "Azure Hand", description: "a staff", item: { name: "Azure Hand", weight: 1, note: "magical" },
		unlock: { slug: "azure", list: [{ type: "entry", slug: "marks", content: { text: "Marks" }, track: { max: 4 } }] },
	},
	back: {
		title: "Mysteries", description: "the back", resource: { max: 2, labels: ["a", "b"] },
		choices: { slug: "choices", list: [] },
		moves: [{ id: "battery", name: "Battery", text: "store energy" }],
		consequences: { slug: "consequences", list: [{ type: "entry", slug: "c1", content: { text: "burned" }, track: { max: 1 } }] },
		unlockAt: "after 4 marks",
	},
});

describe("buildArcanumSnapshot", () => {
	it("maps a full arcanum to front/back snapshots", () => {
		const s = buildArcanumSnapshot(richArcanum(), { flipped: true });
		expect(s).toMatchObject({ slug: "azure", major: true, name: "Azure Hand", owned: true, flipped: true });
		expect(s.front.title.raw).toBe("Azure Hand");
		expect(s.front.item.name).toBe("Azure Hand");
		expect(s.front.unlock).toBeTruthy();            // ChoiceGroup
		expect(s.back.resource).toBeTruthy();           // ResourceSnapshot
		expect(s.back.moves).toHaveLength(1);
		expect(s.back.moves[0]).toBeInstanceOf(MoveSnapshot);
		expect(s.back.moves[0]).toMatchObject({ name: "Battery" });
		expect(s.back.moves[0].description.raw).toBe("store energy");
		expect(s.back.consequences).toBeTruthy();
		expect(s.back.unlockAt).toBe("after 4 marks");
	});

	it("carries a diamond-less front's disguise tags through to the snapshot (item stays null)", () => {
		const a = new Arcanum({ slug: "the-key", front: { title: "A... key?", tags: "magical, terrifying", description: "a white thing" }, back: {} });
		const s = buildArcanumSnapshot(a);
		expect(s.front.item).toBeNull();
		expect(s.front.tags).toBe("magical, terrifying");
	});

	it("uses caller-supplied moveSnapshots (major arcana real moves) over inline back.moves", () => {
		const real = [{ name: "Real Battery" }, { name: "Real Resonance" }];
		const s = buildArcanumSnapshot(richArcanum(), { moveSnapshots: real });
		expect(s.back.moves).toBe(real);
	});

	it("defaults (preview): not flipped/owned, empty groups → null, no stats crash", () => {
		const s = buildArcanumSnapshot(new Arcanum({ slug: "x", front: {}, back: {} }));
		expect(s.flipped).toBe(false);
		expect(s.owned).toBe(true);
		expect(s.front.unlock).toBeNull();
		expect(s.back.choices).toBeNull();
		expect(s.back.resource).toBeNull();
		expect(s.back.moves).toEqual([]);
	});

	it("reads unlock, back.choices, and consequences from the ONE choiceValues store by each group's own slug", () => {
		const choiceValues = new ChoiceValues({
			azure:        { marks: 3 },   // unlock group slug = "azure"
			consequences: { c1: 1 },      // consequences group slug = "consequences"
		});
		const s = buildArcanumSnapshot(richArcanum(), { flipped: true, choiceValues });
		// unlock track (max 4) reflects stored count of 3
		expect(s.front.unlock.list[0].track.checks).toEqual([true, true, true, false]);
		// consequence c1 (default track max 1) reflects the stored check
		expect(s.back.consequences.list[0].track.checks).toEqual([true]);
	});

	it("consequences default to unchecked when the store has no value (regression: #50)", () => {
		const s = buildArcanumSnapshot(richArcanum(), { flipped: true });
		expect(s.back.consequences.list[0].track.checks).toEqual([false]);
	});

	it("buildArcanumOutfitItem returns null for no item; maps fields otherwise", () => {
		expect(buildArcanumOutfitItem("x", null)).toBeNull();
		expect(buildArcanumOutfitItem("x", { name: "Cloak", weight: 1 })).toMatchObject({ slug: "x", name: "Cloak", weight: 1 });
	});
});

describe("buildArcanumMoveSnapshot", () => {
	it("maps an arcanum mystery move into an always-active, non-selectable MoveSnapshot", () => {
		const m = buildArcanumMoveSnapshot({ id: "battery", name: "Battery", text: "store energy" });
		expect(m).toBeInstanceOf(MoveSnapshot);
		expect(m).toMatchObject({
			id: "battery", slug: "battery", name: "Battery",
			rollStat: null, selectable: false, resource: null, requirement: null, choices: null,
		});
		expect(m.description.raw).toBe("store energy");
		expect(m.selection).toEqual({ value: 1, max: 1 });
	});

	it("carries a subtitle through as the move sourceLabel (null when absent)", () => {
		expect(buildArcanumMoveSnapshot({ name: "Resonance", subtitle: "Requires: Battery" }).sourceLabel).toBe("Requires: Battery");
		expect(buildArcanumMoveSnapshot({ name: "Unquenched" }).sourceLabel).toBeNull();
	});
});
