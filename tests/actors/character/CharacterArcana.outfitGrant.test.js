import { describe, it, expect } from "vitest";
import { CharacterArcana } from "../../../src/actors/character/CharacterArcana.js";

// An arcanum grants through the same container-scoped path as every other container: base gear (its
// flip-dependent card item) plus whatever its ticked choices grant, all under one `arcana:<slug>`
// source. Before this, arcana had their own bespoke sync and choice-row gear was unreachable.

const cardItem = (name) => ({ name, weight: 1, inventoryColumn: "regular", note: null });

function arcanumItem({ flipped = false, choiceValues = {}, back = {} } = {}) {
	return {
		_id: "arc1", type: "arcanum", name: "Bow with no string",
		system: {
			slug: "bow-with-no-string",
			flipped,
			choiceValues,
			front: { item: cardItem("Bow (unstrung)") },
			back:  { item: cardItem("Bow of the hunt"), ...back },
		},
	};
}

describe("CharacterArcana.outfitGrantFor", () => {
	it("grants the front card item when the card is face up", () => {
		const grant = CharacterArcana.outfitGrantFor(arcanumItem({ flipped: false }));
		expect(grant.source).toBe("arcana:bow-with-no-string");
		expect(grant.items.map(i => i.name)).toEqual(["Bow (unstrung)"]);
	});

	it("grants the back card item once flipped", () => {
		const grant = CharacterArcana.outfitGrantFor(arcanumItem({ flipped: true }));
		expect(grant.items.map(i => i.name)).toEqual(["Bow of the hunt"]);
	});

	it("grants nothing when the current side has no inventory column", () => {
		const item = arcanumItem({ flipped: false });
		item.system.front.item = { name: "Not gear" };   // no inventoryColumn
		expect(CharacterArcana.outfitGrantFor(item).items).toEqual([]);
	});

	it("also grants gear hung off a ticked choice row — the case that never worked before", () => {
		const item = arcanumItem({
			flipped: true,
			choiceValues: { "bow-back": { quiver: 1 } },
			back: {
				choices: {
					slug: "bow-back",
					list: [{ type: "entry", slug: "quiver", track: { max: 1 }, outfitItems: [
						{ slug: "quiver", name: "Quiver", weight: 1, inventoryColumn: "small" },
					]}],
				},
			},
		});

		expect(CharacterArcana.outfitGrantFor(item).items.map(i => i.name).sort())
			.toEqual(["Bow of the hunt", "Quiver"]);
	});

	it("carries the arcanum's source on the grant, not on each item — the store stamps those", () => {
		const grant = CharacterArcana.outfitGrantFor(arcanumItem({ flipped: true }));
		expect(grant.source).toBe("arcana:bow-with-no-string");
		expect(grant.items.every(i => i.system.source === undefined)).toBe(true);
	});
});

describe("CharacterArcana.outfitGrantFor — a back that says it is the same object", () => {
	// `itemSameAsFront` is how a major back says the thing in your hands has not changed (the
	// Blood-quenched Sword is a sword on both sides). Reading the raw `back.item` — which those cards
	// leave null — took the gear out of the outfit on every flip.
	const sameAsFront = ({ flipped }) => ({
		_id: "arc2", type: "arcanum", name: "Blood-quenched Sword",
		system: { slug: "blood-quenched-sword", flipped, choiceValues: {},
			front: { item: cardItem("Blood-quenched Sword") },
			back:  { item: null, itemSameAsFront: true } },
	});

	it("keeps the front's gear when the card is flipped", () => {
		expect(CharacterArcana.outfitGrantFor(sameAsFront({ flipped: true })).items.map(i => i.name))
			.toEqual(["Blood-quenched Sword"]);
	});

	it("drops the gear when the back resolves to no item — the card's object is gone", () => {
		// The Mindgem is installed into the Mighty Servant's helm: once the mysteries are unlocked it is
		// not something the character carries any more.
		const consumed = {
			_id: "arc3", type: "arcanum", name: "Mindgem",
			system: { slug: "mindgem", flipped: true, choiceValues: {},
				front: { item: cardItem("Mindgem") },
				back:  { item: null, itemSameAsFront: false } },
		};
		expect(CharacterArcana.outfitGrantFor(consumed).items).toEqual([]);
		consumed.system.flipped = false;
		expect(CharacterArcana.outfitGrantFor(consumed).items.map(i => i.name)).toEqual(["Mindgem"]);
	});
});
