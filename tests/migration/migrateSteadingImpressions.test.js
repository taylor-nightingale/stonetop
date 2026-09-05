import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the pack-touching piece is mocked; nothing else in applySteadfast is used here.
vi.mock("../../src/actors/steading/applySteadfast.js", async importOriginal => ({
	...(await importOriginal()),
	loadSteadfast: vi.fn(async () => null),
}));

import { migrateSteadingImpressions } from "../../src/migration/migrateSteadingImpressions.js";
import { loadSteadfast } from "../../src/actors/steading/applySteadfast.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

// What the steadfast defines: the book's own sensory lines, per season.
const DEFINED = [
	{ season: "spring", text: "Petrichor smell on a southerly breeze" },
	{ season: "spring", text: "Hopeful green poking through deadbrown grass and soil" },
	{ season: "winter", text: "Cloaks drawn tight against a bitter wind" },
];

const steadfastWith = impressions => ({ system: { slug: "stonetop", impressions } });

const steading = (system = {}) =>
	new FakeActorBuilder().withType("steading")
		.withSystem({ steadfast: "stonetop", season: "spring", ...system }).build();

beforeEach(() => {
	// Cleared as well as re-stubbed: one test asserts the pack is never reached at all, and a call
	// count carried over from the test before it would answer for the wrong run.
	loadSteadfast.mockClear();
	loadSteadfast.mockResolvedValue(steadfastWith(DEFINED));
});

describe("migrateSteadingImpressions", () => {
	// The lines are part of the steadfast's DEFINITION — they describe the place — so a steading
	// seeded before the field existed is missing a definition, not a record.
	it("copies the steadfast's lines onto a steading that has none", async () => {
		const actor = steading();
		await migrateSteadingImpressions(actor);
		expect(actor.system.impressions).toEqual(DEFINED);
	});

	it("copies them rather than sharing the steadfast's own rows", async () => {
		const actor = steading();
		await migrateSteadingImpressions(actor);
		expect(actor.system.impressions[0]).not.toBe(DEFINED[0]);
	});

	// A steading that has never turned a season has no line to show; the migration gives it one for
	// the season it is actually in.
	it("stamps a line for the season the steading is in", async () => {
		const actor = steading({ season: "winter" });
		await migrateSteadingImpressions(actor);
		expect(actor.system.seasonImpression).toBe("Cloaks drawn tight against a bitter wind");
	});

	// Once stamped it is a RECORD — the line this season was given, which the table has been reading
	// and the chronicle will want to quote. Re-rolling it would quietly change that.
	it("leaves an already-stamped line alone", async () => {
		const actor = steading({ seasonImpression: "Cold, steady rain" });
		await migrateSteadingImpressions(actor);
		expect(actor.system.seasonImpression).toBe("Cold, steady rain");
	});

	it("stamps nothing when the steadfast has no line for that season", async () => {
		const actor = steading({ season: "autumn" });
		await migrateSteadingImpressions(actor);
		expect(actor.system.seasonImpression ?? "").toBe("");
		expect(actor.system.impressions).toEqual(DEFINED);
	});

	// Most steadfasts print no Impressions section, and a steading may have no steadfast at all.
	it("does nothing for a steadfast that defines none", async () => {
		loadSteadfast.mockResolvedValue(steadfastWith([]));
		const actor = steading();
		await migrateSteadingImpressions(actor);
		expect(actor.system.impressions ?? []).toEqual([]);
	});

	it("does nothing for a steading with no steadfast", async () => {
		const actor = new FakeActorBuilder().withType("steading").withSystem({ season: "spring" }).build();
		await migrateSteadingImpressions(actor);
		expect(loadSteadfast).not.toHaveBeenCalled();
	});

	// Ungated and idempotent: the runner re-runs it on every version bump.
	it("writes the same values back on a second run", async () => {
		const actor = steading();
		await migrateSteadingImpressions(actor);
		const first = actor.system.seasonImpression;
		await migrateSteadingImpressions(actor);
		expect(actor.system.impressions).toEqual(DEFINED);
		expect(actor.system.seasonImpression).toBe(first);
	});
});
