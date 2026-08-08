import { describe, it, expect } from "vitest";
import { SteadingMoves } from "../../../src/actors/steading/SteadingMoves.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { RichText } from "../../../src/model/snapshot/RichText.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function move(name, moveType, opts = {}) {
	const b = new FakeCompendiumMoveBuilder().withName(name).withMoveType(moveType);
	if (opts.description) b.withDescription(opts.description);
	if (opts.rollStat)    b.withRollStat(opts.rollStat);
	if (opts.resource)    b.withResource(opts.resource);
	return b.build();
}

const homefront = (name, opts = {}) => move(name, "homefront", opts);
const seasons   = (name, opts = {}) => move(name, "seasons", opts);

// Reference moves live in the compendium (pack), not the world — that's the set seeding draws from.
// (`addBasic` stands in for the compendium in FakeMoveRepository.)
function repoWith(...moves) {
	const repo = new FakeMoveRepository();
	moves.forEach(m => repo.addBasic(m));
	return repo;
}

function makeMoves(repo, actor = new FakeSteadingBuilder().build()) {
	return { moves: new SteadingMoves(actor, repo, new ResourceController(actor)), actor };
}

const inCategory = (actor, key) => [...actor.items].filter(i => i.system?.categoryKey === key);
const categoryNamed = (snapshot, key) => snapshot.find(c => c.key === key);

describe("SteadingMoves.seedReferenceMoves", () => {
	it("embeds each homefront move onto the steading, acquired (checked by default)", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade"), homefront("Stand Watch")));
		await moves.seedReferenceMoves();
		const seeded = inCategory(actor, "homefront");
		expect(seeded).toHaveLength(2);
		expect(seeded.every(i => i.system.acquired === true && i.system.instanceCount === 1)).toBe(true);
	});

	it("files each category's moves under its own key", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade"), seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		expect(inCategory(actor, "homefront").map(i => i.name)).toEqual(["Trade"]);
		expect(inCategory(actor, "seasons").map(i => i.name)).toEqual(["Seasons Change: Spring"]);
	});

	it("is idempotent — re-seeding adds no duplicates", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade"), seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		await moves.seedReferenceMoves();
		expect(inCategory(actor, "homefront")).toHaveLength(1);
		expect(inCategory(actor, "seasons")).toHaveLength(1);
	});
});

describe("SteadingMoves.restampCategories", () => {
	// A steading seeded before Seasons Change moved out of the homefront moveType carries those moves
	// stamped `homefront`. Left there, the seeder can't see them and embeds a second copy.
	it("re-files a move whose category disagrees with its stored moveType", async () => {
		const { moves, actor } = makeMoves(repoWith(seasons("Seasons Change: Spring")));
		await moves.addMove(homefront("Seasons Change: Spring"));   // the old, wrongly-typed embed
		actor.items[0].system.moveType = "seasons";                 // the packs moved it

		await moves.restampCategories();

		expect(inCategory(actor, "homefront")).toHaveLength(0);
		expect(inCategory(actor, "seasons")).toHaveLength(1);
	});

	it("lets the following re-seed find the restamped move rather than duplicating it", async () => {
		const { moves, actor } = makeMoves(repoWith(seasons("Seasons Change: Spring")));
		await moves.addMove(homefront("Seasons Change: Spring"));
		actor.items[0].system.moveType = "seasons";

		await moves.restampCategories();
		await moves.seedReferenceMoves();

		expect(inCategory(actor, "seasons")).toHaveLength(1);
	});

	it("leaves moves whose category already agrees alone", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		const before = actor.items[0].system.categoryKey;
		await moves.restampCategories();
		expect(actor.items[0].system.categoryKey).toBe(before);
	});

	// Nothing else on a steading should be dragged into a steading category by a stray moveType.
	it("ignores a move whose moveType is not a steading category", async () => {
		const { moves, actor } = makeMoves(repoWith());
		await moves.addMove(move("Discern Realities", "basic"));
		await moves.restampCategories();
		expect(inCategory(actor, "homefront")).toHaveLength(1);
	});
});

describe("SteadingMoves.addMove (drag-drop)", () => {
	it("stamps the dropped move into the homefront category so the sheet renders it", async () => {
		const { moves, actor } = makeMoves(repoWith());
		await moves.addMove(homefront("Trade"));
		const added = inCategory(actor, "homefront");
		expect(added).toHaveLength(1);
		expect(added[0].system.acquired).toBe(true);
		expect(added[0].system.instanceCount).toBe(1);
	});

	it("files the dropped move under the category its own moveType names", async () => {
		const { moves, actor } = makeMoves(repoWith());
		await moves.addMove(seasons("Seasons Change: Spring"));
		expect(inCategory(actor, "seasons")).toHaveLength(1);
	});

	// A dropped move with no steading category of its own still has to land somewhere visible.
	it("falls back to homefront for a move typed for something else", async () => {
		const { moves, actor } = makeMoves(repoWith());
		await moves.addMove(move("Discern Realities", "basic"));
		expect(inCategory(actor, "homefront")).toHaveLength(1);
	});

	it("re-adds a deleted reference move (the post-seed recovery path)", async () => {
		const { moves, actor } = makeMoves(repoWith(seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		actor.items.length = 0;   // GM deleted the move
		await moves.addMove(seasons("Seasons Change: Spring"));
		expect(inCategory(actor, "seasons")).toHaveLength(1);
	});

	it("is a no-op for a move the steading already has (dedupe by stored slug)", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		await moves.addMove(homefront("Trade"));
		expect(inCategory(actor, "homefront")).toHaveLength(1);
	});

	// Dedupe spans categories: the same move re-dropped after the packs re-typed it must not appear twice.
	it("is a no-op for a move the steading already has in another category", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		await moves.addMove(seasons("Seasons Change: Spring"));
		expect([...actor.items].filter(i => i.type === "move")).toHaveLength(1);
	});
});

describe("SteadingMoves.buildSnapshot", () => {
	it("returns no categories when no moves are embedded", async () => {
		const { moves } = makeMoves(repoWith());
		await moves.seedReferenceMoves();
		expect(await moves.buildSnapshot()).toEqual([]);
	});

	// Regression guard: seeding happens once at actor creation, NOT on render. buildSnapshot must
	// only READ embedded moves — reading it on an unseeded steading creates nothing.
	it("does not seed — an unseeded steading yields no categories and no embedded moves", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade"), homefront("Stand Watch")));
		expect(await moves.buildSnapshot()).toEqual([]);
		expect(inCategory(actor, "homefront")).toHaveLength(0);
	});

	it("builds a homefront category from the embedded items with an ownedId per move", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade", { rollStat: "prosperity" })));
		await moves.seedReferenceMoves();
		const snap = categoryNamed(await moves.buildSnapshot(), "homefront");
		expect(snap.label).toBe("Homefront Moves");
		expect(snap.moves).toHaveLength(1);
		const move = snap.moves[0];
		expect(move.ownedId).toBeTruthy();          // resolvable for rolling → result tiers
		expect(move.rollStat).toBe("prosperity");
		expect(move.selection.value).toBe(1);        // checked by default
	});

	it("builds one category per non-empty steading category, in reading order", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade"), seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		const snap = await moves.buildSnapshot();
		expect(snap.map(c => c.key)).toEqual(["homefront", "seasons"]);
		expect(snap.map(c => c.label)).toEqual(["Homefront Moves", "Seasons Change"]);
	});

	it("omits a category the steading carries no moves for", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		expect((await moves.buildSnapshot()).map(c => c.key)).toEqual(["homefront"]);
	});

	it("lists homefront moves alphabetically by name, regardless of seed order", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade"), homefront("Bolster"), homefront("Stand Watch")));
		await moves.seedReferenceMoves();
		const names = categoryNamed(await moves.buildSnapshot(), "homefront").moves.map(m => m.name);
		expect(names).toEqual(["Bolster", "Stand Watch", "Trade"]);
	});

	// The seasons read spring → winter; alphabetically they would open on Autumn.
	it("lists the seasons in their own order rather than alphabetically", async () => {
		const { moves } = makeMoves(repoWith(
			seasons("Seasons Change: Winter"),
			seasons("Seasons Change: Autumn"),
			seasons("Seasons Change: Spring"),
			seasons("Seasons Change: Summer"),
		));
		await moves.seedReferenceMoves();
		const names = categoryNamed(await moves.buildSnapshot(), "seasons").moves.map(m => m.name);
		expect(names).toEqual([
			"Seasons Change: Spring",
			"Seasons Change: Summer",
			"Seasons Change: Autumn",
			"Seasons Change: Winter",
		]);
	});

	// A move the GM dropped into the seasons category has no place in that order; it sorts behind
	// the four the category names, rather than jumping to the front on an Infinity-vs-Infinity tie.
	it("sorts a move the category does not name behind the ones it does", async () => {
		const { moves } = makeMoves(repoWith(seasons("Seasons Change: Spring"), seasons("A Homebrew Season")));
		await moves.seedReferenceMoves();
		const names = categoryNamed(await moves.buildSnapshot(), "seasons").moves.map(m => m.name);
		expect(names).toEqual(["Seasons Change: Spring", "A Homebrew Season"]);
	});

	it("leaves the description as an un-enriched RichText for the shared enrich pass", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade", { description: "Gain **surplus** [[/r 2d6]]" })));
		await moves.seedReferenceMoves();
		const move = categoryNamed(await moves.buildSnapshot(), "homefront").moves[0];
		expect(move.description).toBeInstanceOf(RichText);
		expect(move.description.raw).toBe("Gain **surplus** [[/r 2d6]]");
		expect(move.description.html).toBeNull();
	});

	it("exposes a live ResourceSnapshot reflecting persisted current count", async () => {
		const resource = { title: "Uses", labels: ["", "", ""] };
		const { moves } = makeMoves(repoWith(homefront("Trade", { resource })));
		await moves.seedReferenceMoves();
		await moves.setMoveResourceCurrent("trade", 2);
		const move = categoryNamed(await moves.buildSnapshot(), "homefront").moves[0];
		expect(move.resource.current).toBe(2);
	});
});

describe("SteadingMoves toggling + resource state", () => {
	it("decrementMove unchecks the move (instanceCount → 0)", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		await moves.decrementMove("homefront", "trade");
		const item = inCategory(actor, "homefront")[0];
		expect(item.system.instanceCount).toBe(0);
		expect(item.system.acquired).toBe(false);
	});

	it("incrementMove re-checks a move that was toggled off", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		await moves.decrementMove("homefront", "trade");
		await moves.incrementMove("homefront", "trade");
		const item = inCategory(actor, "homefront")[0];
		expect(item.system.instanceCount).toBe(1);
		expect(item.system.acquired).toBe(true);
	});

	// The checkbox stamps its own category, so a seasons move toggles through its own key.
	it("toggles a move in the seasons category", async () => {
		const { moves, actor } = makeMoves(repoWith(seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		await moves.decrementMove("seasons", "seasons-change-spring");
		expect(inCategory(actor, "seasons")[0].system.instanceCount).toBe(0);
	});

	it("setMoveResourceText persists the fill-in text under the move slug", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.setMoveResourceText("trade", "grain");
		expect(actor.system.resources.texts.moves.trade).toBe("grain");
	});

	it("toggleResourcePip on an unlit pip fills up to and including it", async () => {
		const resource = { title: "Uses", labels: ["", "", ""] };
		const { moves } = makeMoves(repoWith(homefront("Trade", { resource })));
		await moves.seedReferenceMoves();
		await moves.toggleResourcePip("trade", "1", false);
		expect(categoryNamed(await moves.buildSnapshot(), "homefront").moves[0].resource.current).toBe(2);
	});

	it("toggleResourcePip on the highest lit pip clears it", async () => {
		const resource = { title: "Uses", labels: ["", "", ""] };
		const { moves } = makeMoves(repoWith(homefront("Trade", { resource })));
		await moves.seedReferenceMoves();
		await moves.toggleResourcePip("trade", "1", false);   // current → 2
		await moves.toggleResourcePip("trade", "1", true);    // pip 1 was lit → current → 1
		expect(categoryNamed(await moves.buildSnapshot(), "homefront").moves[0].resource.current).toBe(1);
	});
});

describe("SteadingMoves.sendToChat", () => {
	it("finds the seeded homefront move by slug and hands it to the actor's chat surface", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade", { description: "When you trade…" })));
		await moves.seedReferenceMoves();
		await moves.sendToChat("trade");
		expect(actor.chatItems).toHaveLength(1);
		expect(actor.chatItems[0].name).toBe("Trade");
	});

	it("posts nothing for an unknown slug", async () => {
		const { moves, actor } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		await moves.sendToChat("nope");
		expect(actor.chatItems).toHaveLength(0);
	});
});

describe("SteadingMoves.has", () => {
	it("is true for a seeded homefront move", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		expect(moves.has("trade")).toBe(true);
	});

	// The spring section's shortcut asks about a seasons move, so `has` must span every category.
	it("is true for a seeded move in any category", async () => {
		const { moves } = makeMoves(repoWith(seasons("Seasons Change: Spring")));
		await moves.seedReferenceMoves();
		expect(moves.has("seasons-change-spring")).toBe(true);
	});

	it("is false for a move this steading does not carry", async () => {
		const { moves } = makeMoves(repoWith(homefront("Trade")));
		await moves.seedReferenceMoves();
		expect(moves.has("seasons-change-spring")).toBe(false);
	});

	it("is false before anything is seeded, and for a blank slug", () => {
		const { moves } = makeMoves(repoWith(homefront("Trade")));
		expect(moves.has("trade")).toBe(false);
		expect(moves.has("")).toBe(false);
	});
});
