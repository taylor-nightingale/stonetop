import { describe, it, expect, vi } from "vitest";
import { StonetopSteading, improvementRequirementsMet, IMPROVEMENT_DEFINITIONS } from "../../../module/actors/steading/StonetopSteading.js";

function makeSteadingActor({ system = {}, steadingFlags = {} } = {}) {
	return {
		type: "stonetop",
		system,
		flags: { stonetop: { steading: steadingFlags } },
		getFlag: (scope, key) => {
			if (scope !== "stonetop" || key !== "steading") return null;
			return steadingFlags;
		},
		update: vi.fn(),
	};
}

describe("StonetopSteading", () => {
	it("prefers flag-backed track values when building the sheet snapshot", async () => {
		const actor = makeSteadingActor({
			system: { stats: { fortunes: { value: 1 } } },
			steadingFlags: { system: { stats: { fortunes: { value: 2 } } } },
		});
		const snapshot = await new StonetopSteading(actor).buildSnapshot();
		expect(snapshot.system.stats.fortunes.value).toBe(2);
	});

	it("persists track changes to both system data and the steading flag fallback", async () => {
		const actor = makeSteadingActor();
		await new StonetopSteading(actor).setSystemValue("attributes.prosperity.value", 2);
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.prosperity.value": 2,
			"flags.stonetop.steading.system.attributes.prosperity.value": 2,
		}, {});
	});

	it("marks improvements as earned when completed or requirement progress exists", async () => {
		const actor = makeSteadingActor({
			steadingFlags: {
				improvements: {
					standingWatch: { completed: true, r: [] },
					palisade: { completed: false, r: [true] },
				},
			},
		});
		const snapshot = await new StonetopSteading(actor).buildSnapshot();
		const bySlug = Object.fromEntries(snapshot.improvements.map(imp => [imp.slug, imp]));

		expect(bySlug.standingWatch.earned).toBe(true);
		expect(bySlug.palisade.earned).toBe(true);
		expect(bySlug.weaponsOfWar.earned).toBe(false);
	});

	describe("requirement gating (completeLocked / requirementsMet)", () => {
		const snapshotBySlug = async (improvements) => {
			const actor = makeSteadingActor({ steadingFlags: { improvements } });
			const snapshot = await new StonetopSteading(actor).buildSnapshot();
			return Object.fromEntries(snapshot.improvements.map(imp => [imp.slug, imp]));
		};

		it("locks completion until an 'all of the following' section is fully checked", async () => {
			// palisade: one section, all 4 items required.
			let bySlug = await snapshotBySlug({ palisade: { completed: false, r: [true, true, true] } });
			expect(bySlug.palisade.requirementsMet).toBe(false);
			expect(bySlug.palisade.completeLocked).toBe(true);

			bySlug = await snapshotBySlug({ palisade: { completed: false, r: [true, true, true, true] } });
			expect(bySlug.palisade.requirementsMet).toBe(true);
			expect(bySlug.palisade.completeLocked).toBe(false);
		});

		it("honors a section's 'N of the following' minimum", async () => {
			// heroicReputation: one section, any 3 of 6.
			let bySlug = await snapshotBySlug({ heroicReputation: { r: [true, true, false, false, false, false] } });
			expect(bySlug.heroicReputation.requirementsMet).toBe(false);

			bySlug = await snapshotBySlug({ heroicReputation: { r: [true, true, true, false, false, false] } });
			expect(bySlug.heroicReputation.requirementsMet).toBe(true);
		});

		it("treats grouped sections as alternatives (weaponsOfWar: either-source AND finish)", () => {
			const weaponsOfWar = IMPROVEMENT_DEFINITIONS.find(d => d.slug === "weaponsOfWar");
			// idx 0 = "either this"; 1-6 = "or all of these"; 7-8 = "and then".
			const sourceViaSingle = [true, false, false, false, false, false, false, true, true];
			expect(improvementRequirementsMet(weaponsOfWar, sourceViaSingle)).toBe(true);

			// Source met but the finishing section incomplete → not met.
			const finishIncomplete = [true, false, false, false, false, false, false, true, false];
			expect(improvementRequirementsMet(weaponsOfWar, finishIncomplete)).toBe(false);
		});

		it("leaves an already-completed improvement toggleable even if requirements lapse", async () => {
			const bySlug = await snapshotBySlug({ palisade: { completed: true, r: [] } });
			expect(bySlug.palisade.requirementsMet).toBe(false);
			expect(bySlug.palisade.completeLocked).toBe(false);
		});
	});

	it("includes dragged player characters in the sheet snapshot", async () => {
		const actor = makeSteadingActor({
			steadingFlags: {
				players: [{ uuid: "Actor.hero", name: "Wren", img: "wren.webp", checked: true }],
			},
		});

		const snapshot = await new StonetopSteading(actor).buildSnapshot();

		expect(snapshot.players).toEqual([
			{ uuid: "Actor.hero", name: "Wren", img: "wren.webp", checked: true,
			  traits: "", relations: "", notes: "", resolvedOccupation: "", playbookName: "" },
		]);
	});

	it("surfaces the player's playbook for the tooltip, not the Occupation column", async () => {
		const hero = {
			id: "hero", type: "character", name: "Wren",
			system: { playbook: { name: "The Blessed", slug: "the-blessed" } },
		};
		const prevActors = game.actors;
		game.actors = { get: (id) => (id === "hero" ? hero : null), filter: (fn) => [hero].filter(fn) };
		try {
			const actor = makeSteadingActor({
				steadingFlags: {
					players: [{ id: "hero", uuid: "Actor.hero", name: "Wren", img: "wren.webp", checked: true }],
				},
			});
			const snapshot = await new StonetopSteading(actor).buildSnapshot();
			expect(snapshot.players[0].playbookName).toBe("The Blessed");
			expect(snapshot.players[0].resolvedOccupation).toBe("");
		} finally {
			game.actors = prevActors;
		}
	});

	it("uses a player's manual occupation override when one is set", async () => {
		const actor = makeSteadingActor({
			steadingFlags: {
				players: [{ uuid: "Actor.hero", name: "Wren", img: "wren.webp", checked: true, occupation: "Hawker of Trinkets" }],
			},
		});

		const snapshot = await new StonetopSteading(actor).buildSnapshot();

		expect(snapshot.players[0].resolvedOccupation).toBe("Hawker of Trinkets");
	});

	describe("custom (journal-sourced) improvements", () => {
		function makeMutableSteadingActor(steadingFlags = {}) {
			const actor = {
				type: "stonetop",
				system: {},
				flags: { stonetop: { steading: steadingFlags } },
				getFlag: (scope, key) => (key === "steading" ? actor.flags.stonetop.steading : null),
				setFlag: vi.fn((scope, key, value) => { actor.flags.stonetop.steading = value; return Promise.resolve(); }),
				update: vi.fn(),
			};
			return actor;
		}

		const roadbuilding = {
			name: "ROADBUILDING",
			flavor: "",
			effect: "When you mark all the requirements, you can repair the Roads.",
			sections: [{ heading: "Requires all of the following:", items: ["Unlock the runes", "Recruit a crew"] }],
		};

		it("adds a dropped improvement and surfaces it in the snapshot as custom", async () => {
			const actor = makeMutableSteadingActor();
			const steading = new StonetopSteading(actor);

			const result = await steading.addCustomImprovement(roadbuilding);
			expect(result).toMatchObject({ ok: true, slug: "custom-roadbuilding", label: "ROADBUILDING" });

			const snapshot = await steading.buildSnapshot();
			const added = snapshot.improvements.find(i => i.slug === "custom-roadbuilding");
			expect(added).toBeTruthy();
			expect(added.custom).toBe(true);
			expect(added.label).toBe("ROADBUILDING");
			expect(added.sections[0].items.map(i => i.label)).toEqual(["Unlock the runes", "Recruit a crew"]);
			// Built-ins are still present and flagged non-custom.
			expect(snapshot.improvements.find(i => i.slug === "palisade").custom).toBe(false);
		});

		it("refuses a duplicate name (existing custom or built-in label) and an empty name", async () => {
			const actor = makeMutableSteadingActor({ customImprovements: [
				{ slug: "custom-roadbuilding", label: "ROADBUILDING", flavor: "", sections: [], effect: "" },
			] });
			const steading = new StonetopSteading(actor);

			expect(await steading.addCustomImprovement(roadbuilding)).toMatchObject({ ok: false, reason: "duplicate" });
			expect(await steading.addCustomImprovement({ name: "Palisade" })).toMatchObject({ ok: false, reason: "duplicate" });
			expect(await steading.addCustomImprovement({ name: "   " })).toMatchObject({ ok: false, reason: "empty" });
		});

		it("tracks requirement/completion state for a custom improvement by its slug", async () => {
			const actor = makeMutableSteadingActor({
				customImprovements: [{ slug: "custom-roadbuilding", label: "ROADBUILDING", flavor: "", effect: "",
					sections: [{ heading: "Requires:", items: ["Unlock the runes", "Recruit a crew"] }] }],
				improvements: { "custom-roadbuilding": { completed: false, r: [true, false] } },
			});
			const snapshot = await new StonetopSteading(actor).buildSnapshot();
			const added = snapshot.improvements.find(i => i.slug === "custom-roadbuilding");
			expect(added.earned).toBe(true);
			expect(added.sections[0].items[0].checked).toBe(true);
			expect(added.sections[0].items[1].checked).toBe(false);
		});

		it("removes a custom improvement and clears its tracking state", async () => {
			const actor = makeMutableSteadingActor({
				customImprovements: [{ slug: "custom-roadbuilding", label: "ROADBUILDING", flavor: "", effect: "", sections: [] }],
				improvements: { "custom-roadbuilding": { completed: true, r: [] }, palisade: { completed: true, r: [] } },
			});
			const steading = new StonetopSteading(actor);

			expect(await steading.removeCustomImprovement("custom-roadbuilding")).toBe(true);
			expect(actor.flags.stonetop.steading.customImprovements).toEqual([]);
			expect(actor.flags.stonetop.steading.improvements).toEqual({ palisade: { completed: true, r: [] } });
			// Removing an unknown slug is a no-op.
			expect(await steading.removeCustomImprovement("custom-nope")).toBe(false);
		});
	});

	describe("requisition assets", () => {
		function makeAssetActor(assets) {
			const actor = {
				type: "stonetop",
				system: {},
				flags: { stonetop: { steading: { assets } } },
				getFlag: (scope, key) => (key === "steading" ? actor.flags.stonetop.steading : null),
				setFlag: vi.fn((scope, key, value) => { actor.flags.stonetop.steading = value; }),
				update: vi.fn(),
			};
			return actor;
		}

		it("marks an asset taken: unchecks it and records who took it, leaving others untouched", async () => {
			const actor = makeAssetActor([
				{ name: "Horses", checked: true },
				{ name: "Wagon", checked: true },
			]);
			const steading = new StonetopSteading(actor);

			const ok = await steading.setAssetTaken(0, { name: "Wren", id: "hero1" });

			expect(ok).toBe(true);
			expect(actor.flags.stonetop.steading.assets).toEqual([
				{ name: "Horses", checked: false, takenBy: { name: "Wren", id: "hero1" } },
				{ name: "Wagon", checked: true },
			]);
		});

		it("refuses to take an empty (nameless) asset slot", async () => {
			const actor = makeAssetActor([{ name: "", checked: false }]);
			const steading = new StonetopSteading(actor);

			expect(await steading.setAssetTaken(0, { name: "Wren", id: "hero1" })).toBe(false);
			expect(await steading.setAssetTaken(5, { name: "Wren", id: "hero1" })).toBe(false);
			expect(actor.setFlag).not.toHaveBeenCalled();
		});

		it("returns a taken asset: re-checks it and clears the taken-by note", async () => {
			const actor = makeAssetActor([
				{ name: "Horses", checked: false, takenBy: { name: "Wren", id: "hero1" } },
			]);
			const steading = new StonetopSteading(actor);

			const ok = await steading.returnAsset(0);

			expect(ok).toBe(true);
			expect(actor.flags.stonetop.steading.assets).toEqual([{ name: "Horses", checked: true }]);
		});

		it("lists only named, on-hand assets as available", () => {
			const actor = makeAssetActor([
				{ name: "Horses", checked: true },
				{ name: "Wagon", checked: false, takenBy: { name: "Wren", id: "hero1" } },
				{ name: "", checked: false },
			]);

			expect(new StonetopSteading(actor).getAvailableAssets()).toEqual([
				{ name: "Horses", checked: true, index: 0 },
			]);
		});
	});
});
