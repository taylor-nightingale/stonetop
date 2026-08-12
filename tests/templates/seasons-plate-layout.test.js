import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The Seasons Change spread prints the gains beside the harvest plate, so the tab is a two-column
// grid. The plate is a copyrighted illustration the art installer provides, absent in most worlds —
// and the art column was reserved whether or not it had anything in it, leaving the gains panel
// squeezed into two thirds of the row with dead space beside it. The collapse below depends on the
// plate being absent from the DOM (not merely empty or hidden), which is a template obligation.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");
const partial = read("templates/actor/partials/steading-seasons.hbs");

const PLATE = "steading-seasons-plate";
const COLLAPSE = `.steading-seasons:not(:has(.${PLATE}))`;

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

describe("seasons plate layout", () => {
	it("reserves an art column only in the two-column default", () => {
		expect(ruleBlock(".stonetop.sheet.steading .steading-seasons")).toContain("minmax(200px, 32%)");
	});

	it("drops that column when the plate is absent", () => {
		const block = ruleBlock(`.stonetop.sheet.steading ${COLLAPSE}`);
		expect(block).toContain("grid-template-columns: minmax(0, 1fr)");
		expect(block).not.toContain("32%");
	});

	// A plate div rendered unconditionally — empty, or with a hidden img inside — still matches the
	// :has(), and the dead column silently comes back.
	it("emits the plate only when the world has the art", () => {
		const plateAt = partial.indexOf(PLATE);
		expect(plateAt).toBeGreaterThan(-1);

		const guard = partial.lastIndexOf("{{#if seasons.plate}}", plateAt);
		expect(guard).toBeGreaterThan(-1);
		expect(partial.slice(guard, plateAt)).not.toContain("{{/if}}");
	});
});
