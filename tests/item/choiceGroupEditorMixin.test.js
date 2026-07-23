// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { activateChoiceGroupEditors } from "../../src/item/choiceGroupEditorMixin.js";

// Exercises the mixin's path→save routing: a top-level group field, an ArrayField element that IS a
// group, and a group nested in an array element's subfield. Only foundry.utils + the item are real
// (setup.js provides foundry.utils); the item.update spy captures the write.

function makeSheet(system) {
	const item = {
		system,
		update: vi.fn(async patch => {
			for (const [k, v] of Object.entries(patch)) foundry.utils.setProperty(item, k, v);
		}),
	};
	return { item };
}

function render(html) {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

describe("activateChoiceGroupEditors — save routing", () => {
	it("writes a top-level group field directly", () => {
		const sheet = makeSheet({ slug: "pb", instinct: { slug: "instinct", list: [] } });
		const root  = render(`
			<div data-cg-path="system.instinct">
				<button class="choices-add-row" data-type="entry"></button>
			</div>`);
		activateChoiceGroupEditors(sheet, root);
		root.querySelector(".choices-add-row").click();

		expect(sheet.item.update).toHaveBeenCalledTimes(1);
		const patch = sheet.item.update.mock.calls[0][0];
		expect(Object.keys(patch)).toEqual(["system.instinct"]);
		expect(patch["system.instinct"].list).toHaveLength(1);
	});

	it("rewrites the whole array when the element itself is the group", () => {
		const sheet = makeSheet({ slug: "pb", choices: [{ slug: "g0", list: [] }, { slug: "g1", list: [] }] });
		const root  = render(`
			<div data-cg-path="system.choices.1">
				<button class="choices-add-row" data-type="entry"></button>
			</div>`);
		activateChoiceGroupEditors(sheet, root);
		root.querySelector(".choices-add-row").click();

		const patch = sheet.item.update.mock.calls[0][0];
		expect(Object.keys(patch)).toEqual(["system.choices"]);   // whole ArrayField, not a dotted index
		expect(patch["system.choices"][0].list).toHaveLength(0);  // sibling untouched
		expect(patch["system.choices"][1].list).toHaveLength(1);  // edited element
	});

	it("rewrites the whole array when the group is a subfield of an element (backgrounds.N.choices)", () => {
		const sheet = makeSheet({
			slug: "pb",
			backgrounds: [
				{ slug: "b0", label: "One", choices: { slug: "b0", list: [] } },
				{ slug: "b1", label: "Two", choices: { slug: "b1", list: [] } },
			],
		});
		const root = render(`
			<div data-cg-path="system.backgrounds.0.choices">
				<button class="choices-add-row" data-type="pick"></button>
			</div>`);
		activateChoiceGroupEditors(sheet, root);
		root.querySelector(".choices-add-row").click();

		const patch = sheet.item.update.mock.calls[0][0];
		expect(Object.keys(patch)).toEqual(["system.backgrounds"]);
		expect(patch["system.backgrounds"][0].choices.list).toHaveLength(1); // edited
		expect(patch["system.backgrounds"][0].label).toBe("One");            // element siblings survive
		expect(patch["system.backgrounds"][1].choices.list).toHaveLength(0); // other element untouched
	});
});
