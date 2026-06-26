import { describe, it, expect } from "vitest";
import { SteadingLedger } from "../../../module/actors/steading/SteadingLedger.js";
import { ledgerNoun } from "../../../module/actors/character/CharacterLedger.js";

function steadingUpdate(steading) {
	return { flags: { stonetop: { steading } } };
}

function makeActor(flags = {}) {
	return {
		type: "stonetop",
		flags,
	};
}

describe("SteadingLedger", () => {
	it("records silver and gold denomination changes distinctly", () => {
		const actor = makeActor({
			stonetop: {
				steading: {
					silver: { purses: 1, handfuls: 2, coins: 3 },
					gold: { purses: 0, handfuls: 1, coins: 2 },
				},
			},
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, {
			flags: {
				stonetop: {
					steading: {
						silver: { purses: 2, handfuls: 2, coins: 4 },
						gold: { purses: 1, handfuls: 1, coins: 3 },
					},
				},
			},
		});

		expect(entries.map(e => e.action)).toEqual([
			"Silver purses changed from 1 to 2",
			"Silver coins changed from 3 to 4",
			"Gold purses changed from 0 to 1",
			"Gold coins changed from 2 to 3",
		]);
	});

	it("records fortification list changes without object formatting", () => {
		const actor = makeActor({
			stonetop: {
				steading: {
					fortifications: [
						{ name: "Village militia", checked: true },
						{ name: "The Ringwall", checked: false },
						{ name: "Some bows", checked: true },
						{ name: "", checked: false },
					],
				},
			},
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, {
			flags: {
				stonetop: {
					steading: {
						fortifications: [
							{ name: "Village militia", checked: true },
							{ name: "The Ringwall", checked: true },
							{ name: "Many bows", checked: false },
							{ name: "Palisade", checked: true },
						],
					},
				},
			},
		});

		expect(entries.map(e => e.action)).toEqual([
			"The Ringwall selected",
			"Fortification renamed from Some bows to Many bows",
			"Many bows deselected",
			"Fortification added: Palisade",
			"Palisade selected",
		]);
		expect(entries.map(e => e.action).join(" ")).not.toContain("[object Object]");
	});

	it("records place changes by map letter", () => {
		const actor = makeActor({
			stonetop: {
				steading: {
					places: [
						{ letter: "A", name: "The Stone" },
						{ letter: "B", name: "" },
						{ letter: "C", name: "Cistern" },
					],
				},
			},
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, {
			flags: {
				stonetop: {
					steading: {
						places: [
							{ letter: "A", name: "The Old Stone" },
							{ letter: "B", name: "Smithy" },
							{ letter: "C", name: "" },
						],
					},
				},
			},
		});

		expect(entries.map(e => e.action)).toEqual([
			"Place A changed from The Stone to The Old Stone",
			"Place B set to Smithy",
			"Place C cleared (Cistern)",
		]);
	});

	it("records neighbor changes with home and trait text", () => {
		const actor = makeActor({
			stonetop: {
				steading: {
					neighbors: [
						{ name: "Ennis", home: "Marshedge", traits: "generous", checked: true },
						{ name: "Shahar", home: "Gordin's Delve", traits: "", checked: false },
					],
				},
			},
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, {
			flags: {
				stonetop: {
					steading: {
						neighbors: [
							{ name: "Ennis", home: "Marshedge", traits: "wary", checked: true },
							{ name: "Shahar", home: "Gordin's Delve", traits: "ambitious", checked: true },
							{ name: "Tovia", home: "Lygos", traits: "", checked: true },
						],
					},
				},
			},
		});

		expect(entries.map(e => e.action)).toEqual([
			"Ennis (from Marshedge) trait changed from generous to wary",
			"Shahar (from Gordin's Delve) trait set to ambitious",
			"Shahar (from Gordin's Delve) selected",
			"Neighbor added: Tovia (from Lygos)",
			"Tovia (from Lygos) selected",
		]);
		expect(entries.map(e => e.action).join(" ")).not.toContain("[object Object]");
	});

	it("records when a built-in improvement is completed", () => {
		const actor = makeActor({
			stonetop: { steading: { improvements: { palisade: { completed: false, r: [true, true, true, true] } } } },
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, steadingUpdate({
			improvements: { palisade: { completed: true, r: [true, true, true, true] } },
		}));

		expect(entries.map(e => e.action)).toEqual(["Improvement completed: Palisade"]);
		expect(entries.map(e => ledgerNoun(e.action))).toEqual(["Improvement"]);
	});

	it("records a requirement step toggle by its plain-text label", () => {
		const actor = makeActor({
			stonetop: { steading: { improvements: { mill: { completed: false, r: [false, false, false, false, false, false] } } } },
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, steadingUpdate({
			improvements: { mill: { completed: false, r: [false, false, false, false, false, true] } },
		}));

		expect(entries.map(e => e.action)).toEqual(["Improvement step marked: Mill — A full-time miller"]);
		expect(entries.map(e => ledgerNoun(e.action))).toEqual(["Improvement step"]);
	});

	it("strips HTML from requirement step labels", () => {
		const actor = makeActor({
			stonetop: { steading: { improvements: { palisade: { completed: false, r: [false, false, false, false] } } } },
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, steadingUpdate({
			improvements: { palisade: { completed: false, r: [false, false, false, true] } },
		}));

		expect(entries.map(e => e.action)).toEqual([
			"Improvement step marked: Palisade — Pulling Together, costing a month and 1 Surplus",
		]);
	});

	it("names custom (journal-sourced) improvements from the actor's tracked list", () => {
		const actor = makeActor({
			stonetop: {
				steading: {
					customImprovements: [
						{ slug: "custom-foo", label: "Foo Bar", sections: [{ heading: "", items: ["Do the thing"] }], effect: "" },
					],
					improvements: { "custom-foo": { completed: false, r: [false] } },
				},
			},
		});

		const entries = SteadingLedger.entriesForActorUpdate(actor, steadingUpdate({
			customImprovements: [
				{ slug: "custom-foo", label: "Foo Bar", sections: [{ heading: "", items: ["Do the thing"] }], effect: "" },
			],
			improvements: { "custom-foo": { completed: true, r: [true] } },
		}));

		expect(entries.map(e => e.action)).toEqual([
			"Improvement completed: Foo Bar",
			"Improvement step marked: Foo Bar — Do the thing",
		]);
	});

	it("emits nothing when the improvements map is unchanged", () => {
		const imps = { palisade: { completed: true, r: [true, true, true, true] } };
		const actor = makeActor({ stonetop: { steading: { improvements: imps } } });

		const entries = SteadingLedger.entriesForActorUpdate(actor, steadingUpdate({ improvements: imps }));

		expect(entries).toEqual([]);
	});
});
