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

	// A caption and the input it names are ONE flex row, so they can never wrap apart — which is the
	// failure this file was written for, and the reason the block is not simply inline flow.
	it("keeps each caption on one line with the input it names", () => {
		const block = css.slice(css.indexOf(".steading-coinage-field {"));
		const body = block.slice(0, block.indexOf("}"));
		expect(body).toContain("display: flex");
		expect(body).not.toContain("flex-direction: column");
	});

	// The coinage steppers are the sheet's steppers. They used to be core's stacked ▲▼ under the
	// field while a rating three rows above had flanking carets — two idioms for one control.
	it("uses the sheet's own stepper, not a coinage-only override", () => {
		expect(css).not.toContain(".stonetop-stepper:has(> .stonetop-coinage-input)");
		const stepper = css.slice(css.indexOf(".stonetop.sheet.steading .stonetop-stepper {"));
		expect(stepper.slice(0, stepper.indexOf("}"))).toContain("inline-flex");
	});
});
