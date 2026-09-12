import { describe, it, expect } from "vitest";
import { buildFocusSelector } from "../../src/actors/buildFocusSelector.js";
import { FakeDOMElement, FakeDOMContainer } from "../fakes/FakeDOMElement.js";

function inContainer(el) {
	return new FakeDOMContainer().add(el);
}

describe("buildFocusSelector", () => {
	it("returns null for null element", () => {
		expect(buildFocusSelector(null, new FakeDOMContainer())).toBeNull();
	});

	it("returns null when element is not in container", () => {
		const el = Object.assign(new FakeDOMElement(), { className: "stonetop-resident-name", dataset: { id: "abc" } });
		expect(buildFocusSelector(el, new FakeDOMContainer())).toBeNull();
	});

	it("returns null for element with no stonetop/steading class and no name", () => {
		const el = Object.assign(new FakeDOMElement(), { className: "foo bar" });
		expect(buildFocusSelector(el, inContainer(el))).toBeNull();
	});

	it("returns null for element with multiple non-stonetop classes", () => {
		const el = Object.assign(new FakeDOMElement(), { className: "alpha beta gamma" });
		expect(buildFocusSelector(el, inContainer(el))).toBeNull();
	});

	it("prefers an id, which is unique by definition (regression: NPC hp and max-hp share a class)", () => {
		const el = Object.assign(new FakeDOMElement(), {
			id: "npc-max-hp",
			className: "stonetop-creature-hp__input stonetop-step",
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe("#npc-max-hp");
	});

	it("ignores an id a selector cannot carry unescaped", () => {
		const el = Object.assign(new FakeDOMElement(), {
			id: "sheet.part:1",
			className: "stonetop-notes",
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe(".stonetop-notes");
	});

	// HP, armor, XP and level all carry `.stonetop-resource__input` with no data hook between them,
	// so the class alone matched the sheet's FIRST one: stepping XP put the caret in HP.
	it("qualifies a class-only field by its change action", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-resource__input stonetop-char-xp stonetop-step",
			dataset: { changeAction: "xp" },
		});
		expect(buildFocusSelector(el, inContainer(el)))
			.toBe('.stonetop-resource__input[data-change-action="xp"]');
	});

	// A follower's hp and hp-max share their class AND their slug; the action is the only difference.
	it("qualifies a slug-addressed field by its change action", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-creature-hp__input stonetop-follower-hp-max stonetop-step",
			dataset: { slug: "guard", changeAction: "followerHpMax" },
		});
		expect(buildFocusSelector(el, inContainer(el)))
			.toBe('.stonetop-creature-hp__input[data-slug="guard"][data-change-action="followerHpMax"]');
	});

	it("uses data-id when present", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-resident-name",
			dataset: { id: "abc" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.stonetop-resident-name[data-id="abc"]');
	});

	it("uses data-slug when present", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-follower-name-input",
			dataset: { slug: "guard" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.stonetop-follower-name-input[data-slug="guard"]');
	});

	it("uses data-attr + data-index when both present", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-attr-extra",
			dataset: { attr: "prosperity", index: "1" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.stonetop-attr-extra[data-attr="prosperity"][data-index="1"]');
	});

	it("uses data-attr alone for a rating control (regression: changing Size focused Fortunes)", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "steading-attr-input steading-size-select",
			dataset: { attr: "size" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.steading-attr-input[data-attr="size"]');
	});

	it("uses data-index alone when no data-attr", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-asset-item",
			dataset: { index: "2" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.stonetop-asset-item[data-index="2"]');
	});

	it("uses cg-context/group/option when present", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-cg-text",
			dataset: { cgContext: "instinct", cgGroup: "grp", cgOption: "opt" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe(
			'.stonetop-cg-text[data-cg-context="instinct"][data-cg-group="grp"][data-cg-option="opt"]',
		);
	});

	it("uses name attribute when no stonetop class", () => {
		const el = Object.assign(new FakeDOMElement(), { name: "name" });
		expect(buildFocusSelector(el, inContainer(el))).toBe('[name="name"]');
	});

	it("falls back to single stonetop class when no data attributes or name", () => {
		const el = Object.assign(new FakeDOMElement(), { className: "stonetop-instinct-custom" });
		expect(buildFocusSelector(el, inContainer(el))).toBe(".stonetop-instinct-custom");
	});

	it("picks first stonetop class when element also has non-stonetop classes", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "sheet-input stonetop-notes other",
			dataset: {},
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe(".stonetop-notes");
	});

	it("works with steading- prefixed classes", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "steading-surplus-input",
			dataset: { index: "0" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.steading-surplus-input[data-index="0"]');
	});

	it("data-id takes priority over data-slug", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-resident-name",
			dataset: { id: "abc", slug: "xyz" },
		});
		expect(buildFocusSelector(el, inContainer(el))).toBe('.stonetop-resident-name[data-id="abc"]');
	});

	it("disambiguates a class-only radio by name+value (regression: origin scrolled to top)", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-item-check",
			name: "stonetop-origin",
			value: "Stonetop",
		});
		expect(buildFocusSelector(el, inContainer(el)))
			.toBe('.stonetop-item-check[name="stonetop-origin"][value="Stonetop"]');
	});

	it("uses name+value for a named input with no stonetop class", () => {
		const el = Object.assign(new FakeDOMElement(), { name: "foo", value: "bar" });
		expect(buildFocusSelector(el, inContainer(el))).toBe('[name="foo"][value="bar"]');
	});

	it("combines slug+index for group-member inputs (so editing member 2 doesn't refocus member 1)", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-member-name",
			dataset: { slug: "crew", index: "1" },
		});
		expect(buildFocusSelector(el, inContainer(el)))
			.toBe('.stonetop-member-name[data-slug="crew"][data-index="1"]');
	});

	it("identifies a tag chip by slug+tag (so removing it doesn't scroll to another chip)", () => {
		const el = Object.assign(new FakeDOMElement(), {
			className: "stonetop-tag-chip is-selected",
			dataset: { slug: "crew", tag: "group" },
		});
		expect(buildFocusSelector(el, inContainer(el)))
			.toBe('.stonetop-tag-chip[data-slug="crew"][data-tag="group"]');
	});
});
