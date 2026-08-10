import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The coinage block shipped with layout classes that had no CSS rule anywhere — so the captions and
// inputs fell back to inline flow and wrapped wherever the column happened to end, scrambling which
// label sat above which field, differently at every sheet width. Nothing throws and no test fails;
// it just looks broken. This sweep is the thing that notices.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const partial = read("templates/actor/partials/steading-assets.hbs");
const css = read("styles/stonetop.css");

// Layout classes only (the `steading-coinage…` family). The `stonetop-coinage-*` classes on the
// inputs are event-binding hooks, not layout, and carry no styling obligation.
const layoutClasses = [...new Set(
	[...partial.matchAll(/class="([^"]+)"/g)]
		.flatMap(m => m[1].split(/\s+/))
		.filter(c => c.startsWith("steading-coinage"))
)];

describe("steading coinage layout", () => {
	it("finds the coinage layout classes in the partial", () => {
		expect(layoutClasses).toContain("steading-coinage");
		expect(layoutClasses.length).toBeGreaterThan(3);
	});

	it.each(layoutClasses)(".%s has a styling rule", cls => {
		expect(css).toContain(`.${cls}`);
	});

	// Each currency's three fields are grid columns, not inline flow — that is what makes the block
	// render identically at every width.
	it("lays the three fields out as equal grid columns", () => {
		const block = css.slice(css.indexOf(".steading-coinage-fields {"));
		const body = block.slice(0, block.indexOf("}"));
		expect(body).toContain("display: grid");
		expect(body).toContain("repeat(3, 1fr)");
	});

	// activateSteppers replaces each input with an inline-flex wrapper at runtime, which sizes to the
	// input's intrinsic width and leaves the grid column half empty unless the wrapper opts in.
	it("makes the stepper wrapper fill the coinage column", () => {
		expect(css).toContain(".stonetop-stepper:has(> .stonetop-coinage-input)");
	});
});
