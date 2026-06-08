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
});
