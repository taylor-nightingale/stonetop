// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { ReviewRow } from "../../src/model/snapshot/character/LevelUpSnapshot.js";
import { LevelUpProcedure } from "../../src/model/data/character/LevelUpProcedure.js";
import { MoveBullets } from "../../src/model/snapshot/character/MoveBullets.js";

// The level-up review's route lands on the Playbook tab with the instinct and the appearance open,
// since the review asks about both (D11).
const stepOf = raw => LevelUpProcedure.from([raw], MoveBullets.from("- Review your Instinct and Appearance.")).steps[0];

describe("the review step's route", () => {
	it("names the sections it opens where it lands", () => {
		const row = new ReviewRow(stepOf({ kind: "review", tab: "playbook" }));
		const route = renderPartialInto(document.createElement("ol"), "stonetop.level-up-step", row).querySelector(".stonetop-levelup-goto");
		expect([route.dataset.tab, route.dataset.openSections]).toEqual(["playbook", "instinct appearance"]);
	});

	it("names none where it opens nothing", () => {
		const row = new ReviewRow(stepOf({ kind: "review", tab: "notes" }));
		const route = renderPartialInto(document.createElement("ol"), "stonetop.level-up-step", row).querySelector(".stonetop-levelup-goto");
		expect(route.hasAttribute("data-open-sections")).toBe(false);
	});
});
