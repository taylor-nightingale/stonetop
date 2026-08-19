// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { steadingChangeHandlers } from "../../../src/actors/steading/steadingChangeHandlers.js";

function spySteading() {
	return new Proxy({}, { get: (t, p) => t[p] ??= vi.fn(async () => {}) });
}

function el(html) {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
}

let s, handlers;
beforeEach(() => {
	document.body.innerHTML = "";
	s = spySteading();
	handlers = steadingChangeHandlers(s, { availableSteadfasts: () => [{ name: "Barrier Pass" }] });
});

describe("steadingChangeHandlers", () => {
	it("hands the steadfast box its value plus the stashed list to resolve against", () => {
		handlers.steadfastName(el(`<input value="Barrier Pass">`));
		expect(s.renameOrApplySteadfast).toHaveBeenCalledWith("Barrier Pass", [{ name: "Barrier Pass" }]);
	});

	it("parses the numeric boxes", () => {
		handlers.fortunes(el(`<input value="3">`));
		expect(s.setFortunes).toHaveBeenCalledWith(3);

		handlers.surplus(el(`<input value="">`)); // blank surplus is zero, not NaN
		expect(s.setSurplus).toHaveBeenCalledWith(0);
	});

	// Ratings store a number; size stores its tier string.
	it("stores a rating as a number and size as its tier string", () => {
		handlers.attribute(el(`<input data-attr="population" value="4">`));
		expect(s.setAttribute).toHaveBeenCalledWith("population", 4);

		handlers.attribute(el(`<input data-attr="size" value="village">`));
		expect(s.setAttribute).toHaveBeenCalledWith("size", "village");
	});

	it("routes a resident field by its row id", () => {
		handlers.residentName(el(`<input data-id="r1" value="Cerdig">`));
		expect(s.updateResidentName).toHaveBeenCalledWith("r1", "Cerdig");
	});

	it("routes a neighbor field by its row id", () => {
		handlers.neighborHome(el(`<input data-id="n1" value="Marshedge">`));
		expect(s.updateNeighborHome).toHaveBeenCalledWith("n1", "Marshedge");
	});

	it("routes coinage by currency title, treating a blank as zero", () => {
		handlers.coinagePurses(el(`<input data-title="Silver" value="2">`));
		expect(s.updateCoinagePurses).toHaveBeenCalledWith("Silver", 2);

		handlers.coinageCoins(el(`<input data-title="Silver" value="">`));
		expect(s.updateCoinageCoins).toHaveBeenCalledWith("Silver", 0);
	});

	it("routes an indexed row by number, not by the raw dataset string", () => {
		handlers.placeField(el(`<input data-index="2" value="The Mill">`));
		expect(s.setPlaceValue).toHaveBeenCalledWith(2, "The Mill");
	});
});

// The template ↔ handler vocabulary check that used to live here is now in
// tests/actors/templateHandlerContract.test.js: it covers all three actor sheets, and pairs a text
// scan with a real render so it catches names stamped inside loops AND names passed to a partial as
// a parameter. This file keeps the per-handler behaviour tests above.
