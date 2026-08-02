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
	it("passes rollMode through unchanged with no debility marked", () => {
		expect(make().applyRollMode("population", "adv")).toBe("adv");
		expect(make().applyRollMode("fortunes", "normal")).toBe("normal");
		expect(make().applyRollMode("defenses", "dis")).toBe("dis");
	});

	async function diminished() {
		const s = make();
		await s.debilities.setDebility("diminished", true);
		return s;
	}

	it("hinders each of the three moves diminished names", async () => {
		const s = await diminished();
		expect(s.applyRollMode("defenses", "normal", "deploy")).toBe("dis");
		expect(s.applyRollMode("population", "normal", "muster")).toBe("dis");
		expect(s.applyRollMode("population", "normal", "pull-together")).toBe("dis");
	});

	it("cancels advantage on a hindered move", async () => {
		expect((await diminished()).applyRollMode("defenses", "adv", "deploy")).toBe("normal");
	});

	// Diminished is scoped to named moves, not to the ratings they happen to roll: Trade & Barter and
	// a bare Population roll share their stats with hindered moves and must stay untouched.
	it("leaves a move diminished does not name alone", async () => {
		expect((await diminished()).applyRollMode("prosperity", "normal", "trade-barter")).toBe("normal");
	});

	it("leaves a bare rating roll alone", async () => {
		expect((await diminished()).applyRollMode("population", "normal", null)).toBe("normal");
	});

	it("does not hinder moves while only lacking is marked", async () => {
		const s = make();
		await s.debilities.setDebility("lacking", true);
		expect(s.applyRollMode("defenses", "normal", "deploy")).toBe("normal");
	});
});

// What a character's expedition page asks of the steading it calls home. Named reads, so the
// caller never spells an attribute key or a debility slug.
describe("StonetopSteading — prosperity as characters read it", () => {
	it("reports name and the stored rating as the bonus", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		const s = new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves);
		expect(s.name).toBe("Stonetop");
		expect(s.prosperity).toBe(2);
		expect(s.isLacking).toBe(false);
	});

	// The book: while a steading is *lacking*, treat its Prosperity as 1 lower. That belongs to the
	// steading, so nothing downstream — character sheets, the gear table, rolls — repeats the rule.
	it("reads 1 lower while the steading is lacking", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		actor.system.debilities.lacking = true;
		const s = new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves);
		expect(s.prosperity).toBe(1);
		expect(s.isLacking).toBe(true);
	});

	it("lacking drops the prosperity roll bonus too", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 0;
		actor.system.debilities.lacking = true;
		expect(new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves).resolveBonus("prosperity")).toBe(-1);
	});

	it("lacking leaves the other ratings alone", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.fortunes   = 1;
		actor.system.attributes.defenses   = 2;
		actor.system.attributes.population = 1;
		actor.system.debilities.lacking    = true;
		const s = new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves);
		expect(s.resolveBonus("fortunes")).toBe(1);
		expect(s.resolveBonus("defenses")).toBe(2);
		expect(s.resolveBonus("population")).toBe(1);
	});

	// The GM's rating panel reads the stored attribute, so the adjustment must not follow it there.
	it("does not change the stored rating", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		actor.system.debilities.lacking = true;
		new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves).prosperity;
		expect(actor.system.attributes.prosperity).toBe(2);
	});

	it("defaults to +0 / not lacking on a fresh steading", () => {
		expect(make().prosperity).toBe(0);
		expect(make().isLacking).toBe(false);
	});

	it("carries a negative rating through", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = -1;
		expect(new StonetopSteading(actor, fakeImprovementsRepo, fakeMoves).prosperity).toBe(-1);
	});
});
