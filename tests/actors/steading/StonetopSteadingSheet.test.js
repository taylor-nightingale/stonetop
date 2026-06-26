import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../module/actors/steading/StonetopSteadingSheet.js";

function makeSheet({ players = [], addResult, removeResult } = {}) {
	const typedActor = {
		_flags: { players },
		setFlags: vi.fn(async updates => {
			typedActor._flags = { ...typedActor._flags, ...updates };
		}),
		addCustomImprovement: vi.fn(async () => addResult ?? { ok: true, slug: "custom-x", label: "X" }),
		removeCustomImprovement: vi.fn(async () => removeResult ?? true),
	};
	const actor = {
		name: "Stonetop",
		type: "stonetop",
		typedActor,
		getFlag: vi.fn(),
	};
	const Base = class {
		constructor() { this._actor = actor; }
		get actor() { return this._actor; }
		get isEditable() { return true; }
		render() {}
	};
	const Sheet = createStonetopSteadingSheetClass(Base);
	return { sheet: new Sheet(), typedActor };
}

describe("StonetopSteadingSheet", () => {
	beforeEach(() => {
		globalThis.ui = {
			notifications: {
				info: vi.fn(),
				warn: vi.fn(),
			},
		};
	});

	it("adds dropped character actors to the players list", async () => {
		const { sheet, typedActor } = makeSheet();

		await sheet._onDropPlayerCharacter({
			id: "hero-id",
			uuid: "Actor.hero",
			name: "Wren",
			img: "wren.webp",
			type: "character",
		});

		expect(typedActor.setFlags).toHaveBeenCalledWith({
			players: [{
				id: "hero-id",
				uuid: "Actor.hero",
				name: "Wren",
				img: "wren.webp",
				checked: true,
				traits: "",
				relations: "",
				notes: "",
			}],
		});
	});

	it("does not add the same dropped character twice", async () => {
		const { sheet, typedActor } = makeSheet({
			players: [{ id: "hero-id", uuid: "Actor.hero", name: "Wren", img: "wren.webp", checked: true }],
		});

		await sheet._onDropPlayerCharacter({
			id: "hero-id",
			uuid: "Actor.hero",
			name: "Wren",
			img: "wren.webp",
			type: "character",
		});

		expect(typedActor.setFlags).not.toHaveBeenCalled();
		expect(globalThis.ui.notifications.info).toHaveBeenCalledWith("Wren is already in the players list.");
	});

	it("adds a dropped steading-improvement card as a tracked improvement", async () => {
		const { sheet, typedActor } = makeSheet({ addResult: { ok: true, slug: "custom-roadbuilding", label: "ROADBUILDING" } });
		const improvement = { name: "ROADBUILDING", sections: [], effect: "..." };

		await sheet._onDropSteadingImprovement(improvement);

		expect(typedActor.addCustomImprovement).toHaveBeenCalledWith(improvement);
		expect(globalThis.ui.notifications.info).toHaveBeenCalledWith("Added steading improvement: ROADBUILDING.");
	});

	it("warns instead of adding when the improvement is already present", async () => {
		const { sheet, typedActor } = makeSheet({ addResult: { ok: false, reason: "duplicate", label: "ROADBUILDING" } });

		await sheet._onDropSteadingImprovement({ name: "ROADBUILDING" });

		expect(typedActor.addCustomImprovement).toHaveBeenCalled();
		expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith("ROADBUILDING is already a steading improvement.");
	});

	it("ignores a malformed drop payload", async () => {
		const { sheet, typedActor } = makeSheet();
		await sheet._onDropSteadingImprovement(undefined);
		await sheet._onDropSteadingImprovement({ flavor: "no name" });
		expect(typedActor.addCustomImprovement).not.toHaveBeenCalled();
	});

	it("removes a custom improvement by slug", async () => {
		const { sheet, typedActor } = makeSheet();
		await sheet._onRemoveCustomImprovement("custom-roadbuilding");
		expect(typedActor.removeCustomImprovement).toHaveBeenCalledWith("custom-roadbuilding");
	});
});
