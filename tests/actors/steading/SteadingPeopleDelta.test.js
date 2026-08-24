import { describe, it, expect } from "vitest";
import { SteadingPeopleDelta } from "../../../src/actors/steading/SteadingPeopleDelta.js";

const willa = (over = {}) => ({ id: "p1", name: "Willa", occupation: "Baker", traits: "Kind", ...over });

describe("SteadingPeopleDelta.between", () => {
	it("is empty when the update touched no people", () => {
		const delta = SteadingPeopleDelta.between({ residentPeople: [willa()] }, { system: { attributes: {} } });
		expect(delta.isEmpty).toBe(true);
	});

	it("names a person whose name changed", () => {
		const delta = SteadingPeopleDelta.between(
			{ residentPeople: [willa()] },
			{ system: { residentPeople: [willa({ name: "Willa Fletcher" })]  } },
		);
		expect(delta.residents).toEqual(["p1"]);
	});

	it("names occupation, traits and home edits too", () => {
		const before = { neighborPeople: [willa({ home: "Marshedge" })] };
		expect(SteadingPeopleDelta.between(before, { system: { neighborPeople: [willa({ home: "Gordin's Delve" })] } }).neighbors).toEqual(["p1"]);
		expect(SteadingPeopleDelta.between(before, { system: { neighborPeople: [willa({ home: "Marshedge", traits: "Sly" })] } }).neighbors).toEqual(["p1"]);
	});

	it("names a newly added person", () => {
		const delta = SteadingPeopleDelta.between({ residentPeople: [] }, { system: { residentPeople: [willa()] } });
		expect(delta.residents).toEqual(["p1"]);
	});

	it("ignores a row whose linkUuid alone changed, so our own write-back cannot re-trigger the sync", () => {
		const delta = SteadingPeopleDelta.between(
			{ residentPeople: [willa()] },
			{ system: { residentPeople: [willa({ linkUuid: "Actor.npc" })]  } },
		);
		expect(delta.isEmpty).toBe(true);
	});

	it("ignores untouched rows in a rewritten list", () => {
		const other = { id: "p2", name: "Marek" };
		const delta = SteadingPeopleDelta.between(
			{ residentPeople: [willa(), other] },
			{ system: { residentPeople: [willa({ name: "Willa Fletcher" }), other]  } },
		);
		expect(delta.residents).toEqual(["p1"]);
	});

	it("keeps residents and neighbours apart", () => {
		const delta = SteadingPeopleDelta.between(
			{ residentPeople: [willa()], neighborPeople: [] },
			{ system: { neighborPeople: [{ id: "n1", name: "Brennan" }]  } },
		);
		expect(delta.residents).toEqual([]);
		expect(delta.neighbors).toEqual(["n1"]);
	});
});

describe("SteadingPeopleDelta raw form", () => {
	it("round-trips through the update options it travels in", () => {
		const delta = new SteadingPeopleDelta(["p1"], ["n1"]);
		const back  = SteadingPeopleDelta.fromRaw(JSON.parse(JSON.stringify(delta.toRaw())));
		expect(back.residents).toEqual(["p1"]);
		expect(back.neighbors).toEqual(["n1"]);
	});

	it("tolerates a missing raw", () => {
		expect(SteadingPeopleDelta.fromRaw(undefined).isEmpty).toBe(true);
	});
});

describe("SteadingPeopleDelta.between — update shapes", () => {
	it("reads a flattened diff as well as an expanded one", () => {
		const before  = { residentPeople: [{ id: "p1", name: "Willa" }] };
		const flat    = { "system.residentPeople": [{ id: "p1", name: "Willa Fletcher" }] };
		expect(SteadingPeopleDelta.between(before, flat).residents).toEqual(["p1"]);
	});
});
