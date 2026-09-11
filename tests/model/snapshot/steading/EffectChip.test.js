import { describe, it, expect } from "vitest";
import { EffectChip } from "../../../../src/model/snapshot/steading/EffectChip.js";
import { SteadingImprovement } from "../../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

// One requirement row, so a chip's `earned` can be flipped by one tick.
const improvement = effects => new SteadingImprovement("mill", "Mill", {
	slug: "mill",
	list: [{ type: "entry", slug: "site", content: { text: "a site" }, track: { max: 1 } }],
}, 0, { requires: "site", effects });

const chipsOf = (effects, values = { site: 1 }) =>
	EffectChip.forImprovement(improvement(effects), values);

describe("EffectChip — what an improvement is for", () => {
	// What it EARNS needs no "when": the timing is the completion itself.
	it("states a completion delta with no timing", () => {
		const [chip] = chipsOf([{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 },
			text: "increase Fortunes by 1" }]);
		expect(chip.timingKeys).toEqual([]);
		expect(chip.amount).toBe("+1");
		expect(chip.subjectKey).toBe("stonetop.steading.attr.fortunes");
	});

	// A minus sign, not a hyphen.
	it("states a cost as a negative", () => {
		const [chip] = chipsOf([{ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
			text: "the watch consumes 1 Surplus" }]);
		expect(chip.amount).toBe("−1");
	});

	it("states a rolled amount as its formula", () => {
		const [chip] = chipsOf([{ when: { kind: "moment", moment: "autumn-harvest" },
			change: { target: "surplus", formula: "1d4" }, text: "gain 1d4 Surplus" }]);
		expect(chip.amount).toBe("1d4");
		expect(chip.timingKeys).toEqual(["stonetop.steading.seasons.moments.autumn-harvest"]);
	});

	// The bug: Township's spring chip read "@population + 1 Surplus". See formulaLabel.
	it("names the rating a formula refers to instead of printing the reference", () => {
		const [chip] = chipsOf([{ when: { kind: "turn", seasons: ["spring"] },
			change: { target: "surplus", formula: "@population + 1" },
			text: "the town generates Surplus equal to Population+1" }]);
		expect(chip.amount).toBe("stonetop.steading.attr.population+1");
	});

	// Subject then value, the list-entry shape: a set says "this rating becomes this", and "+0" in the
	// delta position would read as a delta.
	it("states a set as the rating and the value it takes", () => {
		const [chip] = chipsOf([{ when: { kind: "completed" }, set: { target: "population", value: 0 },
			text: "change Population to +0" }]);
		expect(chip.subjectKey).toBe("stonetop.steading.attr.population");
		expect(chip.text).toBe("+0");
		expect(chip.amount).toBe("");
	});

	// The tier's own WORD, not the slug the steading stores for it.
	it("states a set of Size by its tier word", () => {
		const [chip] = chipsOf([{ when: { kind: "completed" }, set: { target: "size", value: "town" },
			text: "change Size to town" }]);
		expect(chip.subjectKey).toBe("stonetop.steading.attr.size");
		expect(chip.text).toBe("stonetop.steading.tier.size.town");
	});

	it("names the seasons a turn result fires in", () => {
		const [chip] = chipsOf([{ when: { kind: "turn", seasons: ["autumn"] },
			change: { target: "surplus", amount: 1 }, text: "+1 Surplus" }]);
		expect(chip.timingKeys).toEqual(["stonetop.steading.seasons.names.autumn"]);
	});

	// Shorter than four season names, and what the book itself says.
	it("says every season rather than naming four", () => {
		const [chip] = chipsOf([{ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
			text: "consumes 1 Surplus" }]);
		expect(chip.timingKeys).toEqual(["stonetop.steading.seasons.everySeason"]);
	});

	it("states a list entry by its list and its own words", () => {
		const [chip] = chipsOf([{ when: { kind: "completed" },
			listEntry: { list: "resources", text: "Mill" }, text: 'add "Mill" to the Resources list' }]);
		expect(chip.subjectKey).toBe("stonetop.steading.lists.resources");
		expect(chip.text).toBe("Mill");
		expect(chip.amount).toBe("");
	});

	// Both halves stated: dropping one would silently lose half of what the result does.
	it("gives a result carrying both a delta and an entry two chips", () => {
		const chips = chipsOf([{ when: { kind: "completed" },
			change: { target: "defenses", amount: 1 },
			listEntry: { list: "fortifications", text: "Palisade" },
			text: "increase Defenses by 1 and add it to the list" }]);
		expect(chips.map(c => c.subjectKey)).toEqual([
			"stonetop.steading.attr.defenses", "stonetop.steading.lists.fortifications",
		]);
	});

	// Township changing Size, Roadbuilding letting you build roads: nothing to compress, and
	// compressing it anyway is how the old summary sentence went wrong.
	it("says nothing about a result that is only prose", () => {
		expect(chipsOf([{ when: { kind: "completed" }, text: "change Size to town" }])).toEqual([]);
	});

	/**
	 * Reversed 2026-09-05. A granted move used to get no chip, which made `Heroic Reputation` — an
	 * improvement that grants a move and nothing else — read as the emptiest row on the board while
	 * having the most interesting payload. A move is exactly what a chip is for: a name and a die.
	 *
	 * By SLUG, never by name. Babele rewrites names, and anything resolved on one silently disappears
	 * in a translated world (helper/bugs.md #56), so the template does the lookup.
	 */
	it("carries a granted move as its slug, for the template to resolve", () => {
		const [chip] = chipsOf([{ when: { kind: "completed" }, grantsMove: "heroic-reputation",
			text: "gain the move: heroic reputation" }]);
		expect(chip.moveSlug).toBe("heroic-reputation");
		expect(chip.subjectKey).toBeNull();
		expect(chip.amount).toBe("");
	});

	// One result can both change a rating and confer a move; it gets a chip for each.
	it("gives a result with two payloads a chip for each", () => {
		expect(chipsOf([{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 },
			grantsMove: "heroic-reputation", text: "increase Fortunes by 1 and gain a move" }]))
			.toHaveLength(2);
	});
});

describe("EffectChip — earned or still owed", () => {
	const effects = [{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 },
		text: "increase Fortunes by 1" }];

	it("is earned once the requirement behind it holds", () => {
		expect(chipsOf(effects, { site: 1 })[0].earned).toBe(true);
	});

	// On an unfinished improvement a chip is what it WILL do; the card dims it to say so.
	it("is not earned while the requirement does not", () => {
		expect(chipsOf(effects, {})[0].earned).toBe(false);
	});
});
