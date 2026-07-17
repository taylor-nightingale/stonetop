// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

function elementFrom(html, selector) {
	document.body.innerHTML = html;
	return document.querySelector(selector);
}

describe("ChoiceTarget.fromElement", () => {
	it("captures the cg dataset fields", () => {
		const el = elementFrom(
			`<input class="stonetop-cg-pick" data-cg-context="lore" data-cg-group="g" data-cg-option="o" data-cg-siblings="a,b">`,
			".stonetop-cg-pick",
		);
		const target = ChoiceTarget.fromElement(el);
		expect(target.context).toBe("lore");
		expect(target.group).toBe("g");
		expect(target.option).toBe("o");
		expect(target.siblingsCsv).toBe("a,b");
	});

	it("defaults absent dataset fields and containers to null", () => {
		const el = elementFrom(`<input class="stonetop-cg-text">`, ".stonetop-cg-text");
		const target = ChoiceTarget.fromElement(el);
		expect(target.context).toBeNull();
		expect(target.group).toBeNull();
		expect(target.option).toBeNull();
		expect(target.siblingsCsv).toBeNull();
		expect(target.possessionSlug).toBeNull();
		expect(target.insertItemId).toBeNull();
		expect(target.arcanumSlug).toBeNull();
	});

	it("finds the enclosing possession wrapper", () => {
		const el = elementFrom(
			`<div data-possession-slug="lucky-charm"><input class="stonetop-cg-track" data-cg-option="o"></div>`,
			".stonetop-cg-track",
		);
		expect(ChoiceTarget.fromElement(el).possessionSlug).toBe("lucky-charm");
	});

	it("finds the enclosing insert wrapper", () => {
		const el = elementFrom(
			`<div data-insert-item-id="item9"><input class="stonetop-cg-pick" data-cg-group="g"></div>`,
			".stonetop-cg-pick",
		);
		expect(ChoiceTarget.fromElement(el).insertItemId).toBe("item9");
	});

	it("finds the enclosing arcanum card", () => {
		const el = elementFrom(
			`<div class="stonetop-arcanum-card" data-slug="the-eye"><input class="stonetop-cg-text"></div>`,
			".stonetop-cg-text",
		);
		expect(ChoiceTarget.fromElement(el).arcanumSlug).toBe("the-eye");
	});
});

describe("ChoiceTarget.fromFollowerCheck", () => {
	it("maps data-slug to group and data-option to option", () => {
		const el = elementFrom(
			`<input class="stonetop-arcanum-follower-check" data-cg-context="background" data-slug="grp" data-option="opt">`,
			".stonetop-arcanum-follower-check",
		);
		const target = ChoiceTarget.fromFollowerCheck(el);
		expect(target.context).toBe("background");
		expect(target.group).toBe("grp");
		expect(target.option).toBe("opt");
	});

	it("resolves the arcanum card only for the arcana context", () => {
		const el = elementFrom(
			`<div class="stonetop-arcanum-card" data-slug="the-eye">
				<input class="stonetop-arcanum-follower-check" data-cg-context="arcana" data-slug="grp" data-option="opt">
			</div>`,
			".stonetop-arcanum-follower-check",
		);
		expect(ChoiceTarget.fromFollowerCheck(el).arcanumSlug).toBe("the-eye");
	});

	it("ignores an enclosing arcanum card for a non-arcana context", () => {
		const el = elementFrom(
			`<div class="stonetop-arcanum-card" data-slug="the-eye">
				<input class="stonetop-arcanum-follower-check" data-cg-context="background" data-slug="grp" data-option="opt">
			</div>`,
			".stonetop-arcanum-follower-check",
		);
		expect(ChoiceTarget.fromFollowerCheck(el).arcanumSlug).toBeNull();
	});
});
