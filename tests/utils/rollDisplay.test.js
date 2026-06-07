import { describe, it, expect } from "vitest";
import { RollDisplay } from "../../src/utils/rollDisplay.js";
import { FakeNormalRollBuilder } from "../fakes/FakeNormalRollBuilder.js";
import { FakePoolRollBuilder }  from "../fakes/FakePoolRollBuilder.js";

// -- Fixtures ------------------------------------------------------------------

const display = new RollDisplay(k => k);

const NORMAL = new FakeNormalRollBuilder().withValues(3, 5).withTotal(8).build();

// ADV (3d6kh2): 2 kept + 1 dropped
const ADV = new FakePoolRollBuilder()
	.withKeptGroup(3, 5)  // kept
	.withDroppedGroup(2)  // dropped (lowest)
	.withTotal(8)
	.build();

// DIS (3d6kl2): 2 kept + 1 dropped
const DIS = new FakePoolRollBuilder()
	.withKeptGroup(2, 4)  // kept (lowest two)
	.withDroppedGroup(6)  // dropped (highest)
	.withTotal(6)
	.build();

// -- buildRollContent ----------------------------------------------------------

describe("RollDisplay — dice display", () => {
	it("shows both dice values for a normal 2d6 roll", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain(">3<");
		expect(html).toContain(">5<");
	});

	it("shows all three dice for an advantage roll", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain(">3<");
		expect(html).toContain(">5<");
		expect(html).toContain(">2<");
	});

	it("marks the dropped die with --dropped class", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		const dropped = html.match(/stonetop-die--dropped/g)?.length ?? 0;
		expect(dropped).toBe(1);
	});

	it("shows kept dice before dropped die", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		const firstKept  = html.indexOf(">3<");
		const droppedDie = html.indexOf("stonetop-die--dropped");
		expect(firstKept).toBeLessThan(droppedDie);
	});

	it("shows a separator between kept and dropped groups", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("stonetop-dice-separator");
	});

	it("does not show separator for a normal roll", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("stonetop-dice-separator");
	});

	it("marks the dropped group container with --dropped class", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).toContain("stonetop-dice-group--dropped");
		expect(html).not.toContain("stonetop-dice-group stonetop-dice-group--dropped stonetop-dice-group--dropped");
	});

	it("does not mark the kept group with --dropped class", () => {
		const html = display.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial", resultLabel: "Weak Hit" });
		const groups = [...html.matchAll(/stonetop-dice-group[^"]*"/g)].map(m => m[0]);
		expect(groups.some(g => g.includes("--dropped"))).toBe(true);
		expect(groups.some(g => !g.includes("--dropped"))).toBe(true);
	});

	it("does not add --dropped group for a normal roll", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial", resultLabel: "Weak Hit" });
		expect(html).not.toContain("stonetop-dice-group--dropped");
	});
});

describe("RollDisplay — ADV/DIS badge", () => {
	it("shows localized advantage label for adv roll", () => {
		const d = new RollDisplay(k => k === "stonetop.rollMode.adv" ? "Advantage" : k);
		const html = d.build(ADV, { name: "Test", rollMode: "adv", resultKey: "partial" });
		expect(html).toContain("Advantage");
		expect(html).toContain("stonetop-roll-mode--adv");
	});

	it("shows localized disadvantage label for dis roll", () => {
		const d = new RollDisplay(k => k === "stonetop.rollMode.dis" ? "Disadvantage" : k);
		const html = d.build(DIS, { name: "Test", rollMode: "dis", resultKey: "failure" });
		expect(html).toContain("Disadvantage");
		expect(html).toContain("stonetop-roll-mode--dis");
	});

	it("shows no badge for a normal roll", () => {
		const html = display.build(NORMAL, { name: "Test", rollMode: "def", resultKey: "partial" });
		expect(html).not.toContain("stonetop-roll-mode");
	});
});

describe("RollDisplay — modifier", () => {
	it("shows modifier and stat name when provided", () => {
		const html = display.build(NORMAL, { name: "Test", bonus: 2, statKey: "wis", resultKey: "partial" });
		expect(html).toContain("+2");
		expect(html).toContain("WIS");
	});

	it("shows negative modifier correctly", () => {
		const html = display.build(NORMAL, { name: "Test", bonus: -1, statKey: "str", resultKey: "failure" });
		expect(html).toContain("-1");
	});

	it("shows +0 modifier when stat is 0", () => {
		const html = display.build(NORMAL, { name: "Test", bonus: 0, statKey: "wis", resultKey: "partial" });
		expect(html).toContain("+0");
	});

	it("omits modifier section when statKey not provided", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial" });
		expect(html).not.toContain("stonetop-roll-mod");
	});
});

describe("RollDisplay — heading and structure", () => {
	it("wraps name in h3", () => {
		const html = display.build(NORMAL, { name: "All is Illuminated (+WIS) — Strong Hit", resultKey: "success" });
		expect(html).toContain("<h3>All is Illuminated (+WIS) — Strong Hit</h3>");
	});

	it("includes description when provided", () => {
		const html = display.build(NORMAL, { name: "Test", description: "<p>Roll +WIS.</p>", resultKey: "partial" });
		expect(html).toContain("<p>Roll +WIS.</p>");
	});

	it("omits description section when absent", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial" });
		expect(html).not.toContain("undefined");
	});

	it("includes result text in stonetop-move-result div when provided", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "success", resultText: "You succeed!" });
		expect(html).toContain("stonetop-move-result--success");
		expect(html).toContain("You succeed!");
	});

	it("omits result div when resultText is empty", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial", resultText: "" });
		expect(html).not.toContain("stonetop-move-result");
	});

	it("shows total", () => {
		const html = display.build(NORMAL, { name: "Test", resultKey: "partial" });
		expect(html).toContain("= 8");
	});
});
