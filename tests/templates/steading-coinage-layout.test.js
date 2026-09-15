import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The coinage block shipped with layout classes that had no CSS rule anywhere — so the captions and
// inputs fell back to inline flow and wrapped wherever the column happened to end, scrambling which
// label sat above which field, differently at every sheet width. Nothing throws and no test fails;
// it just looks broken. This sweep is the thing that notices.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const partial = read("templates/actor/partials/steading-coinage.hbs");
const assets = read("templates/actor/partials/steading-assets.hbs");
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

	// The original defect, restated for the shape that replaced the flex rows: a caption can no longer
	// wrap away from the fields it names, because it is a column header of the same table. What has to
	// hold is that the table IS one — a header row of <th scope="col"> over rows of cells.
	it("names each denomination once, as a column header over its values", () => {
		expect(partial).toContain("<thead>");
		expect([...partial.matchAll(/scope="col"/g)]).toHaveLength(4);
		for (const key of ["coinage.purses", "coinage.handfuls", "coinage.coins"]) {
			expect([...partial.matchAll(new RegExp(key.replace(".", "\\."), "g")),
			], `${key} is stated more than once`).toHaveLength(1);
		}
	});

	// Both "Purses" fields used to carry the accessible name "Purses" and nothing said whose. The row
	// header answers that for a table reader; the aria-label answers it for everyone else.
	it("names every field by its currency as well as its denomination", () => {
		expect(partial).toContain(`scope="row"`);
		for (const key of ["coinagePurses", "coinageHandfuls", "coinageCoins"]) {
			expect(partial).toContain(`stonetop.a11y.${key}' currency=(localize labelKey)`);
		}
	});

	// The block is titled the way every other block on the tab is, and the advice ? rides that heading
	// rather than the first currency's name row — which is what the deleted `order: 1` rule was for.
	it("has a heading of its own, carrying the advice control", () => {
		expect(partial).toContain(`{{> "stonetop.section-heading" title=(localize "stonetop.steading.lists.coinage") advice=advice}}`);
		expect(css).not.toContain(".steading-coinage-name .stonetop-advice-btn");
		expect(read("templates/actor/partials/section-heading.hbs"))
			.toContain(`{{#if advice}}{{> "stonetop.advice-button" variant="inline" topic=advice}}{{/if}}`);
	});

	// One partial, one block. The coinage used to hang off the foot of the assets file, which is why
	// it had no heading: it was riding on the assets one.
	it("is its own partial — the assets list no longer carries it", () => {
		expect(assets).not.toContain(`class="steading-coinage`);
		expect(assets).not.toContain("coinage=");
		expect(read("src/handlebars/partials.js")).toContain(`"stonetop.steading-coinage"`);
	});

	// The coinage steppers are the sheet's steppers. They used to be core's stacked ▲▼ under the
	// field while a rating three rows above had flanking carets — two idioms for one control.
	it("uses the sheet's own stepper, not a coinage-only override", () => {
		expect(css).not.toContain(".stonetop-stepper:has(> .stonetop-coinage-input)");
		const stepper = css.slice(css.indexOf(".stonetop.sheet.steading .stonetop-stepper {"));
		expect(stepper.slice(0, stepper.indexOf("}"))).toContain("inline-flex");
	});

	// The classes the steadfast sheet binds its change handlers by. They are not layout, so the sweep
	// above deliberately ignores them — which is exactly why they need saying somewhere.
	it("keeps the binding hooks both sheets reach the inputs by", () => {
		for (const cls of ["stonetop-coinage-purses", "stonetop-coinage-handfuls", "stonetop-coinage-coins"]) {
			expect(partial).toContain(cls);
			expect(read("src/item/StonetopSteadfastSheet.js")).toContain(`.${cls}`);
		}
	});
});
