import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { renderTemplate } from "../fakes/renderTemplate.js";

describe("the add helper", () => {
	it("adds two numbers, a missing one counting as zero", () => {
		renderTemplate("systems/stonetop/templates/actor/partials/bar.hbs", {});
		expect(Handlebars.compile("{{add 4 2}}|{{add 4 missing}}")({})).toBe("6|4");
	});
});
