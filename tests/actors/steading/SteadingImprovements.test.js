import { describe, it, expect, vi } from "vitest";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";

// The repo now resolves a single slug → its content; the steading renders only the improvements it
// OWNS (system.improvements), with pick state in system.improvementValues.
function makeRepo(improvements = []) {
	const repo = new FakeSteadingImprovementRepository();
	for (const imp of improvements) repo.withImprovement(imp.slug, imp.choices);
	return repo;
}

// `improvementValues` is the stored track/pick state — seeded directly, because these tests are
// about what buildSnapshot makes of it, not about how it got written.
function makeActor(improvements = [], improvementValues = {}) {
	return new FakeActorBuilder().withSystem({ improvements, improvementValues }).build();
}

const PALISADE_CHOICES = {
	slug: "palisade",
	list: [{ type: "heading", slug: "done", description: "Completed", track: { max: 1 } }],
};

const palisadeRepo = () => makeRepo([new SteadingImprovement("palisade", PALISADE_CHOICES)]);

describe("SteadingImprovements.buildSnapshot", () => {
	it("returns empty when the steading owns no improvements", async () => {
		const imp = new SteadingImprovements(makeActor([]), palisadeRepo());
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("renders only the improvements the steading owns, resolved by slug", async () => {
		const repo = makeRepo([
			new SteadingImprovement("inn", { slug: "inn", list: [] }),
			new SteadingImprovement("palisade", PALISADE_CHOICES),
		]);
		const imp = new SteadingImprovements(makeActor(["palisade"]), repo);
		const snap = await imp.buildSnapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].slug).toBe("palisade");
	});

	it("skips an owned slug the repo can't resolve or whose choices are null", async () => {
		const repo = makeRepo([new SteadingImprovement("mill", null)]);
		const imp = new SteadingImprovements(makeActor(["mill", "ghost"]), repo);
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("track is unchecked by default", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});

describe("SteadingImprovements.grant", () => {
	it("appends the slug after the ones already owned (owned order is render order)", async () => {
		const actor = makeActor(["palisade", "mill"]);
		await new SteadingImprovements(actor, palisadeRepo()).grant("aetherium-crucible");
		expect(actor.system.improvements).toEqual(["palisade", "mill", "aetherium-crucible"]);
	});

	// Foundry stores `improvements` as an ArrayField: it has to be written whole. A dotted index path
	// ("system.improvements.2") would look right here but merge into the stored array in the game.
	it("writes the whole owned list in one update", async () => {
		const actor = makeActor(["palisade"]);
		const update = vi.spyOn(actor, "update");
		await new SteadingImprovements(actor, palisadeRepo()).grant("aetherium-crucible");
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({ "system.improvements": ["palisade", "aetherium-crucible"] });
	});

	it("renders the granted improvement", async () => {
		const repo = makeRepo([new SteadingImprovement("palisade", PALISADE_CHOICES)]);
		const imp = new SteadingImprovements(makeActor([]), repo);
		await imp.grant("palisade");
		const snap = await imp.buildSnapshot();
		expect(snap.map(g => g.slug)).toEqual(["palisade"]);
	});

	// The steading owns a slug whether or not the catalog can resolve it, so a slug from a module that
	// is later disabled comes back when it returns rather than being quietly dropped on grant.
	it("grants a slug the catalog cannot resolve, and simply renders nothing for it", async () => {
		const actor = makeActor([]);
		const imp = new SteadingImprovements(actor, palisadeRepo());
		await imp.grant("from-a-disabled-module");
		expect(actor.system.improvements).toEqual(["from-a-disabled-module"]);
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("is a no-op for a slug already owned — re-dropping does not duplicate or write", async () => {
		const actor = makeActor(["palisade"]);
		const update = vi.spyOn(actor, "update");
		await new SteadingImprovements(actor, palisadeRepo()).grant("palisade");
		expect(actor.system.improvements).toEqual(["palisade"]);
		expect(update).not.toHaveBeenCalled();
	});

	it("is a no-op for a blank slug (an improvement item with no stored slug)", async () => {
		const actor = makeActor(["palisade"]);
		const update = vi.spyOn(actor, "update");
		await new SteadingImprovements(actor, palisadeRepo()).grant(undefined);
		expect(actor.system.improvements).toEqual(["palisade"]);
		expect(update).not.toHaveBeenCalled();
	});
});

describe("SteadingImprovements.revoke", () => {
	it("drops only the named slug from the owned list", async () => {
		const actor = makeActor(["palisade", "mill", "inn"]);
		await new SteadingImprovements(actor, palisadeRepo()).revoke("mill");
		expect(actor.system.improvements).toEqual(["palisade", "inn"]);
	});

	it("writes the whole remaining list in one update", async () => {
		const actor = makeActor(["palisade", "mill"]);
		const update = vi.spyOn(actor, "update");
		await new SteadingImprovements(actor, palisadeRepo()).revoke("palisade");
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({ "system.improvements": ["mill"] });
	});

	it("stops rendering the revoked improvement", async () => {
		const actor = makeActor(["palisade"]);
		const imp = new SteadingImprovements(actor, palisadeRepo());
		await imp.revoke("palisade");
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("leaves the list alone when the slug isn't owned", async () => {
		const actor = makeActor(["palisade"]);
		await new SteadingImprovements(actor, palisadeRepo()).revoke("inn");
		expect(actor.system.improvements).toEqual(["palisade"]);
	});

	// Progress is deliberately kept: an accidental revoke loses nothing, and a re-grant restores it.
	it("leaves the improvement's track state in improvementValues", async () => {
		const actor = makeActor(["palisade"], { palisade: { done: 1 } });
		const imp = new SteadingImprovements(actor, palisadeRepo());

		await imp.revoke("palisade");
		expect(actor.system.improvementValues).toEqual({ palisade: { done: 1 } });

		await imp.grant("palisade");
		expect((await imp.buildSnapshot())[0].list[0].track.checks[0]).toBe(true);
	});

	it("does not disturb another improvement's track state", async () => {
		const actor = makeActor(["palisade", "mill"], { mill: { done: 1 } });
		await new SteadingImprovements(actor, palisadeRepo()).revoke("palisade");
		expect(actor.system.improvementValues).toEqual({ mill: { done: 1 } });
	});
});

// Writing track state is the steading's job now (setChoiceTrackFor → its ChoiceStores → this
// improvement's controller); what belongs here is what the snapshot makes of what is stored.
describe("SteadingImprovements.buildSnapshot — stored track state", () => {
	const snapshotOf = values =>
		new SteadingImprovements(makeActor(["palisade"], values), palisadeRepo()).buildSnapshot();

	it("shows a filled track as checked", async () => {
		expect((await snapshotOf({ palisade: { done: 1 } }))[0].list[0].track.checks[0]).toBe(true);
	});

	it("shows an emptied track as unchecked", async () => {
		expect((await snapshotOf({ palisade: { done: 0 } }))[0].list[0].track.checks[0]).toBe(false);
	});

	it("shows a track nothing has been stored for as unchecked", async () => {
		expect((await snapshotOf({}))[0].list[0].track.checks[0]).toBe(false);
	});
});
