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
		expect(target.followerSlug).toBeNull();
		expect(target.moveSlug).toBeNull();
	});

	// A container's identity and its group's slug are independent: the wrapper says which document to
	// write to, the row says which store on that document. A follower's group may be slugged anything.
	it("finds the enclosing follower wrapper without confusing it for the group", () => {
		const el = elementFrom(
			`<div class="stonetop-follower-card" data-slug="enfys">
				<div data-follower-slug="enfys">
					<input class="stonetop-cg-pick" data-cg-context="follower" data-cg-group="choices" data-cg-option="she">
				</div>
			</div>`,
			".stonetop-cg-pick",
		);
		const target = ChoiceTarget.fromElement(el);
		expect(target.followerSlug).toBe("enfys");
		expect(target.group).toBe("choices");
	});

	it("finds the enclosing move wrapper", () => {
		const el = elementFrom(
			`<div data-move-slug="potential-for-greatness">
				<input class="stonetop-cg-track" data-cg-context="move" data-cg-group="choices" data-cg-option="stat1">
			</div>`,
			".stonetop-cg-track",
		);
		const target = ChoiceTarget.fromElement(el);
		expect(target.moveSlug).toBe("potential-for-greatness");
		expect(target.group).toBe("choices");
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
