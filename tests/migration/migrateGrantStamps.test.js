import { describe, expect, it } from "vitest";
import { migrateGrantStamps } from "../../src/migration/migrateGrantStamps.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

function makeActor(items = []) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

function stampOf(actor, id) {
	return actor.items.get(id)?.flags?.stonetop?.grant ?? null;
}

const move = (id, slug, system = {}) => ({ _id: id, type: "move", name: slug, system: { slug, ...system } });

// ── Stamping from the five markers the system used before ─────────────────────

describe("migrateGrantStamps — reading the legacy markers", () => {
	it("stamps a playbook move from its category prefix", async () => {
		const actor = makeActor([move("m1", "bulwark", { categoryKey: "playbook-the-heavy" })]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "m1")).toEqual({ source: "playbook:the-heavy", key: "move:bulwark" });
	});

	it("stamps insert and arcana moves from their category prefixes", async () => {
		const actor = makeActor([
			move("m1", "haunt", { categoryKey: "insert-revenant" }),
			move("m2", "call-forth", { categoryKey: "arcana-the-ring" }),
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "m1").source).toBe("insert:revenant");
		expect(stampOf(actor, "m2").source).toBe("arcana:the-ring");
	});

	it("stamps every other category as the reference list it is", async () => {
		const actor = makeActor([
			move("m1", "defy-danger", { categoryKey: "basic" }),
			move("m2", "make-camp", { categoryKey: "expedition" }),
			move("m3", "hold-steady", { categoryKey: "homefront" }),
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "m1").source).toBe("reference:basic");
		expect(stampOf(actor, "m2").source).toBe("reference:expedition");
		expect(stampOf(actor, "m3").source).toBe("reference:homefront");
	});

	it("leaves an 'other' move unstamped — the player dropped it in", async () => {
		const actor = makeActor([move("m1", "borrowed", { categoryKey: "other" })]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "m1")).toBeNull();
	});

	it("stamps a follower and an insert from the grantedByPlaybook flag", async () => {
		const actor = makeActor([
			{ _id: "f1", type: "follower", name: "Crew", system: { slug: "crew" },
			  flags: { stonetop: { grantedByPlaybook: "the-marshal" } } },
			{ _id: "i1", type: "insert", name: "Invocations", system: { slug: "invoc" },
			  flags: { stonetop: { grantedByPlaybook: "the-lightbearer" } } },
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "f1")).toEqual({ source: "playbook:the-marshal", key: "follower:crew" });
		expect(stampOf(actor, "i1")).toEqual({ source: "playbook:the-lightbearer", key: "insert:invoc" });
	});

	it("stamps a follower embedded before the flag existed, from system.playbookSlug", async () => {
		const actor = makeActor([
			{ _id: "f1", type: "follower", name: "Crew", system: { slug: "crew", playbookSlug: "the-marshal" } },
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "f1").source).toBe("playbook:the-marshal");
	});

	it("stamps an arcanum's follower from system.arcanaSlug", async () => {
		const actor = makeActor([
			{ _id: "f1", type: "follower", name: "The Ring", system: { slug: "the-ring", arcanaSlug: "band-of-hands" } },
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "f1").source).toBe("arcana:band-of-hands");
	});

	it("stamps a possession from system.playbookSlug", async () => {
		const actor = makeActor([
			{ _id: "p1", type: "possession", name: "Pouch", system: { slug: "sacred-pouch", playbookSlug: "the-blessed" } },
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "p1")).toEqual({ source: "playbook:the-blessed", key: "possession:sacred-pouch" });
	});

	// Gear is stamped under its own namespace: an arcanum's card items and the followers the same card
	// grants must not answer to one source, or clearing the gear would revoke the followers.
	it("stamps an outfit item from the source it already carries", async () => {
		const actor = makeActor([
			{ _id: "o1", type: "outfitItem", name: "Bow", system: { slug: "bow", source: "possession:hunters-kit" } },
		]);
		await migrateGrantStamps(actor);
		expect(stampOf(actor, "o1")).toEqual({ source: "outfit:possession:hunters-kit", key: "outfitItem:bow" });
	});

	it("leaves items nobody granted alone", async () => {
		const actor = makeActor([
			{ _id: "f1", type: "follower", name: "Enfys", system: { slug: "enfys" } },
			{ _id: "e1", type: "outfitItem", name: "Rope", system: { slug: "rope", source: null } },
		]);
		await migrateGrantStamps(actor);
		expect(actor.updatedDocs).toEqual([]);
	});

	it("does not restamp an item that already carries one", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-fox" }),
		]);
		actor.items.get("m1").flags = { stonetop: { grant: { source: "playbook:the-heavy", key: "move:bulwark" } } };
		await migrateGrantStamps(actor);
		expect(actor.updatedDocs).toEqual([]);
		expect(stampOf(actor, "m1").source).toBe("playbook:the-heavy");
	});

	it("writes nothing for an actor with no items", async () => {
		const actor = makeActor([]);
		expect(await migrateGrantStamps(actor)).toEqual({ stamped: 0, pruned: 0 });
	});
});

// ── Pruning what the unguarded grant paths duplicated ─────────────────────────

describe("migrateGrantStamps — pruning duplicates", () => {
	it("collapses a move a playbook granted twice", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m2", "bulwark", { categoryKey: "playbook-the-heavy" }),
		]);
		await migrateGrantStamps(actor);
		expect([...actor.items].filter(i => i.type === "move")).toHaveLength(1);
	});

	it("keeps the copy the player advanced", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy", acquired: false, instanceCount: 0 }),
			move("m2", "bulwark", { categoryKey: "playbook-the-heavy", acquired: true, instanceCount: 2 }),
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual(["m1"]);
		expect(actor.items.get("m2").system.instanceCount).toBe(2);
	});

	it("keeps the follower carrying loyalty and member HP", async () => {
		const follower = (id, system) => ({ _id: id, type: "follower", name: "Crew", system: { slug: "crew", ...system },
			flags: { stonetop: { grantedByPlaybook: "the-marshal" } } });
		const actor = makeActor([
			follower("f1", { loyalty: 0, members: [] }),
			follower("f2", { loyalty: 2, members: [{ hp: { value: 4, max: 6 } }] }),
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual(["f1"]);
	});

	it("keeps the possession that was selected and used", async () => {
		const possession = (id, system) => ({ _id: id, type: "possession", name: "Pouch",
			system: { slug: "sacred-pouch", playbookSlug: "the-blessed", ...system } });
		const actor = makeActor([
			possession("p1", { selected: false, uses: 0 }),
			possession("p2", { selected: true, uses: 3 }),
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual(["p1"]);
	});

	it("keeps the earliest copy when neither has been touched", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m2", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m3", "bulwark", { categoryKey: "playbook-the-heavy" }),
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual(["m2", "m3"]);
	});

	it("leaves the same move granted by two different sources alone", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m2", "bulwark", { categoryKey: "arcana-the-ring" }),
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual([]);
	});

	it("leaves two authored items alone — two of them are two things", async () => {
		const actor = makeActor([
			{ _id: "f1", type: "follower", name: "Bob", system: { slug: "custom-1" } },
			{ _id: "f2", type: "follower", name: "Bob", system: { slug: "custom-1" } },
		]);
		await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual([]);
	});

	it("deletes nothing on a character with no duplicates", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m2", "armored", { categoryKey: "playbook-the-heavy" }),
		]);
		const result = await migrateGrantStamps(actor);
		expect(actor.deletedIds).toEqual([]);
		expect(result).toEqual({ stamped: 2, pruned: 0 });
	});

	it("reports what it stamped and pruned", async () => {
		const actor = makeActor([
			move("m1", "bulwark", { categoryKey: "playbook-the-heavy" }),
			move("m2", "bulwark", { categoryKey: "playbook-the-heavy" }),
		]);
		expect(await migrateGrantStamps(actor)).toEqual({ stamped: 2, pruned: 1 });
	});
});
