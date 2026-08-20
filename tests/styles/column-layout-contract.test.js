import { describe, it, expect, } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// The playbook tab and every insert tab are the same two-column layout, and they lay out by what a
// thing IS: a fixed section stays whole, a block of authored groups flows, a row never splits. This
// used to be tab-scoped — five `.tab.insert` exceptions the playbook tab did not have — and the two
// drifted apart one broken screenshot at a time. Nothing here may be qualified by tab again.

const root = process.cwd();
const read = rel => readFileSync(path.join(root, rel), "utf8");
const css  = read("styles/stonetop.css");

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

// The rules govern column breaks, so what matters is which selector carries which break declaration.
const declares = (selector, declaration) => {
	const at = css.indexOf(selector);
	if (at < 0) return false;
	return css.slice(at, css.indexOf("}", at)).includes(declaration);
};

describe("two-column tab layout", () => {
	it("keeps a fixed section whole — heading, rule and value together", () => {
		expect(ruleBlock(".stonetop-playbook-columns .details-section")).toContain("break-inside: avoid");
	});

	// Kept whole, a block that IS the whole tab runs down one column and leaves the other empty.
	it("lets a block of choice groups flow, and the groups inside it", () => {
		expect(declares(".stonetop-playbook-columns .stonetop-choice-section", "break-inside: auto")).toBe(true);
		expect(declares(".stonetop-playbook-columns .stonetop-choice-section .stonetop-choice-entry",
			"break-inside: auto")).toBe(true);
	});

	it("still refuses to split a row, or a heading from its rows", () => {
		expect(declares(".stonetop-playbook-columns .stonetop-choice-track", "break-inside: avoid")).toBe(true);
		expect(declares(".stonetop-playbook-columns .stonetop-item", "break-inside: avoid")).toBe(true);
		expect(ruleBlock(".stonetop-playbook-columns .stonetop-choice-entry-title"))
			.toContain("break-after: avoid");
	});

	// The rules name this class; the block has to carry it, or a group block reads as a fixed section
	// and stops flowing.
	it("is emitted by the block the rules name", () => {
		expect(read("templates/actor/partials/lore-section.hbs"))
			.toContain(`class="details-section stonetop-choice-section"`);
		expect(read("templates/actor/partials/instinct-section.hbs"))
			.toContain(`class="details-section stonetop-instinct-section"`);
	});

	// The anti-drift assertion: layout decided per tab is how the two diverged.
	it("scopes no column rule to a particular tab", () => {
		for (const [line] of css.split("\n").map(l => [l.trim()]))
			if (line.startsWith(".tab.insert") || line.startsWith(".tab.playbook"))
				expect(`${line}: ${/break-(inside|after)/.test(ruleBlock(line) ?? "")}`).toBe(`${line}: false`);
	});

	// Both tabs render the same partials, so a change to one is a change to both.
	it("renders both tabs through the same section partials", () => {
		for (const tab of ["tab-playbook", "tab-insert"]) {
			const source = read(`templates/actor/partials/${tab}.hbs`);
			expect(source).toContain('{{> "stonetop.choice-section"');
			expect(source).toContain('{{> "stonetop.instinct-section"');
			expect(source).toContain(`class="stonetop-playbook-columns"`);
		}
	});

	// The rules only matter while inserts actually ship groups to lay out.
	it("matches the inserts that ship", () => {
		const dir = "packs/src/inserts";
		const counts = readdirSync(path.join(root, dir)).map(file =>
			(JSON.parse(read(`${dir}/${file}`)).system.choices ?? []).length);
		expect(counts.some(n => n === 1)).toBe(true);
		expect(counts.some(n => n > 1)).toBe(true);
	});
});
