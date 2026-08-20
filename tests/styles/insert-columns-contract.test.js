import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// An insert tab is two CSS columns of choice groups. Whether a group may be split across them is
// decided entirely by these rules, and getting it wrong is invisible until someone opens the tab:
// too atomic and a lone group runs down one column with the other empty (what the Lightbearer's
// invocations did); too loose and every multi-group insert reflows mid-group. Nothing else in the
// suite renders a real two-column layout, so these pin the selectors.

const root = process.cwd();
const css  = readFileSync(path.join(root, "styles/stonetop.css"), "utf8");

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

// Which inserts actually depend on which side of the rule.
function insertGroupCounts() {
	const dir = "packs/src/inserts";
	return readdirSync(path.join(root, dir)).map(file => {
		const system = JSON.parse(readFileSync(path.join(root, dir, file), "utf8")).system;
		return { file, groups: (system.choices ?? []).length };
	});
}

describe("insert tab column rules", () => {
	it("keeps a group whole when the tab has more than one", () => {
		expect(ruleBlock(".tab.insert .stonetop-playbook-columns .stonetop-choice-entry"))
			.toContain("break-inside: avoid");
	});

	// The `:only-child` scope IS the fix. Without it the exception applies to every insert.
	it("lets the tab's only group flow across both columns", () => {
		const block = ruleBlock(".tab.insert .details-section .stonetop-choice-entry:only-child");
		expect(block).toContain("break-inside: auto");
	});

	it("still holds each row together, so a flowing group breaks between entries", () => {
		expect(ruleBlock(".tab.insert .stonetop-playbook-columns .stonetop-choice-track"))
			.toContain("break-inside: avoid");
	});

	it("keeps a group heading with its rows", () => {
		expect(ruleBlock(".tab.insert .stonetop-choice-entry-title")).toContain("break-after: avoid");
	});

	// The rule only pays off while some insert ships a single group, and only stays safe while
	// others ship several. If that ever stops being true, this test is the reminder to revisit.
	it("matches the inserts that ship", () => {
		const counts = insertGroupCounts();
		expect(counts.some(i => i.groups === 1)).toBe(true);
		expect(counts.some(i => i.groups > 1)).toBe(true);
	});
});
