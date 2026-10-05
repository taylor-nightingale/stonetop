// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { OutfitItemAdder, AdderPlace } from "../../../src/actors/character/OutfitItemAdder.js";
import { InventoryOwner } from "../../../src/actors/character/InventoryOwner.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { settle } from "../../fakes/domEvents.js";

// The outfit adder's view state: which "+ add item" it hangs from, the item being written, and
// where the focus goes. On the sheet instance, like the wound editor's: nothing is written to the
// actor until Add, and a render from elsewhere keeps what was typed.

beforeAll(() => { new FakeGameBuilder().build(); });
beforeEach(() => { document.body.innerHTML = ""; });

function sheet() {
	document.body.innerHTML = `
		<form class="root">
			<div class="elsewhere">tab</div>
			<button type="button" data-action="addInventoryItem" data-column="regular">+ add</button>
			<div class="stonetop-outfit-adder">
				<div class="stonetop-outfit-adder-preview"></div>
				<input type="text" data-draft-field="name">
				<button type="button" data-draft-step="weight" data-step="-1">−</button>
				<input type="number" data-draft-field="weight" value="1">
				<button type="button" data-draft-step="weight" data-step="1">+</button>
				<input type="number" data-draft-field="uses" value="0">
				<button type="button" data-draft-step="uses" data-step="1">+</button>
				<input type="text" data-draft-field="usesWord">
				<input type="text" data-draft-field="note">
				<p class="inside">words</p>
			</div>
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<button type="button" data-action="addInventoryItem" data-column="regular">+ add</button>
			</div>
		</form>`;
	return document.querySelector(".root");
}

const type = (root, field, value) => {
	const input = root.querySelector(`[data-draft-field="${field}"]`);
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
};

function attached({ place = AdderPlace.fromButton(document.createElement("button")) } = {}) {
	const root = sheet();
	const adder = new OutfitItemAdder();
	const hooks = { onClose: vi.fn(), onAdd: vi.fn(), renderPreview: vi.fn(async () => "<b>row</b>") };
	adder.attach(root, hooks);
	adder.open(place);
	return { root, adder, hooks };
}

describe("AdderPlace", () => {
	it("names the character's two columns and each follower's inventory apart", () => {
		const root = sheet();
		const [own, follower] = root.querySelectorAll('[data-action="addInventoryItem"]');
		const small = document.createElement("button");
		small.dataset.column = "small";
		expect(AdderPlace.fromButton(own).key).toBe("character:regular");
		expect(AdderPlace.fromButton(small).key).toBe("character:small");
		expect(AdderPlace.fromButton(follower).key).toBe("follower:enfys");
	});

	it("knows whose inventory it adds to, and whether the item has a weight", () => {
		const root = sheet();
		const follower = AdderPlace.fromButton(root.querySelectorAll('[data-action="addInventoryItem"]')[1]);
		expect(follower.owner).toEqual(InventoryOwner.follower("enfys"));
		expect(follower.isRegular).toBe(true);
	});
});

describe("OutfitItemAdder", () => {
	// It hangs from its "+ add item"; at the foot of a long list that can be below what the window shows.
	it("brings itself into view once, when it opens — never on the re-renders after", () => {
		const { root, adder } = attached();
		const reveal = vi.fn();
		adder.applyReveal(root, reveal);
		adder.applyReveal(root, reveal);
		expect(reveal).toHaveBeenCalledOnce();
		expect(reveal.mock.calls[0][0]).toBe(root.querySelector(".stonetop-outfit-adder"));
	});

	it("is shut, with nothing to draw, until opened", () => {
		const adder = new OutfitItemAdder();
		expect(adder.isOpen).toBe(false);
		expect(adder.view()).toBeNull();
	});

	it("opens at a place on a fresh draft for its column", () => {
		const adder = new OutfitItemAdder();
		const small = document.createElement("button");
		small.dataset.column = "small";
		adder.open(AdderPlace.fromButton(small));
		const view = adder.view();
		expect([view.key, view.square, view.draft.isRegular, view.tagField]).toEqual(["character:small", true, false, OutfitItemAdder.TAG_FIELD]);
	});

	it("keeps the draft across views until shut", () => {
		const adder = new OutfitItemAdder();
		adder.open(AdderPlace.fromButton(document.createElement("button")));
		adder.update(d => d.withName("Rope"));
		expect(adder.view().draft.name).toBe("Rope");
		expect(adder.view().preview.name).toBe("Rope");
		adder.close();
		expect(adder.view()).toBeNull();
	});

	it("writes what is typed into the draft, and redraws the preview from it", async () => {
		const { root, adder, hooks } = attached();
		type(root, "name", "Naphtha");
		type(root, "weight", "2");
		type(root, "uses", "3");
		type(root, "usesWord", "uses");
		type(root, "note", "burns hot");
		await settle();
		expect(adder.draft).toMatchObject({ name: "Naphtha", weight: 2, uses: 3, usesWord: "uses", note: "burns hot" });
		expect(hooks.renderPreview).toHaveBeenLastCalledWith(adder.view());
		expect(root.querySelector(".stonetop-outfit-adder-preview").innerHTML).toBe("<b>row</b>");
	});

	it("steps the weight and the uses from their − and +, the field showing the new number", async () => {
		const { root, adder } = attached();
		root.querySelector('[data-draft-step="weight"][data-step="1"]').click();
		root.querySelector('[data-draft-step="weight"][data-step="1"]').click();
		root.querySelector('[data-draft-step="uses"]').click();
		await settle();
		expect([adder.draft.weight, adder.draft.uses]).toEqual([3, 1]);
		expect(root.querySelector('[data-draft-field="weight"]').value).toBe("3");
		root.querySelector('[data-draft-step="weight"][data-step="-1"]').click();
		root.querySelector('[data-draft-step="weight"][data-step="-1"]').click();
		root.querySelector('[data-draft-step="weight"][data-step="-1"]').click();
		expect(adder.draft.weight).toBe(1);
		expect(root.querySelector('[data-draft-field="weight"]').value).toBe("1");
	});

	it("adds on Enter in a text field, rather than submitting the sheet", () => {
		const { root, hooks } = attached();
		const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
		root.querySelector('[data-draft-field="name"]').dispatchEvent(event);
		expect(hooks.onAdd).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(true);
	});

	it("shuts on Escape inside it", () => {
		const { root, hooks } = attached();
		root.querySelector('[data-draft-field="note"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(hooks.onClose).toHaveBeenCalledOnce();
	});

	it("shuts on a click elsewhere on the sheet, not on one inside it or on a + add", () => {
		const { root, hooks } = attached();
		root.querySelector(".inside").click();
		root.querySelector('[data-action="addInventoryItem"]').click();
		expect(hooks.onClose).not.toHaveBeenCalled();
		root.querySelector(".elsewhere").click();
		expect(hooks.onClose).toHaveBeenCalledOnce();
	});

	it("listens for nothing while shut", () => {
		const { root, adder, hooks } = attached();
		adder.close();
		root.querySelector(".elsewhere").click();
		type(root, "name", "Rope");
		expect(hooks.onClose).not.toHaveBeenCalled();
		expect(hooks.renderPreview).not.toHaveBeenCalled();
	});

	it("puts the focus on the name when it opens, and where it was asked for after that, once", () => {
		const { root, adder } = attached();
		adder.applyFocus(root);
		expect(document.activeElement).toBe(root.querySelector('[data-draft-field="name"]'));
		adder.focusOn('[data-draft-field="note"]');
		adder.applyFocus(root);
		expect(document.activeElement).toBe(root.querySelector('[data-draft-field="note"]'));
		root.querySelector('[data-draft-field="name"]').focus();
		adder.applyFocus(root);
		expect(document.activeElement).toBe(root.querySelector('[data-draft-field="name"]'));
	});
});
