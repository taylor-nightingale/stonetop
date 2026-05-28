import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../module/actors/steading/StonetopSteading.js";
import { SteadingDefaults } from "../../../module/model/data/steading/SteadingDefaults.js";
import { SteadingSnapshot } from "../../../module/model/snapshot/steading/SteadingSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

const fakeRepo = {getAll: async () => []};

function make() {
	return new StonetopSteading(new FakeActorBuilder().build(), fakeRepo);
}

describe("StonetopSteading.buildSnapshot", () => {
	it("returns a SteadingSnapshot", async () => {
		expect(await make().buildSnapshot()).toBeInstanceOf(SteadingSnapshot);
	});

	it("uses default fortunes when no value set", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.fortunes.current).toBe(SteadingDefaults.fortunes.current);
	});

	it("uses default surplus when no value set", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.surplus.current).toBe(SteadingDefaults.surplus.current);
	});

	it("defaults notes to empty string", async () => {
		expect((await make().buildSnapshot()).notes).toBe("");
	});

	it("snapshot includes debilities from SteadingDebilities", async () => {
		expect((await make().buildSnapshot()).debilities).toHaveLength(3);
	});

	it("snapshot includes residents from SteadingResidents", async () => {
		expect((await make().buildSnapshot()).residents).toEqual([]);
	});

	it("snapshot includes neighbors from SteadingNeighbors", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.neighbors.people).toEqual([]);
		expect(snap.neighbors.places).toHaveLength(5);
	});

	it("snapshot includes content sections from SteadingContent", async () => {
		expect((await make().buildSnapshot()).content).toHaveLength(3);
	});
});

describe("StonetopSteading — fortunes", () => {
	it("setFortunes is reflected in snapshot", async () => {
		const s = make();
		await s.setFortunes(4);
		expect((await s.buildSnapshot()).fortunes.current).toBe(4);
	});

	it("marks correct option as selected after setFortunes", async () => {
		const s = make();
		await s.setFortunes(3);
		const options = (await s.buildSnapshot()).fortunes.options;
		expect(options[3].selected).toBe(true);
		expect(options[0].selected).toBe(false);
	});
});

describe("StonetopSteading — surplus", () => {
	it("setSurplus is reflected in snapshot", async () => {
		const s = make();
		await s.setSurplus(5);
		expect((await s.buildSnapshot()).surplus.current).toBe(5);
	});
});

describe("StonetopSteading — notes", () => {
	it("setNotes is reflected in snapshot", async () => {
		const s = make();
		await s.setNotes("hello world");
		expect((await s.buildSnapshot()).notes).toBe("hello world");
	});
});
