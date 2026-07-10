import { describe, it, expect } from "vitest";
import { SteadingMoves } from "../../../src/actors/steading/SteadingMoves.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { RichText } from "../../../src/model/snapshot/RichText.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function homefront(name, opts = {}) {
	const b = new FakeCompendiumMoveBuilder().withName(name).withMoveType("homefront");
	if (opts.description) b.withDescription(opts.description);
	if (opts.rollStat)    b.withRollStat(opts.rollStat);
	if (opts.resource)    b.withResource(opts.resource);
	return b.build();
}

function repoWith(...moves) {
	const repo = new FakeMoveRepository();
	moves.forEach(m => repo.addWorld(m));
	return repo;
}

function makeMoves(repo, actor = new FakeSteadingBuilder().build()) {
	return { moves: new SteadingMoves(actor, repo, new ResourceController(actor)), actor };
}

describe("SteadingMoves.seedHomefrontMoves", () => {
	it("embeds each homefront move onto the steading, acquired (checked by default)", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade"), homefront("Stand Watch")));
		await moves.seedHomefrontMoves();
		const seeded = [...actor.items].filter(i => i.system?.categoryKey === "homefront");
		expect(seeded).toHaveLength(2);
		expect(seeded.every(i => i.system.acquired === true && i.system.instanceCount === 1)).toBe(true);
	});

	it("is idempotent — re-seeding adds no duplicates", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedHomefrontMoves();
		await moves.seedHomefrontMoves();
		expect([...actor.items].filter(i => i.system?.categoryKey === "homefront")).toHaveLength(1);
	});
});

describe("SteadingMoves.buildSnapshot", () => {
	it("returns null when no homefront moves are embedded", async () => {
		const { moves } = makeMoves(repoWith());
		await moves.seedHomefrontMoves();
		expect(await moves.buildSnapshot()).toBeNull();
	});

	it("builds a homefront category from the embedded items with an ownedId per move", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade", { rollStat: "prosperity" })));
		await moves.seedHomefrontMoves();
		const snap = await moves.buildSnapshot();
		expect(snap.key).toBe("homefront");
		expect(snap.label).toBe("Homefront Moves");
		expect(snap.moves).toHaveLength(1);
		const move = snap.moves[0];
		expect(move.ownedId).toBeTruthy();          // resolvable for rolling → result tiers
		expect(move.rollStat).toBe("prosperity");
		expect(move.selection.value).toBe(1);        // checked by default
	});

	it("leaves the description as an un-enriched RichText for the shared enrich pass", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade", { description: "Gain **surplus** [[/r 2d6]]" })));
		await moves.seedHomefrontMoves();
		const move = (await moves.buildSnapshot()).moves[0];
		expect(move.description).toBeInstanceOf(RichText);
		expect(move.description.raw).toBe("Gain **surplus** [[/r 2d6]]");
		expect(move.description.html).toBeNull();
	});

	it("exposes a live ResourceSnapshot reflecting persisted current count", async () => {
		const resource = { title: "Uses", labels: ["", "", ""] };
		const { moves } = makeMoves(repoWith(homefront("Trade", { resource })));
		await moves.seedHomefrontMoves();
		await moves.setMoveResourceCurrent("trade", 2);
		const move = (await moves.buildSnapshot()).moves[0];
		expect(move.resource.current).toBe(2);
	});
});

describe("SteadingMoves toggling + resource state", () => {
	it("decrementMove unchecks the move (instanceCount → 0)", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedHomefrontMoves();
		await moves.decrementMove("trade");
		const item = [...actor.items].find(i => i.system?.categoryKey === "homefront");
		expect(item.system.instanceCount).toBe(0);
		expect(item.system.acquired).toBe(false);
	});

	it("incrementMove re-checks a move that was toggled off", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedHomefrontMoves();
		await moves.decrementMove("trade");
		await moves.incrementMove("trade");
		const item = [...actor.items].find(i => i.system?.categoryKey === "homefront");
		expect(item.system.instanceCount).toBe(1);
		expect(item.system.acquired).toBe(true);
	});

	it("setMoveResourceText persists the fill-in text under the move slug", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.setMoveResourceText("trade", "grain");
		expect(actor.system.resources.texts.moves.trade).toBe("grain");
	});
});
