import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { band } from "../../scripts/development/redesign-mock/band.js";
import { CharacterSnapshot } from "../../scripts/development/redesign-mock/CharacterSnapshot.js";

/**
 * The ailments region shows its first three rows, always, and what is past them is a count on its bar
 * — never a row of its own, which pushed an ailment out for every one it counted.
 */

const S = new CharacterSnapshot(JSON.parse(readFileSync("scripts/development/mockup/maelen.json", "utf8")));
const html = band(S);
const region = html.slice(html.indexOf('rd-panel rd-ailments"'), html.indexOf("</section>", html.indexOf('rd-panel rd-ailments"')));
const ailmentsBar = region.slice(0, region.indexOf("</header>"));
const ailmentsBody = region.slice(region.indexOf("</header>"));

describe("the ailments bar", () => {
	it("carries the count of the rest and the + on the bar, both as the bar's hanging tabs", () => {
		expect(ailmentsBar).toContain('class="rd-bar-action rd-ailments-more" hidden');
		expect(ailmentsBar).toContain('class="rd-bar-action rd-ailments-edit" aria-label="Edit ailments"');
	});

	it("has no count of its own beside rows a reader can count", () => {
		expect(ailmentsBar).not.toContain("rd-count");
	});

	it("spends no row of the list on what is past it", () => {
		expect(ailmentsBody).toContain("rd-ailment-list");
		expect(ailmentsBody).not.toContain("rd-ailments-more");
	});
});
