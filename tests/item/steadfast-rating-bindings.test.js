// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { bindAll } from "../../src/utils/bindAll.js";
import { RatingSnapshot } from "../../src/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";
import { fire } from "../fakes/domEvents.js";

/**
 * The steadfast item sheet has no change router: StonetopSteadfastSheet._onRender binds the rating
 * controls by CLASS SELECTOR, against markup the shared tile partial emits. That makes the class a
 * contract between two files, and breaking it fails silently — editing simply stops writing, with no
 * error anywhere.
 *
 * This renders the real partial and wires the real selector the sheet uses, so a rename of one
 * without the other fails here instead of in someone's game.
 */
const SELECTOR = ".steading-attr-input[data-attr]";

function steadfastRatings() {
	const root = document.createElement("div");
	root.innerHTML = [
		["fortunes",   SteadingDefaults.fortunes,               1],
		["surplus",    SteadingDefaults.surplus,                2],
		["size",       SteadingDefaults.attributes.size,        "town"],
		["population", SteadingDefaults.attributes.population,  0],
		["prosperity", SteadingDefaults.attributes.prosperity, -1],
		["defenses",   SteadingDefaults.attributes.defenses,    3],
	].map(([attr, def, current]) => renderPartial("stonetop.steading-stat-panel", {
		attr, attrData: new RatingSnapshot(def, { current }), editable: true,
	})).join("");

	// Exactly what StonetopSteadfastSheet._onRender does with these.
	const setValue = vi.fn();
	bindAll(root, SELECTOR, "change", async ev => {
		const { attr } = ev.currentTarget.dataset;
		const raw = ev.currentTarget.value;
		setValue(attr, attr === "size" ? raw : parseInt(raw));
	});
	return { root, setValue };
}

describe("the steadfast sheet's rating bindings", () => {
	it("finds every rating the sheet renders", () => {
		const { root } = steadfastRatings();
		const bound = [...root.querySelectorAll(SELECTOR)].map(el => el.dataset.attr);
		expect(bound).toEqual(["fortunes", "surplus", "size", "population", "prosperity", "defenses"]);
	});

	it("writes a ±N rating through as a number", () => {
		const { root, setValue } = steadfastRatings();
		const input = root.querySelector(`${SELECTOR}[data-attr='defenses']`);
		input.value = "2";
		fire(input, "change");
		expect(setValue).toHaveBeenCalledWith("defenses", 2);
	});

	it("writes size through as its tier string", () => {
		const { root, setValue } = steadfastRatings();
		const select = root.querySelector(`${SELECTOR}[data-attr='size']`);
		select.value = "city";
		fire(select, "change");
		expect(setValue).toHaveBeenCalledWith("size", "city");
	});

	// Fortunes and Surplus used to be hand-rolled steppers bound by `name`; they now come through the
	// same partial, so the one selector has to reach them too.
	it("reaches Fortunes and Surplus, which used to be bound separately", () => {
		const { root, setValue } = steadfastRatings();
		const fortunes = root.querySelector(`${SELECTOR}[data-attr='fortunes']`);
		fortunes.value = "3";
		fire(fortunes, "change");
		expect(setValue).toHaveBeenCalledWith("fortunes", 3);
	});
});
