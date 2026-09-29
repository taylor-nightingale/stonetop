// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartialInto } from "../fakes/renderTemplate.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";

/**
 * The five numbers, in the rail (D7): Armor, Level and Damage on the portrait, and hit points and
 * experience as bars. All of them stay editable, and none is lost to the move out of the band.
 */
const vitals = ({ sources = {} } = {}) => new VitalsSnapshotBuilder()
	.withHp(new ValueMax(13, 18))
	.withDamage({ value: "d6" })
	.withArmor(1)
	.withLevel(4)
	.withXp(new ValueMax(4, 14))
	.withSources(new VitalsSourcesSnapshot(
		sources.hp ?? "hp sentence", sources.damage ?? "damage sentence", sources.armor ?? "armor sentence"))
	.withNotes(new VitalsNotesSnapshot("playbook", "playbook", "leather"))
	.build();

const root = opts => ({ stonetop: { vitals: vitals(opts) }, actor: { name: "Maelen", img: "p.webp" }, sheetIdPrefix: "s1" });
const identity = (opts = {}) => renderPartialInto(document.createElement("div"), "stonetop.rail-identity", root(opts));
const hpBar = (opts = {}) => {
	const v = vitals(opts);
	return renderPartialInto(document.createElement("div"), "stonetop.rail-meter", {
		kind: "hp", label: "HP", meter: v.hpMeter, valueAction: "hp", valueLabel: "Current HP",
		maxAction: "maxHp", maxLabel: "Max HP", tooltip: v.sources.hp, describedBy: "s1-vital-hp-source",
	});
};

describe("the portrait's three numbers", () => {
	it("are Armor, Level and Damage, in that order", () => {
		expect([...identity().querySelectorAll(".stonetop-resource__label")].map(el => el.textContent.trim())).toEqual([
			"stonetop.character.attributes.armor", "stonetop.character.attributes.level", "stonetop.character.attributes.damage",
		]);
	});

	it("each stay a field", () => {
		const doc = identity();
		expect(doc.querySelector(".stonetop-char-armor").value).toBe("1");
		expect(doc.querySelector(".stonetop-char-level").value).toBe("4");
		expect(doc.querySelector(".stonetop-char-damage").value).toBe("d6");
	});

	// Where each number came from, said to everyone and drawn to no one: the hover binds pointer
	// events only, so the sentence names the field through aria-describedby as well.
	it("name Armor and Damage with the sentence that explains each", () => {
		const doc = identity();
		for (const [cls, sentence] of [["stonetop-char-armor", "armor sentence"], ["stonetop-char-damage", "damage sentence"]]) {
			const described = doc.querySelector(`#${doc.querySelector(`.${cls}`).getAttribute("aria-describedby")}`);
			expect(described.textContent.trim()).toBe(sentence);
			expect(described.className).toBe("stonetop-visually-hidden");
		}
	});

	it("keep the full sentence on each label's hover", () => {
		const labels = identity().querySelectorAll(".stonetop-resource__label");
		expect(labels[0].getAttribute("data-tooltip")).toBe("armor sentence");
		expect(labels[2].getAttribute("data-tooltip")).toBe("damage sentence");
	});

	it("name nothing where there is nothing to say", () => {
		const armor = identity({ sources: { armor: "" } }).querySelector(".stonetop-cluster-item--armor");
		expect(armor.querySelector(".stonetop-visually-hidden")).toBeNull();
		expect(armor.querySelector(".stonetop-char-armor").getAttribute("aria-describedby")).toBeNull();
	});

	it("roll the damage die from Damage's label", () => {
		expect(identity().querySelector(".stonetop-cluster-item--damage button.rollable").dataset.roll).toBe("damage");
	});
});

describe("the hit points bar", () => {
	it("keeps its provenance on the label's hover and on the maximum", () => {
		const doc = hpBar();
		expect(doc.querySelector(".stonetop-meter-label").getAttribute("data-tooltip")).toBe("hp sentence");
		expect(doc.querySelector("[data-change-action='maxHp']").getAttribute("aria-describedby")).toBe("s1-vital-hp-source");
	});

	it("says its numbers to assistive tech, since the fill is colour", () => {
		const meter = hpBar().querySelector("[role='meter']");
		expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["13", "18"]);
	});

	it("fills to the share left", () => {
		expect(hpBar().querySelector("[role='meter']").getAttribute("style")).toContain("--meter-fill: 72%");
	});

	// A meter's children are presentational: a field inside one is a field assistive tech never meets.
	it("keeps its fields outside the meter", () => {
		const doc = hpBar();
		expect(doc.querySelector("[role='meter'] input")).toBeNull();
		expect(doc.querySelectorAll(".stonetop-meter-bar input")).toHaveLength(2);
	});

	it("steps down with − and up with +", () => {
		const bar = hpBar().querySelector(".stonetop-meter-bar");
		expect(bar.querySelector("[data-step-dir='-1']").textContent).toBe("−");
		expect(bar.querySelector("[data-step-dir='1']").textContent).toBe("+");
	});

	// The one delegated handler finds the field from the button's `.stonetop-stepper`, and has to land
	// on the value — never the maximum.
	it("steps the value, not the maximum", () => {
		const doc = hpBar();
		const cap = doc.querySelector(".stonetop-stepper-btn");
		expect(cap.closest(".stonetop-stepper").querySelector("input.stonetop-step").dataset.changeAction).toBe("hp");
	});
});

describe("a stepper outside the bars", () => {
	it("keeps its ▲▼", () => {
		const doc = renderPartialInto(document.createElement("div"), "stonetop.stepper-buttons", {});
		expect([...doc.querySelectorAll("button")].map(b => b.textContent)).toEqual(["▲", "▼"]);
	});
});
