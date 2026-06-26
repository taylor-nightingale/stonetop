import { describe, it, expect } from "vitest";
import { buildFlagScopeConsolidation } from "../../module/migration/flag-scope.js";

const FROM = "stonetop_pwd";
const TO = "stonetop";

describe("buildFlagScopeConsolidation", () => {
	it("returns null when there's nothing under the legacy scope", () => {
		expect(buildFlagScopeConsolidation({}, FROM, TO)).toBeNull();
		expect(buildFlagScopeConsolidation({ [FROM]: {} }, FROM, TO)).toBeNull();
		expect(buildFlagScopeConsolidation(undefined, FROM, TO)).toBeNull();
	});

	it("returns null when from and to scopes are the same", () => {
		expect(buildFlagScopeConsolidation({ stonetop: { a: 1 } }, "stonetop", "stonetop")).toBeNull();
	});

	it("copies the whole legacy scope when the active scope is empty", () => {
		const flags = { [FROM]: { inventory: { regularPool: 2, checked: { spear: true } }, background: { selected: "shepherd" } } };
		const update = buildFlagScopeConsolidation(flags, FROM, TO);
		expect(update).toEqual({
			"flags.stonetop": { inventory: { regularPool: 2, checked: { spear: true } }, background: { selected: "shepherd" } },
		});
	});

	it("deep-merges, with active-scope values winning on conflicts", () => {
		const flags = {
			[FROM]: { inventory: { regularPool: 2, smallPool: 1 }, lore: { counts: { a: 1 } } },
			[TO]:   { inventory: { regularPool: 5 } }, // already-written newer value wins
		};
		const update = buildFlagScopeConsolidation(flags, FROM, TO);
		expect(update["flags.stonetop"]).toEqual({
			inventory: { regularPool: 5, smallPool: 1 }, // smallPool kept from legacy, regularPool from active
			lore: { counts: { a: 1 } },
		});
	});

	it("does not mutate the input flags", () => {
		const flags = { [FROM]: { a: { b: 1 } } };
		const snapshot = JSON.stringify(flags);
		buildFlagScopeConsolidation(flags, FROM, TO);
		expect(JSON.stringify(flags)).toBe(snapshot);
	});
});
