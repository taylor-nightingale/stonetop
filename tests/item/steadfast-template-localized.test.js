// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderTemplate } from "../fakes/renderTemplate.js";

/**
 * Every word the steadfast sheet draws goes through localize. The harness renders a localized
 * string as its key, so a word written into the template in English shows up here as English.
 */
function steadfastSheet() {
	const root = document.createElement("div");
	root.innerHTML = renderTemplate("systems/stonetop/templates/item/steadfast.hbs", {
		editable: true,
		stonetop: { name: "Barrier Pass", improvements: [{ slug: "mill" }] },
	});
	return root;
}

describe("the steadfast sheet's residents and granted improvements", () => {
	const residents = () => steadfastSheet().querySelector(".steading-npc-traits");

	it("names the residents panel and says what it is for in the language of the table", () => {
		const panel = residents();
		expect(panel.querySelector(".stonetop-bar-title").textContent.trim()).toBe("stonetop.steadfast.residents");
		expect(panel.querySelector(".stonetop-bar-note").textContent.trim()).toBe("stonetop.steadfast.residentsHint");
	});

	it("labels the name and trait pools in the language of the table", () => {
		const labels = [...residents().querySelectorAll(".stonetop-insert-sheet-label")].map(l => l.textContent.trim());
		expect(labels).toEqual(["stonetop.steading.neighbors.names", "stonetop.steading.headings.npcTraits"]);
	});

	it("names a granted improvement's remove control in the language of the table", () => {
		const remove = steadfastSheet().querySelector(".steadfast-improvement-remove");
		expect(remove.getAttribute("aria-label")).toBe("stonetop.steadfast.improvementRemove");
	});
});
