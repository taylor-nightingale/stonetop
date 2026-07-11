import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundrySteadingRepository } from "../../../../src/actors/character/repositories/FoundrySteadingRepository.js";
import { FakeGameBuilder } from "../../../fakes/FakeGameBuilder.js";

afterEach(() => vi.unstubAllGlobals());

function makeSteading({ name = "Stonetop", current = 1, lacking = false } = {}) {
	return {
		type: "steading",
		name,
		system: {
			attributes: { prosperity: { current } },
			debilities: { lacking },
		},
	};
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

	it("maps the prosperity track index to its roll bonus", () => {
		// index 2 on the [-1, 0, +1, +2, +3] track is the +1 box
		new FakeGameBuilder().withWorldActor(makeSteading({ current: 2 })).build();
		expect(new FoundrySteadingRepository().getProsperity()).toEqual({
			steadingName: "Stonetop", value: 1, lacking: false,
		});
	});

	it("index 0 is the -1 box", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ current: 0 })).build();
		expect(new FoundrySteadingRepository().getProsperity().value).toBe(-1);
	});

	it("defaults the value to 0 when the track index is missing", () => {
		new FakeGameBuilder().withWorldActor({ type: "steading", name: "Marshedge", system: {} }).build();
		expect(new FoundrySteadingRepository().getProsperity()).toEqual({
			steadingName: "Marshedge", value: 0, lacking: false,
		});
	});

	it("carries the lacking debility", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ lacking: true })).build();
		expect(new FoundrySteadingRepository().getProsperity().lacking).toBe(true);
	});
});
