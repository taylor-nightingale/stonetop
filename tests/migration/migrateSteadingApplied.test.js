import { describe, it, expect } from "vitest";
import { migrateSteadingApplied } from "../../src/migration/migrateSteadingApplied.js";
import { SteadingImprovement } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

/**
 * Applying used to be recorded per IMPROVEMENT and as a bare `true`: `{mill: true}`. That says THAT
 * something happened and nothing about WHAT, which is why it could never be taken back. The record is
 * now per LINE and carries the write itself.
 *
 * Two things the migration has to get right, and one it deliberately gets wrong:
 *   * a steading that has taken its +1 Fortunes must not be offered it again;
 *   * `turnoverExcluded` — opting out before committing — is gone;
 *   * a migrated record cannot say what was written, so it is `legacy`: applied, and not revertable.
 */

// Two completion results the sheet can write, one it cannot, and one that fires later.
const MILL = new SteadingImprovement("mill", "Mill", {
	slug: "mill",
	list: [{ type: "entry", slug: "site", content: { text: "a site" }, track: { max: 1 } }],
}, 0, {
	requires: "site",
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
		{ when: { kind: "completed" }, listEntry: { list: "resources", text: "Mill" }, text: 'add "Mill"' },
		{ when: { kind: "completed" }, text: "draw it on the map" },
		{ when: { kind: "moment", moment: "autumn-harvest" }, change: { target: "surplus", amount: 1 },
		  text: "the steading generates +1 Surplus" },
	],
});

const repository = { getBySlug: async slug => (slug === "mill" ? MILL : null) };

const steading = (system = {}) =>
	new FakeActorBuilder().withType("steading").withSystem({ improvementsApplied: {}, ...system }).build();

describe("migrating the applied-results record", () => {
	it("turns a per-improvement flag into a record on each writable completion line", async () => {
		const actor = steading({ improvementsApplied: { mill: true } });
		await migrateSteadingApplied(actor, repository);

		expect(actor.system.improvementsApplied).toEqual({
			"mill:0": { legacy: true },
			"mill:1": { legacy: true },
		});
	});

	// A fiction line was never written, so there is nothing to record — and a record would offer a
	// Revert for something that never happened.
	it("records nothing for a line the sheet could not have written", async () => {
		const actor = steading({ improvementsApplied: { mill: true } });
		await migrateSteadingApplied(actor, repository);
		expect(actor.system.improvementsApplied["mill:2"]).toBeUndefined();
	});

	// The harvest is not a completion. It belongs to the season-scoped store and is owed every
	// autumn, so a durable record of it would pay the Mill once and never again.
	it("records nothing for a result that fires at a moment", async () => {
		const actor = steading({ improvementsApplied: { mill: true } });
		await migrateSteadingApplied(actor, repository);
		expect(actor.system.improvementsApplied["mill:3"]).toBeUndefined();
	});

	it("drops the old slug key rather than leaving it beside the new ones", async () => {
		const actor = steading({ improvementsApplied: { mill: true } });
		await migrateSteadingApplied(actor, repository);
		expect(actor.system.improvementsApplied.mill).toBeUndefined();
	});

	it("drops turnoverExcluded, since nothing opts out any more", async () => {
		const actor = steading({ improvementsApplied: {}, turnoverExcluded: { "mill:0": true } });
		await migrateSteadingApplied(actor, repository);
		expect(actor.system.turnoverExcluded).toBeUndefined();
	});

	// The deliberate loss, asserted so nobody "fixes" it later: the old storage cannot say what was
	// written, and an inverse computed now would be a guess wearing the clothes of a fact.
	it("marks migrated records legacy, so they read as applied and offer no Revert", async () => {
		const actor = steading({ improvementsApplied: { mill: true } });
		await migrateSteadingApplied(actor, repository);
		for (const raw of Object.values(actor.system.improvementsApplied)) {
			expect(raw.legacy).toBe(true);
			expect(raw.change).toBeUndefined();
			expect(raw.entry).toBeUndefined();
		}
	});

	describe("running twice", () => {
		it("leaves a record already in the new shape alone", async () => {
			const applied = { "mill:0": { change: { target: "fortunes", amount: 1 } } };
			const actor = steading({ improvementsApplied: { ...applied } });
			await migrateSteadingApplied(actor, repository);
			expect(actor.system.improvementsApplied).toEqual(applied);
		});

		it("is idempotent", async () => {
			const actor = steading({ improvementsApplied: { mill: true }, turnoverExcluded: {} });
			await migrateSteadingApplied(actor, repository);
			const after = JSON.parse(JSON.stringify(actor.system.improvementsApplied));
			await migrateSteadingApplied(actor, repository);
			expect(actor.system.improvementsApplied).toEqual(after);
		});
	});

	describe("what it does not touch", () => {
		it("writes nothing at all for a steading with nothing to migrate", async () => {
			const actor = steading();
			const before = actor.updatedDocs.length;
			await migrateSteadingApplied(actor, repository);
			expect(actor.system.improvementsApplied).toEqual({});
			expect(actor.updatedDocs.length).toBe(before);
		});

		// An improvement removed from the pack, or a world item since deleted. The stale key still
		// goes — it addresses nothing — but nothing is invented in its place.
		it("drops a flag for an improvement that no longer resolves", async () => {
			const actor = steading({ improvementsApplied: { "long-gone": true } });
			await migrateSteadingApplied(actor, repository);
			expect(actor.system.improvementsApplied).toEqual({});
		});

		it("survives having no repository at all", async () => {
			const actor = steading({ improvementsApplied: { mill: true } });
			await migrateSteadingApplied(actor, null);
			expect(actor.system.improvementsApplied).toEqual({});
		});
	});
});
