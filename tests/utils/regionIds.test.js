import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { sectionBodyId, moveBodyId, movesPanelId } from "../../src/utils/regionIds.js";
import { renderTemplate } from "../fakes/renderTemplate.js";

describe("region ids", () => {
	it("scopes a section's body to the sheet", () => {
		expect(sectionBodyId("sheet-1", "instinct")).toBe("sheet-1-section-instinct");
	});

	it("scopes a move's text to the sheet and the category it is listed under", () => {
		expect(moveBodyId("sheet-1", "insert-thrall", "favor")).toBe("sheet-1-move-insert-thrall-favor");
	});

	// A Moves panel holds its moves twice — the ones taken, at rest, and everything while choosing —
	// and the two rows of one move are two regions.
	it("scopes a move's text in a list being chosen from apart from the same move at rest", () => {
		expect(moveBodyId("sheet-1", "playbook-the-fox", "ambush", true)).toBe("sheet-1-move-playbook-the-fox-ambush-choosing");
		expect(moveBodyId("sheet-1", "playbook-the-fox", "ambush", false)).toBe(moveBodyId("sheet-1", "playbook-the-fox", "ambush"));
	});

	it("scopes a Moves panel's body to the sheet and its category", () => {
		expect(movesPanelId("sheet-1", "other")).toBe("sheet-1-moves-panel-other");
	});

	it("mints the same ids in the templates", () => {
		renderTemplate("systems/stonetop/templates/actor/partials/bar.hbs", {});
		expect(Handlebars.compile('{{sectionId "s1" "instinct"}}|{{moveBodyId "s1" "basic" "defend"}}|{{moveBodyId "s1" "basic" "defend" true}}|{{movesPanelId "s1" "other"}}')({}))
			.toBe(`${sectionBodyId("s1", "instinct")}|${moveBodyId("s1", "basic", "defend")}|${moveBodyId("s1", "basic", "defend", true)}|${movesPanelId("s1", "other")}`);
	});
});
