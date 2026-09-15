import { describe, it, expect } from "vitest";
import { OutfitEffect, OutfitEffects } from "../../../../src/model/data/character/OutfitEffect.js";
import { OutfitItem } from "../../../../src/model/data/character/OutfitItem.js";

// What a taken move does to a piece of gear. The Armored move is the whole of it in the book: a
// shield marks one ◇ instead of two, and *cumbersome* stops applying to the armor you wear.

const shield = () => OutfitItem.fromDocument({
	name: "Shield", system: { slug: "shield", weight: 2, note: "+1 armor", armor: { modifier: 1 } },
});

const hauberk = () => OutfitItem.fromDocument({
	name: "Hauberk/cuirass/scale",
	system: { slug: "hauberk-cuirass-scale-iron-or-bronze", weight: 2, tagList: ["warm", "cumbersome"] },
});

const ARMORED = [
	{ slug: "shield", weight: 1 },
	{ slug: "hauberk-cuirass-scale-iron-or-bronze", removeTags: ["cumbersome"] },
];

describe("OutfitEffect", () => {
	it("reads an authored entry", () => {
		const effect = OutfitEffect.fromData({ slug: "shield", weight: 1 });
		expect(effect.slug).toBe("shield");
		expect(effect.weight).toBe(1);
		expect(effect.removeTags).toEqual([]);
	});

	// An entry naming no gear has nothing to apply to, which is the only way one can be meaningless.
	it("is nothing when the entry names no gear", () => {
		expect(OutfitEffect.fromData({ weight: 1 })).toBeNull();
		expect(OutfitEffect.fromData(null)).toBeNull();
	});

	it("re-weights the gear it names", () => {
		expect(OutfitEffect.fromData({ slug: "shield", weight: 1 }).applyTo(shield()).weight).toBe(1);
	});

	it("leaves other gear as it found it", () => {
		const rope = OutfitItem.fromDocument({ name: "Rope", system: { slug: "rope", weight: 1 } });
		const effect = OutfitEffect.fromData({ slug: "shield", weight: 1 });
		expect(effect.applyTo(rope)).toBe(rope);
		expect(effect.appliesTo(rope)).toBe(false);
	});

	it("takes a tag off the gear it names", () => {
		const effect = OutfitEffect.fromData({ slug: "hauberk-cuirass-scale-iron-or-bronze", removeTags: ["cumbersome"] });
		expect(effect.applyTo(hauberk()).tags.values).toEqual(["warm"]);
	});

	it("re-weights and un-tags in one pass", () => {
		const effect = OutfitEffect.fromData({ slug: "hauberk-cuirass-scale-iron-or-bronze", weight: 1, removeTags: ["cumbersome"] });
		const applied = effect.applyTo(hauberk());
		expect(applied.weight).toBe(1);
		expect(applied.tags.values).toEqual(["warm"]);
	});

	it("keeps the weight the gear is printed with when it only speaks of tags", () => {
		const effect = OutfitEffect.fromData({ slug: "hauberk-cuirass-scale-iron-or-bronze", removeTags: ["cumbersome"] });
		expect(effect.applyTo(hauberk()).weight).toBe(2);
	});
});

describe("OutfitEffects", () => {
	it("applies every effect a character's moves declare", () => {
		const effects = OutfitEffects.from(ARMORED);
		expect(effects.apply(shield()).weight).toBe(1);
		expect(effects.apply(hauberk()).tags.values).toEqual(["warm"]);
	});

	it("skips entries that name no gear", () => {
		expect(OutfitEffects.from([{ weight: 1 }, { slug: "shield", weight: 1 }]).effects).toHaveLength(1);
	});

	it("is empty when no move says anything", () => {
		expect(OutfitEffects.none().isEmpty).toBe(true);
		expect(OutfitEffects.from().isEmpty).toBe(true);
	});

	it("hands back the very catalog it was given when there is nothing to apply", () => {
		const catalog = new Map([["shield", shield()]]);
		expect(OutfitEffects.none().applyToCatalog(catalog)).toBe(catalog);
	});

	// The repository's map is shared by every actor reading it, so an effect must never write into it.
	it("builds a fresh catalog rather than changing the repository's", () => {
		const catalog = new Map([["shield", shield()], ["hauberk-cuirass-scale-iron-or-bronze", hauberk()]]);
		const mine = OutfitEffects.from(ARMORED).applyToCatalog(catalog);
		expect(mine.get("shield").weight).toBe(1);
		expect(catalog.get("shield").weight).toBe(2);
		expect(mine).not.toBe(catalog);
	});

	it("applies across a list of gear", () => {
		const [s, h] = OutfitEffects.from(ARMORED).applyAll([shield(), hauberk()]);
		expect(s.weight).toBe(1);
		expect(h.tags.values).toEqual(["warm"]);
	});
});
