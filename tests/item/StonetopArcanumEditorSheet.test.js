import { describe, it, expect } from "vitest";
import { buildArcanumFlagsUpdate } from "../../module/item/StonetopArcanumEditorSheet.js";
import { ITEM_FLAG_SCOPE } from "../../module/actors/character/StonetopFlags.js";

const FRONT = `flags.${ITEM_FLAG_SCOPE}.front`;
const BACK  = `flags.${ITEM_FLAG_SCOPE}.back`;

describe("buildArcanumFlagsUpdate", () => {
	it("produces a complete, valid payload from an empty form", () => {
		const u = buildArcanumFlagsUpdate({});
		expect(u.system.moveType).toBe("arcanum");
		expect(u.name).toBe("Custom Arcanum"); // fallback when no name/title
		// The reader consumes these unconditionally, so they must always be present.
		expect(u[FRONT]).toEqual({ title: "", description: "", item: null, unlock: { description: "", requirements: [] } });
		expect(u[BACK]).toEqual({ title: "", description: "", item: null, resource: null, move: null, options: [] });
	});

	it("carries titles and descriptions, and defaults the item name from the front title", () => {
		const u = buildArcanumFlagsUpdate({
			"front.title": "A Humble Broom",
			"front.description": "It looks utterly ordinary.",
			"back.title": "Broom of Sweeping",
			"back.description": "It sweeps on its own.",
		});
		expect(u.name).toBe("A Humble Broom");
		expect(u[FRONT].title).toBe("A Humble Broom");
		expect(u[FRONT].description).toBe("It looks utterly ordinary.");
		expect(u[BACK].title).toBe("Broom of Sweeping");
	});

	it("includes a per-side item only when its name is filled", () => {
		const withItem = buildArcanumFlagsUpdate({ "front.item.name": "Broom", "front.item.weight": "1", "front.item.inventoryColumn": "regular" });
		expect(withItem[FRONT].item).toEqual({ name: "Broom", weight: 1, note: null, inventoryColumn: "regular", resource: null });
		const noItem = buildArcanumFlagsUpdate({ "front.item.weight": "1" }); // weight but no name
		expect(noItem[FRONT].item).toBeNull();
	});

	it("defaults the item column to 'arcana' when unset", () => {
		const u = buildArcanumFlagsUpdate({ "back.item.name": "Charm" });
		expect(u[BACK].item.inventoryColumn).toBe("arcana");
	});

	it("builds the back resource from any of title / max / maxStat / labels", () => {
		expect(buildArcanumFlagsUpdate({ "back.resource.title": "Charges" })[BACK].resource).toMatchObject({ title: "Charges", max: 0 });
		expect(buildArcanumFlagsUpdate({ "back.resource.max": "3" })[BACK].resource).toMatchObject({ max: 3, title: null });
		expect(buildArcanumFlagsUpdate({ "back.resource.maxStat": "wis" })[BACK].resource).toMatchObject({ maxStat: "wis" });
		const labels = buildArcanumFlagsUpdate({ "back.resource.labels": "a, b ,c" })[BACK].resource;
		expect(labels.labels).toEqual(["a", "b", "c"]);
	});

	it("omits the back resource when entirely blank", () => {
		expect(buildArcanumFlagsUpdate({ "back.resource.max": "0", "back.resource.labels": "" })[BACK].resource).toBeNull();
	});

	it("builds the back mystery move only when given a name", () => {
		const u = buildArcanumFlagsUpdate({ "back.move.name": "Sweep", "back.move.description": "<p>Sweep clean.</p>", "back.move.rollType": "wis" });
		expect(u[BACK].move).toEqual({ name: "Sweep", rollType: "wis", description: "<p>Sweep clean.</p>" });
		expect(buildArcanumFlagsUpdate({ "back.move.description": "orphaned" })[BACK].move).toBeNull();
	});

	it("always emits empty unlock requirements and back options (fork-shape, no list editor)", () => {
		const u = buildArcanumFlagsUpdate({ "front.unlock.description": "Sweep ten floors." });
		expect(u[FRONT].unlock).toEqual({ description: "Sweep ten floors.", requirements: [] });
		expect(u[BACK].options).toEqual([]);
	});
});
