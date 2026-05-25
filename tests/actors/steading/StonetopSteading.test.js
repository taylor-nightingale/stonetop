import { describe, it, expect, vi, beforeEach } from "vitest";
import { StonetopSteading } from "../../../module/actors/steading/StonetopSteading.js";
import { SteadingDefaults } from "../../../module/model/data/steading/SteadingDefaults.js";
import { SteadingSnapshot } from "../../../module/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingImprovement } from "../../../module/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

// -- Helpers ------------------------------------------------------------------

function makeActor(flags = {}) {
	const store = { ...flags };
	return {
		getFlag: (_scope, key) => key.split(".").reduce((o, k) => o?.[k], store) ?? undefined,
		setFlag: vi.fn(async (scope, key, value) => {
			const parts = key.split(".");
			let obj = store;
			for (let i = 0; i < parts.length - 1; i++) {
				obj[parts[i]] ??= {};
				obj = obj[parts[i]];
			}
			obj[parts[parts.length - 1]] = value;
		}),
	};
}

function makeRepo(improvements = []) {
	return { getAll: async () => improvements };
}

function makeSteading(flags = {}, improvements = []) {
	const actor = makeActor(flags);
	const steading = new StonetopSteading(actor);
	steading.__repo = makeRepo(improvements);
	return steading;
}

// -- Tests --------------------------------------------------------------------

describe("StonetopSteading.buildSnapshot", () => {
	it("returns a SteadingSnapshot", async () => {
		const s = makeSteading();
		expect(await s.buildSnapshot()).toBeInstanceOf(SteadingSnapshot);
	});

	it("uses default fortunes current when no flag set", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.fortunes.current).toBe(SteadingDefaults.fortunes.current);
	});

	it("uses stored fortunes current", async () => {
		const s = makeSteading({ steading: { fortunes: 4 } });
		const snap = await s.buildSnapshot();
		expect(snap.fortunes.current).toBe(4);
	});

	it("marks correct option as selected in fortunes", async () => {
		const s = makeSteading({ steading: { fortunes: 3 } });
		const snap = await s.buildSnapshot();
		expect(snap.fortunes.options[3].selected).toBe(true);
		expect(snap.fortunes.options[0].selected).toBe(false);
	});

	it("uses default surplus when no flag set", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.surplus.current).toBe(SteadingDefaults.surplus.current);
	});

	it("uses stored surplus", async () => {
		const s = makeSteading({ steading: { surplus: 5 } });
		const snap = await s.buildSnapshot();
		expect(snap.surplus.current).toBe(5);
	});

	it("attribute snapshot includes slug", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.attributes.size.slug).toBe("size");
		expect(snap.attributes.defenses.slug).toBe("defenses");
	});

	it("uses default attribute current when no flag set", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.attributes.size.current).toBe(SteadingDefaults.attributes.size.current);
	});

	it("uses stored attribute current", async () => {
		const s = makeSteading({ steading: { attributes: { prosperity: { current: 3 } } } });
		const snap = await s.buildSnapshot();
		expect(snap.attributes.prosperity.current).toBe(3);
	});

	it("marks correct option as selected in attribute", async () => {
		const s = makeSteading({ steading: { attributes: { defenses: { current: 2 } } } });
		const snap = await s.buildSnapshot();
		expect(snap.attributes.defenses.options[2].selected).toBe(true);
	});

	it("defaults all debilities to inactive", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.debilities.every(d => !d.active)).toBe(true);
	});

	it("reads active debility from flags", async () => {
		const s = makeSteading({ steading: { debilities: { lacking: true } } });
		const snap = await s.buildSnapshot();
		const lacking = snap.debilities.find(d => d.slug === "lacking");
		expect(lacking.active).toBe(true);
	});

	it("returns all three debility slugs", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.debilities.map(d => d.slug)).toEqual(["diminished", "lacking", "malcontent"]);
	});

	it("defaults notes to empty string", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.notes).toBe("");
	});

	it("reads stored notes", async () => {
		const s = makeSteading({ steading: { notes: "hello world" } });
		const snap = await s.buildSnapshot();
		expect(snap.notes).toBe("hello world");
	});

	it("defaults residents to empty array", async () => {
		const s = makeSteading();
		const snap = await s.buildSnapshot();
		expect(snap.residents).toEqual([]);
	});

	it("filters improvements with null choices", async () => {
		const improvements = [
			new SteadingImprovement("inn", { slug: "inn", list: [] }),
			new SteadingImprovement("mill", null),
		];
		const s = makeSteading({}, improvements);
		const snap = await s.buildSnapshot();
		expect(snap.improvements).toHaveLength(1);
		expect(snap.improvements[0].slug).toBe("inn");
	});

	it("builds ChoiceGroup from improvement choices", async () => {
		const choices = {
			slug: "palisade",
			list: [
				{ type: "track", slug: "done", description: "Completed", max: 1 },
			],
		};
		const s = makeSteading({}, [new SteadingImprovement("palisade", choices)]);
		const snap = await s.buildSnapshot();
		expect(snap.improvements[0].slug).toBe("palisade");
	});

	it("reflects checked improvement track from stored pickValues", async () => {
		const choices = {
			slug: "palisade",
			list: [{ type: "track", slug: "done", description: "Completed", max: 1 }],
		};
		const s = makeSteading(
			{ improvements: { pickValues: { palisade: { done: 1 } } } },
			[new SteadingImprovement("palisade", choices)],
		);
		const snap = await s.buildSnapshot();
		const trackRow = snap.improvements[0].list[0];
		expect(trackRow.options[0].checks[0]).toBe(true);
	});
});

describe("StonetopSteading mutations", () => {
	it("setFortunes updates the flag", async () => {
		const actor = makeActor();
		const s = new StonetopSteading(actor);
		await s.setFortunes(4);
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "steading.fortunes", 4);
	});

	it("setSurplus updates the flag", async () => {
		const actor = makeActor();
		const s = new StonetopSteading(actor);
		await s.setSurplus(3);
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "steading.surplus", 3);
	});

	it("setDebility updates the debilities flag", async () => {
		const actor = makeActor();
		const s = new StonetopSteading(actor);
		await s.setDebility("diminished", true);
		expect(actor.setFlag).toHaveBeenCalledWith(
			"stonetop", "steading.debilities", { diminished: true },
		);
	});
});
