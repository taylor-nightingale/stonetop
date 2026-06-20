import { describe, it, expect } from "vitest";
import { buildArcanumSnapshot, buildArcanumOutfitItem } from "../../../src/actors/character/arcanumSnapshot.js";
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
		consequences: { slug: "consequences", list: [{ type: "entry", slug: "c1", content: { text: "burned" } }] },
		unlockAt: "after 4 marks",
	},
});

describe("buildArcanumSnapshot", () => {
	it("maps a full arcanum to front/back snapshots", () => {
		const s = buildArcanumSnapshot(richArcanum(), { flipped: true });
		expect(s).toMatchObject({ slug: "azure", major: true, name: "Azure Hand", owned: true, flipped: true });
		expect(s.front.title).toBe("Azure Hand");
		expect(s.front.item.name).toBe("Azure Hand");
		expect(s.front.unlock).toBeTruthy();            // ChoiceGroup
		expect(s.back.resource).toBeTruthy();           // ResourceSnapshot
		expect(s.back.moves).toHaveLength(1);
		expect(s.back.consequences).toBeTruthy();
		expect(s.back.unlockAt).toBe("after 4 marks");
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

	it("buildArcanumOutfitItem returns null for no item; maps fields otherwise", () => {
		expect(buildArcanumOutfitItem("x", null)).toBeNull();
		expect(buildArcanumOutfitItem("x", { name: "Cloak", weight: 1 })).toMatchObject({ slug: "x", name: "Cloak", weight: 1 });
	});
});
