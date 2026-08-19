import { describe, it, expect, vi } from "vitest";
import { AddInventoryItemDialog, NewInventoryItem } from "../../../src/actors/character/AddInventoryItemDialog.js";

// Stands in for the DialogV2 the player interacts with: runs the ok-callback against a form whose
// fields hold `values`, or resolves to `dismissed` when the dialog was closed instead.
function fakePrompt({ values = null } = {}) {
	return vi.fn(async config => {
		if (!values) return null;
		const elements = {
			name:   { value: values.name },
			weight: values.weight === undefined ? undefined : { value: values.weight },
		};
		return config.ok.callback({}, { form: { elements } });
	});
}

function makeDialog(prompt) {
	return new AddInventoryItemDialog({
		renderTemplate: vi.fn(async () => "<form></form>"),
		prompt,
		localize: key => key,
	});
}

describe("NewInventoryItem", () => {
	it("carries a regular item's own weight", () => {
		const item = NewInventoryItem.regular("Rope", 2);
		expect(item).toMatchObject({ name: "Rope", weight: 2, isRegular: true });
	});

	it("fixes a small item at weight 1", () => {
		expect(NewInventoryItem.small("Flint")).toMatchObject({ name: "Flint", weight: 1, isRegular: false });
	});
});

describe("AddInventoryItemDialog", () => {
	it("collects a regular item with its weight", async () => {
		const item = await makeDialog(fakePrompt({ values: { name: "Rope", weight: "3" } })).show({ isRegular: true });
		expect(item).toEqual(NewInventoryItem.regular("Rope", 3));
	});

	it("defaults a regular item to weight 1 when the field is blank or unparsable", async () => {
		const item = await makeDialog(fakePrompt({ values: { name: "Rope", weight: "" } })).show({ isRegular: true });
		expect(item.weight).toBe(1);
	});

	it("ignores any weight entered for a small item", async () => {
		const item = await makeDialog(fakePrompt({ values: { name: "Flint", weight: "9" } })).show({ isRegular: false });
		expect(item).toEqual(NewInventoryItem.small("Flint"));
	});

	it("trims the entered name", async () => {
		const item = await makeDialog(fakePrompt({ values: { name: "  Rope  ", weight: "1" } })).show({ isRegular: true });
		expect(item.name).toBe("Rope");
	});

	// Dismissing and confirming with a blank name are the same answer to the caller: nothing to add.
	it("answers null when dismissed", async () => {
		expect(await makeDialog(fakePrompt()).show({ isRegular: true })).toBeNull();
	});

	it("answers null when the name is left blank", async () => {
		const dialog = makeDialog(fakePrompt({ values: { name: "   ", weight: "1" } }));
		expect(await dialog.show({ isRegular: true })).toBeNull();
	});

	it("titles the dialog for the column it was opened from", async () => {
		const prompt = fakePrompt({ values: { name: "Flint" } });
		await makeDialog(prompt).show({ isRegular: false });
		expect(prompt.mock.calls[0][0].window.title).toBe("stonetop.inventory.addSmallItem");

		const regularPrompt = fakePrompt({ values: { name: "Rope", weight: "1" } });
		await makeDialog(regularPrompt).show({ isRegular: true });
		expect(regularPrompt.mock.calls[0][0].window.title).toBe("stonetop.inventory.addItem");
	});
});
