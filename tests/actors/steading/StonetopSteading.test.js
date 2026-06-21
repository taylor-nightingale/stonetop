import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeSteadingMovesRepository } from "../../fakes/FakeSteadingMovesRepository.js";

const fakeImprovementsRepo = {getAll: async () => []};
const fakeMoves = new FakeSteadingMovesRepository();

function make() {
	return new StonetopSteading(new FakeSteadingBuilder().build(), fakeImprovementsRepo, fakeMoves);
}

describe("StonetopSteading.buildSnapshot", () => {
	it("returns a SteadingSnapshot", async () => {
		expect(await make().buildSnapshot()).toBeInstanceOf(SteadingSnapshot);
	});

	it("uses default fortunes when no value set", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.fortunes.current).toBe(2);
	});

	it("uses default surplus when no value set", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.surplus.current).toBe(1);
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

// -- Rolling interface ---------------------------------------------------------

describe("StonetopSteading.rollMode", () => {
	it("always returns 'def'", () => {
		expect(make().rollMode).toBe("normal");
	});
});

describe("StonetopSteading.getRollableStats", () => {
	it("returns 4 entries", () => {
		expect(make().getRollableStats()).toHaveLength(4);
	});

	it("includes population with its current value", () => {
		const stat = make().getRollableStats().find(s => s.key === "population");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(1);
	});

	it("includes prosperity with its current value", () => {
		const stat = make().getRollableStats().find(s => s.key === "prosperity");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(1);
	});

	it("includes defenses with its current value", () => {
		const stat = make().getRollableStats().find(s => s.key === "defenses");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(1);
	});

	it("includes fortunes with its current value", () => {
		const stat = make().getRollableStats().find(s => s.key === "fortunes");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(2);
	});
});

describe("StonetopSteading.resolveBonus", () => {
	it("returns population.current for 'population'", () => {
		expect(make().resolveBonus("population")).toBe(1);
	});

	it("returns prosperity.current for 'prosperity'", () => {
		expect(make().resolveBonus("prosperity")).toBe(1);
	});

	it("returns defenses.current for 'defenses'", () => {
		expect(make().resolveBonus("defenses")).toBe(1);
	});

	it("returns fortunes for 'fortunes'", () => {
		expect(make().resolveBonus("fortunes")).toBe(2);
	});

	it("returns null for unknown rollStat", () => {
		expect(make().resolveBonus("str")).toBeNull();
	});
});

describe("StonetopSteading.applyRollMode", () => {
	it("passes rollMode through unchanged", () => {
		expect(make().applyRollMode("population", "adv")).toBe("adv");
		expect(make().applyRollMode("fortunes", "normal")).toBe("normal");
		expect(make().applyRollMode("defenses", "dis")).toBe("dis");
	});
});
