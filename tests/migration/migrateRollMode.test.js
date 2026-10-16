import { describe, expect, it, vi } from "vitest";
import { migrateRollMode } from "../../src/migration/migrateRollMode.js";

// The roll mode used to be kept on the actor, set from a picker on the sheet. Every roll asks for it
// now (RollModeDialog), so what was stored is read by nothing and goes.

function actorWith({ type = "character", flag } = {}) {
	return {
		type,
		getFlag:   vi.fn((scope, key) => (scope === "stonetop" && key === "rollMode" ? flag : undefined)),
		unsetFlag: vi.fn(async () => {}),
		update:    vi.fn(async () => {}),
	};
}

describe("migrateRollMode", () => {
	it("unsets a stored roll mode", async () => {
		const actor = actorWith({ flag: "adv" });
		await migrateRollMode(actor);
		expect(actor.unsetFlag).toHaveBeenCalledWith("stonetop", "rollMode");
	});

	it("unsets one left at normal too", async () => {
		const actor = actorWith({ flag: "normal" });
		await migrateRollMode(actor);
		expect(actor.unsetFlag).toHaveBeenCalledWith("stonetop", "rollMode");
	});

	it("writes nothing to a character that never had one", async () => {
		const actor = actorWith();
		await migrateRollMode(actor);
		expect(actor.unsetFlag).not.toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
	});

	// The steading's schema also declared a `system.rollMode` nothing ever read. Schema cleaning hides
	// it from the in-memory source, so the stored field can only be deleted, not asked about.
	it("deletes the steading's unused system field", async () => {
		const actor = actorWith({ type: "steading" });
		await migrateRollMode(actor);
		expect(actor.update).toHaveBeenCalledWith({ "system.-=rollMode": null });
	});
});
