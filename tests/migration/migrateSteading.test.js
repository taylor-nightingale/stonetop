import { describe, expect, it } from "vitest";
import { migrateSteading } from "../../src/migration/migrateSteading.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

const DEFAULTS = {
	improvements: ["market", "mill"],
	attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
};

// The runner sees the actor AFTER SteadingData.migrateData healed its shape (that path is covered
// in migrateSteadingShape.test.js) — so a legacy steading arrives here with current-shape system
// data but no steadfast. This pass only stamps what it adopts from the Stonetop steadfast.
function healedLegacySteading(system = {}) {
	return new FakeActorBuilder().withType("steading").withSystem({
		steadfast: "",
		attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 2, defenses: -1 },
		assets: { items: ["A wagon"], resources: ["Farming"], fortifications: [], coinage: [] },
		residents: { names: "Aderyn, Bryn", traits: ["curious"] },
		residentPeople: [{ id: "1", name: "Afon" }],
		improvements: [],
		improvementValues: { market: { offer: 1 } },
		debilities: { diminished: true, lacking: false, malcontent: false },
		...system,
	}).build();
}

describe("migrateSteading (one-time semantic pass on the healed model)", () => {
	it("stamps the Stonetop steadfast, grants its improvements, and keeps pick state", async () => {
		const actor = healedLegacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.steadfast).toBe("stonetop");
		expect(actor.system.improvements).toEqual(["market", "mill"]);
		expect(actor.system.improvementValues).toEqual({ market: { offer: 1 } });
	});

	it("captures the steadfast's starting-attribute baseline (for the 'Starts at …' notes)", async () => {
		const actor = healedLegacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.startingAttributes).toEqual(DEFAULTS.attributes);
	});

	it("preserves the healed in-play state (attributes, assets, people, debilities)", async () => {
		const actor = healedLegacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.attributes).toEqual({
			fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 2, defenses: -1,
		});
		expect(actor.system.assets.resources).toEqual(["Farming"]);
		expect(actor.system.residentPeople).toEqual([{ id: "1", name: "Afon" }]);
		expect(actor.system.debilities.diminished).toBe(true);
	});

	it("is idempotent — an already-migrated steading (steadfast set) is left alone", async () => {
		const actor = healedLegacySteading({ steadfast: "stonetop", improvements: ["own-pick"] });
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.improvements).toEqual(["own-pick"]);
	});
});

// Very old steadings kept people / pick state in FLAGS. Those sources still land in the new fields
// (and win over the system copy, which on such actors is empty).
describe("migrateSteading — flag-legacy sources", () => {
	function withFlags(flags) {
		return new FakeActorBuilder().withType("steading").withFlags(flags).withSystem({}).build();
	}

	it("routes flag people/neighbors/pick state into the new fields", async () => {
		const actor = withFlags({
			"improvements.pickValues": { "imp-1": 1 },
			"steading.residents": [{ name: "Aldric" }],
			"steading.neighborPeople": [{ name: "Mira" }],
		});
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.improvementValues).toEqual({ "imp-1": 1 });
		expect(actor.system.residentPeople).toEqual([{ name: "Aldric" }]);
		expect(actor.system.neighborPeople).toEqual([{ name: "Mira" }]);
	});
});
