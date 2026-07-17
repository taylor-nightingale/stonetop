import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

const fakeImprovementsRepo = {getBySlug: async () => null};
const fakeMoves = new FakeMoveRepository();

function make() {
	return new StonetopSteading(new FakeSteadingBuilder().build(), fakeImprovementsRepo, fakeMoves);
}

describe("StonetopSteading.buildSnapshot", () => {
	it("returns a SteadingSnapshot", async () => {
		expect(await make().buildSnapshot()).toBeInstanceOf(SteadingSnapshot);
	});

	it("reflects the stored fortunes value (+1 for Stonetop)", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.fortunes.current).toBe(1);
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

	it("marks the option whose value matches after setFortunes", async () => {
		const s = make();
		await s.setFortunes(3); // +3
		const options = (await s.buildSnapshot()).fortunes.options;
		expect(options.find(o => o.value === 3).selected).toBe(true);
		expect(options.find(o => o.value === -1).selected).toBe(false);
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

	// The stored `current` is an index into the bonuses array [-1, 0, 1, 2, 3];
	// the value shown/rolled is the bonus it points at, not the index. Default current 1 → +0.
	it("includes population with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "population");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes prosperity with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "prosperity");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes defenses with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "defenses");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes fortunes with its bonus value (index 2 → +1)", () => {
		const stat = make().getRollableStats().find(s => s.key === "fortunes");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(1);
	});

	it("reflects a raised attribute value directly", async () => {
		const s = make();
		await s.attributes.setValue("population", 3); // +3
		expect(s.getRollableStats().find(x => x.key === "population").value).toBe(3);
	});
});

describe("StonetopSteading.resolveBonus", () => {
	// Ratings are stored as their actual value now; resolveBonus just returns it.
	it("returns population's stored value (+0)", () => {
		expect(make().resolveBonus("population")).toBe(0);
	});

	it("returns prosperity's stored value (+0)", () => {
		expect(make().resolveBonus("prosperity")).toBe(0);
	});

	it("returns defenses' stored value (+0)", () => {
		expect(make().resolveBonus("defenses")).toBe(0);
	});

	it("returns fortunes' stored value (+1)", () => {
		expect(make().resolveBonus("fortunes")).toBe(1);
	});

	it("returns a lowered attribute value (-1)", async () => {
		const s = make();
		await s.attributes.setValue("defenses", -1);
		expect(s.resolveBonus("defenses")).toBe(-1);
	});

	it("returns a raised attribute value (+3)", async () => {
		const s = make();
		await s.attributes.setValue("prosperity", 3);
		expect(s.resolveBonus("prosperity")).toBe(3);
	});

	it("returns surplus as its raw value (not index-mapped)", async () => {
		const s = make();
		await s.setSurplus(3);
		expect(s.resolveBonus("surplus")).toBe(3);
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

describe("StonetopSteading.getProsperity", () => {
	it("reports name, the stored rating as the bonus, and the lacking debility", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		actor.system.debilities.lacking = true;
		const s = new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves);
		expect(s.getProsperity()).toEqual({ steadingName: "Stonetop", value: 2, lacking: true });
	});

	it("defaults to +0 / not lacking on a fresh steading", () => {
		expect(make().getProsperity()).toEqual({ steadingName: "Stonetop", value: 0, lacking: false });
	});
});
