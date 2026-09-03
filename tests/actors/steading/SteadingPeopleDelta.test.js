import { describe, it, expect } from "vitest";
import { SteadingPeopleDelta } from "../../../src/actors/steading/SteadingPeopleDelta.js";

const willa = (over = {}) => ({ id: "p1", name: "Willa", occupation: "Baker", traits: "Kind", home: "", ...over });

describe("SteadingPeopleDelta.between", () => {
	it("is empty when the update touched no people", () => {
		const delta = SteadingPeopleDelta.between({ folk: [willa()] }, { system: { attributes: {} } });
		expect(delta.isEmpty).toBe(true);
	});

	it("names a person whose name changed", () => {
		const delta = SteadingPeopleDelta.between(
			{ folk: [willa()] },
			{ system: { folk: [willa({ name: "Willa Fletcher" })]  } },
		);
		expect(delta.people).toEqual(["p1"]);
	});

	it("names occupation, traits and home edits too", () => {
		const before = { folk: [willa({ home: "Marshedge" })] };
		expect(SteadingPeopleDelta.between(before, { system: { folk: [willa({ home: "Gordin's Delve" })] } }).people).toEqual(["p1"]);
		expect(SteadingPeopleDelta.between(before, { system: { folk: [willa({ home: "Marshedge", traits: "Sly" })] } }).people).toEqual(["p1"]);
	});

	it("names a newly added person", () => {
		const delta = SteadingPeopleDelta.between({ folk: [] }, { system: { folk: [willa()] } });
		expect(delta.people).toEqual(["p1"]);
	});

	it("ignores a row whose linkUuid alone changed, so our own write-back cannot re-trigger the sync", () => {
		const delta = SteadingPeopleDelta.between(
			{ folk: [willa()] },
			{ system: { folk: [willa({ linkUuid: "Actor.npc" })]  } },
		);
		expect(delta.isEmpty).toBe(true);
	});

	it("ignores untouched rows in a rewritten list", () => {
		const other = { id: "p2", name: "Marek" };
		const delta = SteadingPeopleDelta.between(
			{ folk: [willa(), other] },
			{ system: { folk: [willa({ name: "Willa Fletcher" }), other]  } },
		);
		expect(delta.people).toEqual(["p1"]);
	});

	// Residents and neighbours are one roster now, so someone moving house is an ordinary row edit
	// rather than a hop between two lists — and the delta names them once either way.
	it("names someone who moved to a neighbouring place", () => {
		const delta = SteadingPeopleDelta.between(
			{ folk: [willa()] },
			{ system: { folk: [willa({ home: "Marshedge" })] } },
		);
		expect(delta.people).toEqual(["p1"]);
	});
});

describe("SteadingPeopleDelta raw form", () => {
	it("round-trips through the update options it travels in", () => {
		const delta = new SteadingPeopleDelta(["p1", "n1"]);
		const back  = SteadingPeopleDelta.fromRaw(JSON.parse(JSON.stringify(delta.toRaw())));
		expect(back.people).toEqual(["p1", "n1"]);
	});

	it("tolerates a missing raw", () => {
		expect(SteadingPeopleDelta.fromRaw(undefined).isEmpty).toBe(true);
	});
});

describe("SteadingPeopleDelta.between — update shapes", () => {
	it("reads a flattened diff as well as an expanded one", () => {
		const before  = { folk: [{ id: "p1", name: "Willa" }] };
		const flat    = { "system.folk": [{ id: "p1", name: "Willa Fletcher" }] };
		expect(SteadingPeopleDelta.between(before, flat).people).toEqual(["p1"]);
	});
});
