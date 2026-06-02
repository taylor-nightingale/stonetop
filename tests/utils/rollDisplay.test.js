import { describe, it, expect } from "vitest";
import { buildRollContent } from "../../src/utils/rollDisplay.js";

// -- Helpers -------------------------------------------------------------------

function fakeRoll({ groups, total }) {
	return {
		dice: groups.map(group => ({
			results: group.map(({ value, active = true }) => ({ result: value, active })),
		})),
		total,
	};
}

const NORMAL = fakeRoll({ groups: [[{ value: 3 }, { value: 5 }]], total: 8 });
const ADV    = fakeRoll({ groups: [[{ value: 3 }, { value: 5 }], [{ value: 2, active: false }, { value: 4, active: false }]], total: 8 });
const DIS    = fakeRoll({ groups: [[{ value: 3, active: false }, { value: 5, active: false }], [{ value: 2 }, { value: 4 }]], total: 6 });

// -- buildRollContent ----------------------------------------------------------

describe("buildRollContent — dice display", () => {
	it("shows both dice values for a normal 2d6 roll", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain(">3<");
		expect(html).toContain(">5<");
	});

	it("shows all four dice for an advantage roll", () => {
		const html = buildRollContent(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain(">3<");
		expect(html).toContain(">5<");
		expect(html).toContain(">2<");
		expect(html).toContain(">4<");
	});

	it("marks dropped dice with --dropped class", () => {
		const html = buildRollContent(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		const dropped = html.match(/stonetop-die--dropped/g)?.length ?? 0;
		expect(dropped).toBe(2);
	});

	it("shows kept group before dropped group", () => {
		const html = buildRollContent(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		const firstDie  = html.indexOf(">3<");
		const droppedDie = html.indexOf("stonetop-die--dropped");
		expect(firstDie).toBeLessThan(droppedDie);
	});

	it("shows a separator between kept and dropped groups", () => {
		const html = buildRollContent(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("stonetop-dice-separator");
	});

	it("does not show separator for a normal roll", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("stonetop-dice-separator");
	});
});

describe("buildRollContent — ADV/DIS badge", () => {
	it("shows ADV badge for advantage roll", () => {
		const html = buildRollContent(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("stonetop-roll-mode--adv");
	});

	it("shows DIS badge for disadvantage roll", () => {
		const html = buildRollContent(DIS, { name: "Test", rollMode: "dis", resultKey: "failure", resultLabel: "Miss" });
		expect(html).toContain("stonetop-roll-mode--dis");
	});

	it("shows no badge for a normal roll", () => {
		const html = buildRollContent(NORMAL, { name: "Test", rollMode: "def", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("stonetop-roll-mode");
	});
});

describe("buildRollContent — modifier", () => {
	it("shows modifier and stat name when provided", () => {
		const html = buildRollContent(NORMAL, { name: "Test", bonus: 2, statKey: "wis", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("+2");
		expect(html).toContain("WIS");
	});

	it("shows negative modifier correctly", () => {
		const html = buildRollContent(NORMAL, { name: "Test", bonus: -1, statKey: "str", resultKey: "failure", resultLabel: "Miss" });
		expect(html).toContain("-1");
	});

	it("shows +0 modifier when stat is 0", () => {
		const html = buildRollContent(NORMAL, { name: "Test", bonus: 0, statKey: "wis", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("+0");
	});

	it("omits modifier section when statKey not provided", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("stonetop-roll-mod");
	});
});

describe("buildRollContent — heading and structure", () => {
	it("wraps name in h3", () => {
		const html = buildRollContent(NORMAL, { name: "All is Illuminated (+WIS) — Strong Hit", resultKey: "success", resultLabel: "Strong Hit" });
		expect(html).toContain("<h3>All is Illuminated (+WIS) — Strong Hit</h3>");
	});

	it("includes description when provided", () => {
		const html = buildRollContent(NORMAL, { name: "Test", description: "<p>Roll +WIS.</p>", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("<p>Roll +WIS.</p>");
	});

	it("omits description section when absent", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("undefined");
	});

	it("includes result text in stonetop-move-result div when provided", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "success", resultLabel: "Strong Hit", resultText: "You succeed!" });
		expect(html).toContain("stonetop-move-result--success");
		expect(html).toContain("You succeed!");
	});

	it("omits result div when resultText is empty", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit", resultText: "" });
		expect(html).not.toContain("stonetop-move-result");
	});

	it("shows total", () => {
		const html = buildRollContent(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("= 8");
	});
});
