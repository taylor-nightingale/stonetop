import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundrySteadingRepository } from "../../../../src/actors/character/repositories/FoundrySteadingRepository.js";
import { StonetopSteading } from "../../../../src/actors/steading/StonetopSteading.js";
import { FakeGameBuilder } from "../../../fakes/FakeGameBuilder.js";

afterEach(() => vi.unstubAllGlobals());

// Ratings are stored as their actual roll bonus (see steadingRatingsSchema); the typed
// actor wrapped here is the same StonetopSteading the steading sheet rolls with, so the
// display can't drift from the schema without the rolls drifting too.
function makeSteading({ name = "Stonetop", prosperity = 0, lacking = false, system } = {}) {
	const doc = {
		type: "steading",
		name,
		system: system ?? { attributes: { prosperity }, debilities: { lacking } },
	};
	doc.typedActor = new StonetopSteading(doc);
	return doc;
}

describe("FoundrySteadingRepository.getProsperity", () => {
	it("returns null when there is no game", () => {
		expect(new FoundrySteadingRepository().getProsperity()).toBeNull();
	});

	it("returns null when the world has no steading actor", () => {
		new FakeGameBuilder().build();
		expect(new FoundrySteadingRepository().getProsperity()).toBeNull();
	});

	it("ignores non-steading actors", () => {
		new FakeGameBuilder().withWorldActor({ type: "character", name: "Rhianne" }).build();
		expect(new FoundrySteadingRepository().getProsperity()).toBeNull();
	});

	it("reports the stored rating as the roll bonus", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ prosperity: 1 })).build();
		expect(new FoundrySteadingRepository().getProsperity()).toEqual({
			steadingName: "Stonetop", value: 1, lacking: false,
		});
	});

	it("carries a negative rating through", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ prosperity: -1 })).build();
		expect(new FoundrySteadingRepository().getProsperity().value).toBe(-1);
	});

	it("defaults the value to 0 when the steading has no attributes yet", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ name: "Marshedge", system: {} })).build();
		expect(new FoundrySteadingRepository().getProsperity()).toEqual({
			steadingName: "Marshedge", value: 0, lacking: false,
		});
	});

	it("carries the lacking debility", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ lacking: true })).build();
		expect(new FoundrySteadingRepository().getProsperity().lacking).toBe(true);
	});

	it("does not treat a non-boolean lacking value as active (legacy data shapes)", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ lacking: { value: true } })).build();
		expect(new FoundrySteadingRepository().getProsperity().lacking).toBe(false);
	});
});

// -- steading selection with strays ---------------------------------------------

describe("FoundrySteadingRepository steading selection", () => {
	it("prefers the steading named Stonetop over an earlier stray", () => {
		new FakeGameBuilder()
			.withWorldActor(makeSteading({ name: "New Steading", prosperity: -1, lacking: true }))
			.withWorldActor(makeSteading({ name: "Stonetop", prosperity: 1 }))
			.build();
		const p = new FoundrySteadingRepository().getProsperity();
		expect(p.steadingName).toBe("Stonetop");
		expect(p.value).toBe(1);
		expect(p.lacking).toBe(false);
	});

	it("name match is case-insensitive and trims whitespace", () => {
		new FakeGameBuilder()
			.withWorldActor(makeSteading({ name: "New Steading" }))
			.withWorldActor(makeSteading({ name: " stonetop ", prosperity: 2 }))
			.build();
		expect(new FoundrySteadingRepository().getProsperity().value).toBe(2);
	});

	it("prefers a renamed steading over one still at the default name", () => {
		new FakeGameBuilder()
			.withTranslation("stonetop.actor.defaultName.steading", "New Steading")
			.withWorldActor(makeSteading({ name: "New Steading" }))
			.withWorldActor(makeSteading({ name: "Marshedge", prosperity: -1 }))
			.build();
		const p = new FoundrySteadingRepository().getProsperity();
		expect(p.steadingName).toBe("Marshedge");
		expect(p.value).toBe(-1);
	});

	it("falls back to the first steading when all are default-named", () => {
		new FakeGameBuilder()
			.withTranslation("stonetop.actor.defaultName.steading", "New Steading")
			.withWorldActor(makeSteading({ name: "New Steading", prosperity: 3 }))
			.withWorldActor(makeSteading({ name: "New Steading", prosperity: 0 }))
			.build();
		expect(new FoundrySteadingRepository().getProsperity().value).toBe(3);
	});

	it("a single steading is used whatever its name", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ name: "New Steading", prosperity: 2 })).build();
		expect(new FoundrySteadingRepository().getProsperity().steadingName).toBe("New Steading");
	});
});
